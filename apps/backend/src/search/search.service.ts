import { requireUniversityId } from '../common/tenant/require-university';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { RaspLesson, RaspScraperService, SIBIT_UNIVERSITY } from '../auth/rasp-scraper.service';
import { SearchQueryDto } from './dto/search-query.dto';

const MAX_RESULTS_PER_KIND = 8;
const MAX_MATCHED_LESSONS = 80;

export type SearchResultType = 'lesson' | 'teacher' | 'room' | 'preparation' | 'material';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
  date?: Date;
}

interface SearchScope {
  universityId: string;
  groupId?: string;
  teacherId?: string;
  sourceGroupId?: string;
}

function searchPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLocaleLowerCase('ru-RU');
}

function constrainLessons<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, scope: SearchScope, alias: string) {
  query.andWhere(`${alias}.universityId = :searchUniversityId`, { searchUniversityId: scope.universityId });
  if (scope.groupId) query.andWhere(`${alias}.groupId = :searchGroupId`, { searchGroupId: scope.groupId });
  if (scope.teacherId) query.andWhere(`${alias}.teacherId = :searchTeacherId`, { searchTeacherId: scope.teacherId });
  return query;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Lesson) private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Group) private readonly groupRepository: Repository<Group>,
    @InjectRepository(University) private readonly universityRepository: Repository<University>,
    @InjectRepository(Homework) private readonly homeworkRepository: Repository<Homework>,
    @InjectRepository(FileAttachment) private readonly fileRepository: Repository<FileAttachment>,
    private readonly tenantContext: TenantContext,
    private readonly raspScraper: RaspScraperService,
  ) {}

  async search(query: SearchQueryDto, user: AuthenticatedUser) {
    this.tenantContext.assertAccess(requireUniversityId(user));
    const term = query.q.trim();
    if (term.length < 2 || term.length > 80) return { query: term, results: [] as SearchResult[] };
    const scope = await this.resolveScope(user);
    const pattern = searchPattern(term);

    const lessonQuery = this.lessonRepository.createQueryBuilder('lesson')
      .where('lesson.universityId = :universityId', { universityId: requireUniversityId(user) })
      .andWhere('(lesson.subject ILIKE :pattern OR lesson.teacherName ILIKE :pattern OR lesson.room ILIKE :pattern OR lesson.building ILIKE :pattern)', { pattern })
      .orderBy('lesson.startDate', 'DESC')
      .take(MAX_MATCHED_LESSONS);
    constrainLessons(lessonQuery, scope, 'lesson');

    const homeworkQuery = this.homeworkRepository.createQueryBuilder('homework')
      .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = homework.pairSpaceId')
      .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
      .where('pairSpace.universityId = :universityId', { universityId: requireUniversityId(user) })
      .andWhere('(homework.title ILIKE :pattern OR COALESCE(homework.description, \'\') ILIKE :pattern)', { pattern })
      .orderBy('homework.deadline', 'ASC', 'NULLS LAST')
      .take(MAX_MATCHED_LESSONS);
    constrainLessons(homeworkQuery, scope, 'lesson');

    const fileQuery = this.fileRepository.createQueryBuilder('file')
      .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = file.pairSpaceId')
      .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
      .where('pairSpace.universityId = :universityId', { universityId: requireUniversityId(user) })
      .andWhere('file.fileName ILIKE :pattern', { pattern })
      .orderBy('file.createdAt', 'DESC')
      .take(MAX_MATCHED_LESSONS);
    constrainLessons(fileQuery, scope, 'lesson');

    const [lessons, homeworks, files, sourceLessons] = await Promise.all([
      lessonQuery.getMany(),
      homeworkQuery.select([
        'homework.id AS id', 'homework.title AS title', 'homework.deadline AS deadline',
        'lesson.id AS "lessonId"', 'lesson.subject AS subject', 'lesson.startDate AS "startDate"',
      ]).getRawMany<{ id: string; title: string; deadline: Date | null; lessonId: string; subject: string; startDate: Date }>(),
      fileQuery.select([
        'file.id AS id', 'file.fileName AS "fileName"', 'lesson.id AS "lessonId"',
        'lesson.subject AS subject', 'lesson.startDate AS "startDate"',
      ]).getRawMany<{ id: string; fileName: string; lessonId: string; subject: string; startDate: Date }>(),
      scope.sourceGroupId
        ? this.raspScraper.getSchedule(scope.sourceGroupId).catch(() => [] as RaspLesson[])
        : Promise.resolve([] as RaspLesson[]),
    ]);

    const results: SearchResult[] = [];
    const seenLessons = new Set<string>();
    for (const lesson of lessons) {
      if (!scope.sourceGroupId && normalize(lesson.subject).includes(normalize(term)) && !seenLessons.has(lesson.id)) {
        seenLessons.add(lesson.id);
        results.push({
          id: `lesson:${lesson.id}`, type: 'lesson', title: lesson.subject,
          subtitle: `${lesson.teacherName || 'Преподаватель не указан'} · ${[lesson.building && `корпус ${lesson.building}`, lesson.room && `ауд. ${lesson.room}`].filter(Boolean).join(', ') || 'аудитория не указана'}`,
          href: `/pair-space/${lesson.id}`, date: lesson.startDate,
        });
      }
    }

    if (scope.sourceGroupId) {
      const sourceHref = (lesson: RaspLesson) => `/groups?groupId=${encodeURIComponent(lesson.groupId)}&year=${encodeURIComponent(lesson.academicYear)}&date=${encodeURIComponent(lesson.date)}&q=${encodeURIComponent(term)}`;
      const sourceTeachers = new Map<string, RaspLesson[]>();
      const sourceRooms = new Map<string, RaspLesson[]>();
      for (const lesson of sourceLessons) {
        const lessonDate = new Date(`${lesson.date}T${lesson.startTime}:00`);
        if (normalize(lesson.subject).includes(normalize(term))) {
          results.push({
            id: `rasp-lesson:${lesson.lessonId}:${lesson.groupId}`, type: 'lesson', title: lesson.subject,
            subtitle: `${lesson.teacher || 'Преподаватель не указан'} · ${lesson.groupName} · ${lesson.room ? `ауд. ${lesson.room}` : 'аудитория не указана'}`,
            href: sourceHref(lesson), date: lessonDate,
          });
        }
        if (lesson.teacher && normalize(lesson.teacher).includes(normalize(term))) {
          sourceTeachers.set(lesson.teacher, [...(sourceTeachers.get(lesson.teacher) || []), lesson]);
        }
        if (lesson.room && normalize(lesson.room).includes(normalize(term))) {
          sourceRooms.set(lesson.room, [...(sourceRooms.get(lesson.room) || []), lesson]);
        }
      }
      for (const [name, matches] of [...sourceTeachers].slice(0, MAX_RESULTS_PER_KIND)) {
        const target = matches.find(item => new Date(`${item.date}T${item.startTime}:00`).getTime() >= Date.now()) || matches[0];
        results.push({
          id: `rasp-teacher:${normalize(name)}`, type: 'teacher', title: name,
          subtitle: `${matches.length} занятий в расписании группы ${matches[0].groupName}`,
          href: sourceHref(target), date: new Date(`${target.date}T${target.startTime}:00`),
        });
      }
      for (const [room, matches] of [...sourceRooms].slice(0, MAX_RESULTS_PER_KIND)) {
        const target = matches.find(item => new Date(`${item.date}T${item.startTime}:00`).getTime() >= Date.now()) || matches[0];
        results.push({
          id: `rasp-room:${normalize(room)}`, type: 'room', title: `Аудитория ${room}`,
          subtitle: `${matches.length} занятий в расписании группы ${matches[0].groupName}`,
          href: sourceHref(target), date: new Date(`${target.date}T${target.startTime}:00`),
        });
      }
    }

    const teachers = new Map<string, Lesson[]>();
    const rooms = new Map<string, Lesson[]>();
    for (const lesson of lessons) {
      if (!scope.sourceGroupId && normalize(lesson.teacherName).includes(normalize(term))) {
        const key = lesson.teacherName!.trim();
        teachers.set(key, [...(teachers.get(key) || []), lesson]);
      }
      const location = [lesson.building, lesson.room].filter(Boolean).join(' ');
      if (!scope.sourceGroupId && normalize(location).includes(normalize(term)) && location) {
        rooms.set(location, [...(rooms.get(location) || []), lesson]);
      }
    }
    for (const [name, matches] of [...teachers].slice(0, MAX_RESULTS_PER_KIND)) {
      const latest = matches[0];
      const upcoming = matches.filter(item => item.startDate.getTime() >= Date.now())
        .sort((left, right) => left.startDate.getTime() - right.startDate.getTime()).slice(0, 3);
      const target = upcoming[0] || latest;
      results.push({
        id: `teacher:${normalize(name)}`, type: 'teacher', title: name,
        subtitle: `${latest.department || 'Преподаватель'} · ${upcoming.length ? `ближайшие занятия: ${upcoming.map(item => `${item.startTime.slice(11, 16)} ${item.groupName || ''}`).join(', ')}` : `${matches.length} занятий в расписании`}`,
        href: `/pair-space/${target.id}`, date: target.startDate,
      });
    }
    for (const [location, matches] of [...rooms].slice(0, MAX_RESULTS_PER_KIND)) {
      const latest = matches[0];
      results.push({
        id: `room:${normalize(location)}`, type: 'room', title: `Аудитория ${location}`,
        subtitle: `${matches.length} занятий в доступном расписании`,
        href: `/pair-space/${latest.id}`, date: latest.startDate,
      });
    }

    results.push(...homeworks.slice(0, MAX_RESULTS_PER_KIND).map(homework => ({
      id: `preparation:${homework.id}`, type: 'preparation' as const, title: homework.title,
      subtitle: `${homework.subject}${homework.deadline ? ` · срок ${new Date(homework.deadline).toLocaleDateString('ru-RU')}` : ''}`,
      href: `/pair-space/${homework.lessonId}`, date: homework.deadline || homework.startDate,
    })));
    results.push(...files.slice(0, MAX_RESULTS_PER_KIND).map(file => ({
      id: `material:${file.id}`, type: 'material' as const, title: file.fileName,
      subtitle: file.subject, href: `/pair-space/${file.lessonId}`, date: file.startDate,
    })));

    const cappedResults = (['lesson', 'teacher', 'room', 'preparation', 'material'] as const)
      .flatMap(type => results.filter(result => result.type === type).slice(0, MAX_RESULTS_PER_KIND));
    return { query: term, results: cappedResults.slice(0, 40) };
  }

  private async resolveScope(user: AuthenticatedUser): Promise<SearchScope> {
    if (user.role === UserRole.STUDENT) {
      if (!user.groupId) throw new ForbiddenException('Для поиска требуется учебная группа');
      let groupId = user.groupId;
      let sourceGroupId: string | undefined;
      if (/^\d+$/.test(groupId)) {
        sourceGroupId = groupId;
        const group = await this.groupRepository.findOne({ where: { universityId: requireUniversityId(user), externalId: groupId } });
        if (group) {
          groupId = group.id;
          sourceGroupId = group.externalId || undefined;
        }
      } else {
        const group = await this.groupRepository.findOne({ where: { id: groupId, universityId: requireUniversityId(user) } });
        if (group?.externalId) sourceGroupId = group.externalId;
      }
      if (sourceGroupId) {
        const university = await this.universityRepository.findOne({ where: { id: requireUniversityId(user) } });
        if (university?.name !== SIBIT_UNIVERSITY.name || university.city !== SIBIT_UNIVERSITY.city) sourceGroupId = undefined;
      }
      return { universityId: requireUniversityId(user), groupId, sourceGroupId };
    }
    if (user.role === UserRole.TEACHER) return { universityId: requireUniversityId(user), teacherId: user.id };
    return { universityId: requireUniversityId(user) };
  }
}
