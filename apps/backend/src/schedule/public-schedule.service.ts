import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { ScheduleReadService } from './schedule-read.service';
import { PublicScheduleLessonsQueryDto } from './dto/public-schedule-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 31;
const READ_UNIVERSITIES = { tables: ['universities'], organizationIds: null, replaceActor: true };

@Injectable()
export class PublicScheduleService {
  constructor(
    private readonly tenant: TenantContext,
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    private readonly scheduleRead: ScheduleReadService,
  ) {}

  listUniversities() {
    return this.tenant.runWithDatabaseAccess(READ_UNIVERSITIES, () =>
      this.universities.find({
        where: { status: 'active', publicScheduleEnabled: true },
        select: { id: true, name: true, city: true },
        order: { name: 'ASC', city: 'ASC' },
      }),
    );
  }

  async listGroups(organizationId: string) {
    await this.requirePublishedUniversity(organizationId);
    return this.tenant.runWithDatabaseAccess(
      { tables: ['groups', 'faculties'], organizationIds: [organizationId], replaceActor: true },
      async () => {
        const rows = await this.groups.createQueryBuilder('group')
          .leftJoin(Faculty, 'faculty', 'faculty.id = group.facultyId AND faculty.organizationId = group.organizationId')
          .select('group.id', 'id')
          .addSelect('group.name', 'name')
          .addSelect('faculty.name', 'faculty')
          .where('group.organizationId = :organizationId', { organizationId })
          .orderBy('group.name', 'ASC')
          .getRawMany<{ id: string; name: string; faculty: string | null }>();
        return rows.map((row) => ({ id: row.id, name: row.name, ...(row.faculty ? { faculty: row.faculty } : {}) }));
      },
    );
  }

  async listLessons(query: PublicScheduleLessonsQueryDto) {
    this.range(query.from, query.to);
    await this.requirePublishedUniversity(query.organizationId);

    return this.tenant.runWithDatabaseAccess(
      { tables: ['groups', 'faculties', 'lessons', 'lesson_occurrences', 'lesson_series', 'users'], organizationIds: [query.organizationId], replaceActor: true },
      async () => {
        const group = await this.groups.findOne({
          where: { id: query.groupId, organizationId: query.organizationId },
          select: { id: true },
        });
        if (!group) throw new NotFoundException('Публичное расписание не найдено.');

        const result = await this.scheduleRead.readRange(
          { id: 'public-schedule', role: UserRole.STUDENT, organizationId: query.organizationId, groupId: query.groupId },
          { from: query.from, to: query.to, groupId: query.groupId },
        );
        return result.days.flatMap((day) => day.lessons
          .filter((lesson) => lesson.state !== 'cancelled')
          .map((lesson) => ({
            lessonId: lesson.lessonId ?? lesson.id,
            date: lesson.date,
            dayName: new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${lesson.date}T12:00:00.000Z`)),
            startTime: lesson.startTime,
            endTime: lesson.endTime,
            pairNumber: lesson.pairNumber ?? 0,
            subject: lesson.subject,
            ...(lesson.subjectType ? { subjectType: lesson.subjectType } : {}),
            ...(lesson.teacherName ? { teacher: lesson.teacherName } : {}),
            ...(lesson.room ? { room: lesson.room } : {}),
            weekType: lesson.weekType ?? 'both',
            isReplacement: lesson.isReplacement ?? false,
          })));
      },
    );
  }

  private async requirePublishedUniversity(organizationId: string): Promise<Pick<University, 'id'>> {
    const university = await this.tenant.runWithDatabaseAccess(READ_UNIVERSITIES, () =>
      this.universities.findOne({
        where: { id: organizationId, status: 'active', publicScheduleEnabled: true },
        select: { id: true },
      }),
    );
    if (!university) throw new NotFoundException('Публичное расписание не найдено.');
    return university;
  }

  private range(from: string, to: string): void {
    const startMs = Date.parse(`${from}T00:00:00.000Z`);
    const endMs = Date.parse(`${to}T00:00:00.000Z`);
    const dayCount = Math.floor((endMs - startMs) / DAY_MS) + 1;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || dayCount < 1 || dayCount > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Период должен включать от 1 до ${MAX_RANGE_DAYS} календарных дней.`);
    }
  }
}
