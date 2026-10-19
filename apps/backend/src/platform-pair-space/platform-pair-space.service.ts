import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { Announcement } from '../pair-space/entities/announcement.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { DiscussionMessage } from '../pair-space/entities/discussion-message.entity';
import { HomeworkSubmission } from '../pair-space/entities/homework-submission.entity';
import { HomeworkProgress } from '../pair-space/entities/homework-progress.entity';
import { PersonalLessonNote } from '../pair-space/entities/personal-lesson-note.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Course } from '../academic/entities/course.entity';
import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSpace } from '../academic/entities/lesson-space.entity';
import { CourseSpace } from '../academic/entities/course-space.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { PlatformService } from '../platform/platform.service';
import { PlatformPairSpaceAnnouncementPatchDto, PlatformPairSpaceAnnouncementQueryDto, PlatformPairSpacePatchDto, PlatformPairSpaceQueryDto } from './platform-pair-space.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };
type AnnouncementSummary = {
  id: string;
  pairSpaceId: string;
  lessonId: string;
  universityId: string;
  universityName: string;
  subject: string;
  groupName: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  text: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};
type PairSpaceSummary = {
  id: string;
  universityId: string;
  universityName: string | null;
  lessonId: string;
  lessonSubject: string | null;
  canonicalCourseId: string | null;
  canonicalOccurrenceId: string | null;
  groupId: string | null;
  groupName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  courseId: string | null;
  courseName: string | null;
  lessonOccurrenceId: string | null;
  occurrenceStartsAt: Date | null;
  lessonSpaceId: string | null;
  lessonSpaceName: string | null;
  lessonSpaceOccurrenceId: string | null;
  subject: string;
  date: Date;
  pairNumber: number;
  teacherLabel: string | null;
  groupLabel: string | null;
  room: string | null;
  isActive: boolean;
  source: string | null;
  syncStatus: string;
  lastSyncedAt: Date | null;
  activeUntil: Date | null;
  announcementCount: string;
  homeworkCount: string;
  fileCount: string;
  messageCount: string;
  submissionCount: string;
  progressCount: string;
  noteCount: string;
  lessonExists: boolean;
  universityExists: boolean;
  groupExists: boolean;
  teacherLinkValid: boolean;
  courseLinkValid: boolean;
  occurrenceLinkValid: boolean;
  lessonSpaceLinkValid: boolean;
  courseSpaceLinkValid: boolean;
  subjectMatchesLesson: boolean;
};

@Injectable()
export class PlatformPairSpaceService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async spaces(query: PlatformPairSpaceQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('pairspace-content.read');
    return this.db.transaction(async manager => {
      const qb = this.pairSpaceQuery(manager);
      if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
      if (query.universityId) qb.andWhere('pairSpace.universityId = :universityId', { universityId: query.universityId });
      if (!access.owner && access.universityIds !== null) {
        if (!access.universityIds.length) qb.andWhere('1 = 0');
        else qb.andWhere('pairSpace.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
      }
      if (query.isActive !== undefined) qb.andWhere('pairSpace.isActive = :isActive', { isActive: query.isActive });
      if (query.q?.trim()) {
        const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
        qb.andWhere("(pairSpace.id::text ILIKE :q ESCAPE E'\\\\' OR pairSpace.lessonId::text ILIKE :q ESCAPE E'\\\\' OR pairSpace.subject ILIKE :q ESCAPE E'\\\\' OR lesson.subject ILIKE :q ESCAPE E'\\\\' OR COALESCE(lessonGroup.name, '') ILIKE :q ESCAPE E'\\\\' OR COALESCE(pairSpace.group, '') ILIKE :q ESCAPE E'\\\\' OR COALESCE(pairSpace.teacherName, '') ILIKE :q ESCAPE E'\\\\' OR COALESCE(pairSpace.room, '') ILIKE :q ESCAPE E'\\\\' OR COALESCE(course.name, '') ILIKE :q ESCAPE E'\\\\' OR COALESCE(teacher.email, '') ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', teacher.firstName, teacher.lastName) ILIKE :q ESCAPE E'\\\\')", { q: pattern });
      }
      const total = await qb.clone().getCount();
      const rows = await qb.orderBy('pairSpace.date', 'DESC').addOrderBy('pairSpace.pairNumber', 'ASC').addOrderBy('pairSpace.id', 'ASC')
        .skip((query.page - 1) * query.limit).take(query.limit).getRawMany<PairSpaceSummary>();
      await this.auditRead(manager, 'platform.pair_space.search', 'pair_space_search', 'search', access.actorId, {
        recordIds: rows.map(row => row.id), universityIds: [...new Set(rows.map(row => row.universityId))],
        queryEntered: Boolean(query.q?.trim()), isActive: query.isActive ?? null,
        page: query.page, limit: query.limit, resultCount: rows.length, total,
      }, context);
      return toPaginatedResponse(rows.map(row => this.presentPairSpace(row)), total, query);
    });
  }

  async space(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('pairspace-content.read');
    return this.db.transaction(async manager => {
      const row = await this.pairSpaceQuery(manager).where('pairSpace.id = :id', { id }).getRawOne<PairSpaceSummary>();
      if (!row) throw new NotFoundException('Пространство пары не найдено.');
      this.platform.assertUniversityScope(access, row.universityId);
      await this.auditRead(manager, 'platform.pair_space.viewed', 'pair_space', id, access.actorId, {
        universityId: row.universityId, lessonId: row.lessonId, courseId: row.courseId,
        lessonOccurrenceId: row.lessonOccurrenceId, lessonSpaceId: row.lessonSpaceId,
        childCounts: { announcements: Number(row.announcementCount), homeworks: Number(row.homeworkCount), submissions: Number(row.submissionCount), progressRecords: Number(row.progressCount), notes: Number(row.noteCount), files: Number(row.fileCount), messages: Number(row.messageCount) },
        integrity: this.pairSpaceIntegrity(row), result: 'viewed',
      }, context);
      return this.presentPairSpace(row);
    });
  }

  async patchSpace(id: string, dto: PlatformPairSpacePatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('pairspace-content.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const space = await manager.findOne(PairSpace, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!space) throw new NotFoundException('Пространство пары не найдено.');
      this.platform.assertUniversityScope(access, space.universityId);
      const university = await manager.findOne(University, { where: { id: space.universityId }, select: ['id'], lock: { mode: 'pessimistic_read' } });
      const lesson = await manager.findOne(Lesson, { where: { id: space.lessonId, universityId: space.universityId }, select: ['id', 'universityId'], lock: { mode: 'pessimistic_read' } });
      if (!university || !lesson) throw new BadRequestException('Пространство пары не связано с существующим занятием того же университета.');
      if (space.isActive === dto.isActive) throw new ConflictException('Новое состояние совпадает с текущим.');
      const oldValues: JsonObject = { isActive: space.isActive };
      space.isActive = dto.isActive;
      const updated = await manager.save(PairSpace, space);
      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId, action: 'platform.pair_space.updated', entity: 'pair_space', entityId: id,
        oldValues,
        newValues: { isActive: updated.isActive, reason: dto.reason.trim(), universityId: updated.universityId, lessonId: updated.lessonId, result: 'updated' },
        ...(context.ip ? { ip: context.ip } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
      }));
      const summary = await this.pairSpaceQuery(manager).where('pairSpace.id = :id', { id }).getRawOne<PairSpaceSummary>();
      if (!summary) throw new NotFoundException('Пространство пары не найдено после изменения.');
      return this.presentPairSpace(summary);
    });
  }

  private pairSpaceQuery(manager: EntityManager): SelectQueryBuilder<PairSpace> {
    return manager.getRepository(PairSpace).createQueryBuilder('pairSpace')
      .leftJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
      .leftJoin(University, 'university', 'university.id = pairSpace.universityId')
      .leftJoin(Group, 'lessonGroup', 'lessonGroup.id = lesson.groupId AND lessonGroup.universityId = lesson.universityId')
      .leftJoin(User, 'teacher', 'teacher.id = lesson.teacherId AND teacher.universityId = lesson.universityId AND teacher.role = :teacherRole', { teacherRole: UserRole.TEACHER })
      .leftJoin(Course, 'course', 'course.id = pairSpace.courseId AND course.universityId = pairSpace.universityId')
      .leftJoin(LessonOccurrence, 'occurrence', 'occurrence.id = pairSpace.lessonOccurrenceId AND occurrence.universityId = pairSpace.universityId')
      .leftJoin(LessonSpace, 'lessonSpace', 'lessonSpace.id = pairSpace.lessonSpaceId AND lessonSpace.universityId = pairSpace.universityId')
      .leftJoin(CourseSpace, 'courseSpace', 'courseSpace.id = lessonSpace.courseSpaceId AND courseSpace.universityId = pairSpace.universityId')
      .select('pairSpace.id', 'id').addSelect('pairSpace.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('pairSpace.lessonId', 'lessonId').addSelect('lesson.subject', 'lessonSubject')
      .addSelect('lesson.courseId', 'canonicalCourseId').addSelect('lesson.occurrenceId', 'canonicalOccurrenceId')
      .addSelect('lesson.groupId', 'groupId').addSelect('lessonGroup.name', 'groupName')
      .addSelect('lesson.teacherId', 'teacherId').addSelect("concat_ws(' ', teacher.firstName, teacher.lastName)", 'teacherName')
      .addSelect('pairSpace.courseId', 'courseId').addSelect('course.name', 'courseName')
      .addSelect('pairSpace.lessonOccurrenceId', 'lessonOccurrenceId').addSelect('occurrence.startsAt', 'occurrenceStartsAt')
      .addSelect('pairSpace.lessonSpaceId', 'lessonSpaceId').addSelect('lessonSpace.name', 'lessonSpaceName').addSelect('lessonSpace.occurrenceId', 'lessonSpaceOccurrenceId')
      .addSelect('pairSpace.subject', 'subject').addSelect('pairSpace.date', 'date').addSelect('pairSpace.pairNumber', 'pairNumber')
      .addSelect('pairSpace.teacherName', 'teacherLabel').addSelect('pairSpace.group', 'groupLabel').addSelect('pairSpace.room', 'room')
      .addSelect('pairSpace.isActive', 'isActive').addSelect('pairSpace.source', 'source').addSelect('pairSpace.syncStatus', 'syncStatus')
      .addSelect('pairSpace.lastSyncedAt', 'lastSyncedAt').addSelect('pairSpace.activeUntil', 'activeUntil')
      .addSelect(subQuery => subQuery.select('COUNT(*)').from(Announcement, 'childAnnouncement').where('childAnnouncement.pairSpaceId = pairSpace.id'), 'announcementCount')
      .addSelect(subQuery => subQuery.select('COUNT(*)').from(Homework, 'childHomework').where('childHomework.pairSpaceId = pairSpace.id'), 'homeworkCount')
      .addSelect(subQuery => subQuery.select('COUNT(*)').from(FileAttachment, 'childFile').where('childFile.pairSpaceId = pairSpace.id'), 'fileCount')
      .addSelect(subQuery => subQuery.select('COUNT(*)').from(DiscussionMessage, 'childMessage').where('childMessage.pairSpaceId = pairSpace.id'), 'messageCount')
      .addSelect(subQuery => subQuery.select('COUNT(*)').from(HomeworkSubmission, 'childSubmission').innerJoin(Homework, 'submissionHomework', 'submissionHomework.id = childSubmission.homeworkId').where('submissionHomework.pairSpaceId = pairSpace.id'), 'submissionCount')
      .addSelect(subQuery => subQuery.select('COUNT(*)').from(HomeworkProgress, 'childProgress').innerJoin(Homework, 'progressHomework', 'progressHomework.id = childProgress.homeworkId').where('progressHomework.pairSpaceId = pairSpace.id'), 'progressCount')
      .addSelect(subQuery => subQuery.select('COUNT(*)').from(PersonalLessonNote, 'childNote').where('childNote.pairSpaceId = pairSpace.id'), 'noteCount')
      .addSelect('CASE WHEN lesson.id IS NULL THEN false ELSE true END', 'lessonExists')
      .addSelect('CASE WHEN university.id IS NULL THEN false ELSE true END', 'universityExists')
      .addSelect('CASE WHEN lesson.id IS NULL OR lessonGroup.id IS NOT NULL THEN true ELSE false END', 'groupExists')
      .addSelect('CASE WHEN lesson.teacherId IS NULL OR teacher.id IS NOT NULL THEN true ELSE false END', 'teacherLinkValid')
      .addSelect('CASE WHEN pairSpace.courseId IS NULL AND lesson.courseId IS NULL THEN true WHEN pairSpace.courseId = lesson.courseId AND course.id IS NOT NULL THEN true ELSE false END', 'courseLinkValid')
      .addSelect('CASE WHEN pairSpace.lessonOccurrenceId IS NULL AND lesson.occurrenceId IS NULL THEN true WHEN pairSpace.lessonOccurrenceId = lesson.occurrenceId AND occurrence.id IS NOT NULL THEN true ELSE false END', 'occurrenceLinkValid')
      .addSelect('CASE WHEN pairSpace.lessonSpaceId IS NULL THEN true WHEN lessonSpace.id IS NOT NULL AND (pairSpace.lessonOccurrenceId IS NULL OR lessonSpace.occurrenceId = pairSpace.lessonOccurrenceId) THEN true ELSE false END', 'lessonSpaceLinkValid')
      .addSelect('CASE WHEN pairSpace.lessonSpaceId IS NULL THEN true WHEN courseSpace.id IS NOT NULL AND courseSpace.courseId = pairSpace.courseId THEN true ELSE false END', 'courseSpaceLinkValid')
      .addSelect('CASE WHEN lesson.id IS NULL OR pairSpace.subject = lesson.subject THEN true ELSE false END', 'subjectMatchesLesson');
  }

  private presentPairSpace(row: PairSpaceSummary) {
    return {
      id: row.id, universityId: row.universityId, universityName: row.universityName,
      lessonId: row.lessonId, lesson: row.lessonExists ? { id: row.lessonId, subject: row.lessonSubject, groupId: row.groupId, groupName: row.groupName, teacherId: row.teacherId, teacherName: row.teacherName } : null,
      courseId: row.courseId, courseName: row.courseName,
      lessonOccurrenceId: row.lessonOccurrenceId, occurrenceStartsAt: row.occurrenceStartsAt,
      lessonSpaceId: row.lessonSpaceId, lessonSpaceName: row.lessonSpaceName,
      subject: row.subject, date: row.date, pairNumber: row.pairNumber, teacherName: row.teacherLabel,
      group: row.groupLabel, room: row.room, isActive: row.isActive,
      synchronization: { source: row.source, status: row.syncStatus, lastSyncedAt: row.lastSyncedAt, activeUntil: row.activeUntil },
      childCounts: { announcements: Number(row.announcementCount), homeworks: Number(row.homeworkCount), submissions: Number(row.submissionCount), progressRecords: Number(row.progressCount), notes: Number(row.noteCount), files: Number(row.fileCount), messages: Number(row.messageCount) },
      integrity: this.pairSpaceIntegrity(row),
    };
  }

  private pairSpaceIntegrity(row: PairSpaceSummary) {
    return {
      universityExists: row.universityExists,
      lessonExistsInUniversity: row.lessonExists,
      groupExistsInUniversity: row.groupExists,
      teacherLinkValid: row.teacherLinkValid,
      courseLinkValid: row.courseLinkValid,
      occurrenceLinkValid: row.occurrenceLinkValid,
      lessonSpaceLinkValid: row.lessonSpaceLinkValid,
      courseSpaceLinkValid: row.courseSpaceLinkValid,
      subjectMatchesLesson: row.subjectMatchesLesson,
    };
  }

  async announcements(query: PlatformPairSpaceAnnouncementQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('pairspace-content.read');
    return this.db.transaction(async manager => {
      const qb = this.summaryQuery(manager);
      this.applyFilters(qb, query);
      if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
      if (!access.owner && access.universityIds !== null) {
        if (!access.universityIds.length) qb.andWhere('1 = 0');
        else qb.andWhere('pairSpace.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
      }
      const total = await qb.clone().getCount();
      const rows = await qb.orderBy('announcement.createdAt', 'DESC').addOrderBy('announcement.id', 'DESC')
        .skip((query.page - 1) * query.limit).take(query.limit).getRawMany<AnnouncementSummary>();
      await this.auditRead(manager, 'platform.pair_space_announcement.search', 'pair_space_announcement_search', 'search', access.actorId, {
        recordIds: rows.map(row => row.id), universityIds: [...new Set(rows.map(row => row.universityId))],
        groupNames: [...new Set(rows.map(row => row.groupName))], authorIds: [...new Set(rows.map(row => row.authorId))],
        ...(query.universityId ? { universityId: query.universityId } : {}),
        queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total,
      }, context);
      return toPaginatedResponse(rows, total, query);
    });
  }

  async announcement(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('pairspace-content.read');
    return this.db.transaction(async manager => {
      const detail = await this.summaryQuery(manager).where('announcement.id = :id', { id }).getRawOne<AnnouncementSummary>();
      if (!detail) throw new NotFoundException('Объявление PairSpace не найдено.');
      this.platform.assertUniversityScope(access, detail.universityId);
      await this.auditRead(manager, 'platform.pair_space_announcement.viewed', 'pair_space_announcement', detail.id, access.actorId, {
        pairSpaceId: detail.pairSpaceId, lessonId: detail.lessonId, universityId: detail.universityId,
        groupName: detail.groupName, authorId: detail.authorId, result: 'viewed',
      }, context);
      return detail;
    });
  }

  async patchAnnouncement(id: string, dto: PlatformPairSpaceAnnouncementPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('pairspace-content.write');
    this.assertReason(dto.reason);
    if (dto.text === undefined && dto.isPinned === undefined) {
      throw new BadRequestException('Укажите текст объявления или состояние закрепления.');
    }

    return this.db.transaction(async manager => {
      const announcement = await manager.findOne(Announcement, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!announcement) throw new NotFoundException('Объявление PairSpace не найдено.');
      const resource = await this.assertAnnouncementContext(manager, announcement);
      this.platform.assertUniversityScope(access, resource.universityId);
      const nextText = dto.text === undefined ? announcement.text : dto.text.trim();
      const nextIsPinned = dto.isPinned ?? announcement.isPinned;
      if (!nextText) throw new BadRequestException('Текст объявления не может быть пустым.');
      if (nextText === announcement.text && nextIsPinned === announcement.isPinned) {
        throw new ConflictException('Исправленные значения совпадают с текущими.');
      }

      const oldValues: JsonObject = { text: announcement.text, isPinned: announcement.isPinned };
      announcement.text = nextText;
      announcement.isPinned = nextIsPinned;
      const updated = await manager.save(Announcement, announcement);
      const newValues: JsonObject = {
        text: updated.text,
        isPinned: updated.isPinned,
        reason: dto.reason.trim(),
        pairSpaceId: resource.pairSpaceId,
        lessonId: resource.lessonId,
        universityId: resource.universityId,
        groupId: resource.groupId,
        groupName: resource.groupName,
        authorId: updated.authorId,
        result: 'corrected',
      };
      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId,
        action: 'platform.pair_space_announcement.corrected',
        entity: 'pair_space_announcement',
        entityId: updated.id,
        oldValues,
        newValues,
        ...(context.ip ? { ip: context.ip } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
      }));
      return this.summaryQuery(manager).where('announcement.id = :id', { id: updated.id }).getRawOne<AnnouncementSummary>();
    });
  }

  private summaryQuery(manager: EntityManager): SelectQueryBuilder<Announcement> {
    return manager.getRepository(Announcement).createQueryBuilder('announcement')
      .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = announcement.pairSpaceId')
      .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
      .innerJoin(University, 'university', 'university.id = pairSpace.universityId')
      .innerJoin(Group, 'lessonGroup', 'lessonGroup.id = lesson.groupId AND lessonGroup.universityId = lesson.universityId')
      .innerJoin(User, 'author', 'author.id = announcement.authorId')
      .select('announcement.id', 'id')
      .addSelect('pairSpace.id', 'pairSpaceId')
      .addSelect('lesson.id', 'lessonId')
      .addSelect('pairSpace.universityId', 'universityId')
      .addSelect('university.name', 'universityName')
      .addSelect('lesson.subject', 'subject')
      .addSelect('lessonGroup.name', 'groupName')
      .addSelect('announcement.authorId', 'authorId')
      .addSelect("concat_ws(' ', author.firstName, author.lastName)", 'authorName')
      .addSelect('author.email', 'authorEmail')
      .addSelect('announcement.text', 'text')
      .addSelect('announcement.isPinned', 'isPinned')
      .addSelect('announcement.createdAt', 'createdAt')
      .addSelect('announcement.updatedAt', 'updatedAt');
  }

  private applyFilters(qb: SelectQueryBuilder<Announcement>, query: PlatformPairSpaceAnnouncementQueryDto): void {
    if (query.universityId) qb.andWhere('pairSpace.universityId = :universityId', { universityId: query.universityId });
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(announcement.id::text ILIKE :q ESCAPE E'\\\\' OR announcement.text ILIKE :q ESCAPE E'\\\\' OR lesson.subject ILIKE :q ESCAPE E'\\\\' OR lessonGroup.name ILIKE :q ESCAPE E'\\\\' OR author.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', author.firstName, author.lastName) ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
  }

  private async assertAnnouncementContext(manager: EntityManager, announcement: Announcement): Promise<{
    pairSpaceId: string; lessonId: string; universityId: string; groupId: string; groupName: string;
  }> {
    const pairSpace = await manager.findOne(PairSpace, {
      where: { id: announcement.pairSpaceId }, select: ['id', 'lessonId', 'universityId'], lock: { mode: 'pessimistic_read' },
    });
    if (!pairSpace) throw new BadRequestException('Объявление не связано с существующим пространством пары.');
    const lesson = await manager.findOne(Lesson, {
      where: { id: pairSpace.lessonId, universityId: pairSpace.universityId },
      select: ['id', 'universityId', 'groupId'], lock: { mode: 'pessimistic_read' },
    });
    if (!lesson) throw new BadRequestException('Пространство пары не связано с занятием того же университета.');
    const university = await manager.findOne(University, {
      where: { id: pairSpace.universityId }, select: ['id'], lock: { mode: 'pessimistic_read' },
    });
    if (!university) throw new BadRequestException('Университет объявления не найден.');
    const group = await manager.findOne(Group, {
      where: { id: lesson.groupId, universityId: lesson.universityId },
      select: ['id', 'name', 'universityId'], lock: { mode: 'pessimistic_read' },
    });
    if (!group) throw new BadRequestException('Занятие не связано с группой того же университета.');
    const author = await manager.findOne(User, { where: { id: announcement.authorId }, select: ['id'], lock: { mode: 'pessimistic_read' } });
    if (!author) throw new BadRequestException('Автор объявления не найден.');
    return { pairSpaceId: pairSpace.id, lessonId: lesson.id, universityId: university.id, groupId: group.id, groupName: group.name };
  }

  private async auditRead(manager: EntityManager, action: string, entity: string, entityId: string, actorId: string, values: JsonObject, context: RequestAuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId, action, entity, entityId, newValues: values,
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private assertReason(reason: string): void {
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
  }
}
