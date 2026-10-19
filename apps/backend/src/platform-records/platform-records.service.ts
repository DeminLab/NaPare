import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { PlatformService } from '../platform/platform.service';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject, JsonValue } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { Group } from '../users/entities/group.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { Favorite, FavoriteKind } from '../favorites/entities/favorite.entity';
import { PersonalLessonNote } from '../pair-space/entities/personal-lesson-note.entity';
import { HomeworkProgress, HomeworkProgressState, HomeworkProgressSubtask } from '../pair-space/entities/homework-progress.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import {
  PlatformFavoriteDto,
  PlatformFavoritePatchDto,
  PlatformHomeworkProgressDto,
  PlatformHomeworkProgressPatchDto,
  PlatformNotificationPreferencesDto,
  PlatformNotificationPreferencesPatchDto,
  PlatformPersonalLessonNoteDto,
  PlatformPersonalLessonNotePatchDto,
  PlatformPersonalRecordDeleteDto,
  PlatformPersonalRecordsQueryDto,
} from './platform-records.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };
type PreferenceFields = Pick<NotificationPreference,
  'scheduleChanges' | 'cancellations' | 'roomChanges' | 'homeworkCreated' | 'deadlines' | 'messages' | 'announcements' | 'systemAlerts' | 'telegramEnabled' | 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'timeZone'>;

const PREFERENCE_FIELDS = [
  'scheduleChanges', 'cancellations', 'roomChanges', 'homeworkCreated', 'deadlines', 'messages',
  'announcements', 'systemAlerts', 'telegramEnabled', 'quietHoursEnabled', 'quietHoursStart',
  'quietHoursEnd', 'timeZone',
] as const;

@Injectable()
export class PlatformRecordsService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async users(query: PlatformPersonalRecordsQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.read');
    const qb = this.db.getRepository(User).createQueryBuilder('u')
      .leftJoin(University, 'university', 'university.id = u.universityId')
      .select('u.id', 'id')
      .addSelect('u.email', 'email')
      .addSelect('u.firstName', 'firstName')
      .addSelect('u.lastName', 'lastName')
      .addSelect('u.role', 'role')
      .addSelect('u.universityId', 'universityId')
      .addSelect('university.name', 'universityName')
      .addSelect('u.groupId', 'groupId')
      .addSelect('u.isActive', 'isActive');
    if (query.universityId) {
      this.platform.assertUniversityScope(access, query.universityId);
      qb.andWhere('u.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('u.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim());
    const total = await qb.clone().getCount();
    const data = await qb.orderBy('u.createdAt', 'DESC').addOrderBy('u.id', 'ASC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawMany();
    await this.db.getRepository(AuditLog).save({
      userId: access.actorId,
      action: 'platform.personal_data.users_searched',
      entity: 'personal_data_user_search',
      entityId: 'search',
      newValues: {
        universityId: query.universityId ?? null,
        filters: { queryPresent: Boolean(query.q?.trim()), role: query.role ?? null, page: query.page, limit: query.limit },
        total,
        resultCount: data.length,
        targetUserIds: data.map(row => row.id),
      },
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 512),
    });
    return toPaginatedResponse(data, total, query);
  }

  async userRecords(userId: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.read');
    const sections = ['notificationPreferences', 'favorites', 'lessonNotes', 'homeworkProgress'];
    return this.db.transaction(async manager => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'universityId', 'groupId', 'isActive', 'createdAt', 'updatedAt'],
      });
      if (!user) throw new NotFoundException('Пользователь не найден.');
      this.platform.assertUniversityScope(access, user.universityId);

      const [university, group, preferences, favorites, lessonNotes, homeworkProgress] = await Promise.all([
        user.universityId ? manager.findOne(University, { where: { id: user.universityId }, select: ['id', 'name', 'city'] }) : null,
        user.universityId && user.groupId
          ? manager.getRepository(Group).createQueryBuilder('g').select(['g.id', 'g.name', 'g.externalId'])
            .where('g.universityId = :universityId AND (g.id::text = :groupId OR g."externalId" = :groupId)', { universityId: user.universityId, groupId: user.groupId }).getOne()
          : null,
        manager.getRepository(NotificationPreference).createQueryBuilder('preference')
          .innerJoin(University, 'university', 'university.id = preference.universityId')
          .where('preference.userId = :userId', { userId })
          .andWhere(access.owner || access.universityIds === null ? '1 = 1' : access.universityIds.length ? 'preference.universityId IN (:...allowedUniversityIds)' : '1 = 0', { allowedUniversityIds: access.universityIds ?? [] })
          .orderBy('preference.updatedAt', 'DESC').addOrderBy('preference.id', 'ASC').getMany(),
        manager.getRepository(Favorite).createQueryBuilder('favorite')
          .innerJoin(University, 'university', 'university.id = favorite.universityId')
          .where('favorite.userId = :userId', { userId })
          .andWhere(access.owner || access.universityIds === null ? '1 = 1' : access.universityIds.length ? 'favorite.universityId IN (:...allowedUniversityIds)' : '1 = 0', { allowedUniversityIds: access.universityIds ?? [] })
          .orderBy('favorite.kind', 'ASC').addOrderBy('favorite.label', 'ASC').addOrderBy('favorite.id', 'ASC').getMany(),
        manager.getRepository(PersonalLessonNote).createQueryBuilder('note')
          .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = note.pairSpaceId AND pairSpace.universityId = note.universityId')
          .innerJoin(University, 'university', 'university.id = note.universityId')
          .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
          .where('note.userId = :userId', { userId })
          .andWhere(access.owner || access.universityIds === null ? '1 = 1' : access.universityIds.length ? 'note.universityId IN (:...allowedUniversityIds)' : '1 = 0', { allowedUniversityIds: access.universityIds ?? [] })
          .select('note.id', 'id').addSelect('note.universityId', 'universityId').addSelect('university.name', 'universityName').addSelect('note.pairSpaceId', 'pairSpaceId')
          .addSelect('note.content', 'content').addSelect('note.createdAt', 'createdAt').addSelect('note.updatedAt', 'updatedAt')
          .addSelect('lesson.id', 'lessonId').addSelect('lesson.subject', 'lessonSubject').addSelect('lesson.startDate', 'lessonDate').addSelect('lesson.pairNumber', 'lessonPairNumber')
          .orderBy('note.updatedAt', 'DESC').addOrderBy('note.id', 'ASC').getRawMany<{
            id: string; universityId: string; universityName: string; pairSpaceId: string; content: string; createdAt: Date; updatedAt: Date;
            lessonId: string; lessonSubject: string; lessonDate: Date; lessonPairNumber: number;
          }>(),
        manager.getRepository(HomeworkProgress).createQueryBuilder('progress')
          .innerJoin(Homework, 'homework', 'homework.id = progress.homeworkId')
          .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = homework.pairSpaceId')
          .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
          .where('progress.studentId = :userId AND pairSpace.universityId = :universityId', { userId, universityId: user.universityId ?? '' })
          .andWhere(access.owner || access.universityIds === null ? '1 = 1' : access.universityIds.length ? 'pairSpace.universityId IN (:...allowedUniversityIds)' : '1 = 0', { allowedUniversityIds: access.universityIds ?? [] })
          .select('progress.id', 'id').addSelect('progress.homeworkId', 'homeworkId').addSelect('progress.state', 'state')
          .addSelect('progress.subtasks', 'subtasks').addSelect('progress.createdAt', 'createdAt').addSelect('progress.updatedAt', 'updatedAt')
          .addSelect('homework.title', 'homeworkTitle').addSelect('homework.deadline', 'homeworkDeadline')
          .addSelect('pairSpace.id', 'pairSpaceId').addSelect('pairSpace.universityId', 'pairSpaceUniversityId')
          .addSelect('pairSpace.subject', 'pairSpaceSubject').addSelect('pairSpace.date', 'pairSpaceDate').addSelect('pairSpace.pairNumber', 'pairSpacePairNumber')
          .orderBy('progress.updatedAt', 'DESC').addOrderBy('progress.id', 'ASC').getRawMany<{
            id: string; homeworkId: string; state: HomeworkProgressState; subtasks: HomeworkProgressSubtask[]; createdAt: Date; updatedAt: Date;
            homeworkTitle: string; homeworkDeadline: Date | null; pairSpaceId: string; pairSpaceUniversityId: string;
            pairSpaceSubject: string; pairSpaceDate: Date; pairSpacePairNumber: number;
          }>(),
      ]);

      const normalizedNotes = lessonNotes.map(({ lessonId, lessonSubject, lessonDate, lessonPairNumber, ...note }) => ({
        ...note, lesson: { id: lessonId, subject: lessonSubject, date: lessonDate, pairNumber: lessonPairNumber },
      }));
      const validProgress = homeworkProgress.map(({ homeworkTitle, homeworkDeadline, pairSpaceId, pairSpaceUniversityId, pairSpaceSubject, pairSpaceDate, pairSpacePairNumber, ...progress }) => ({
        ...progress,
        homework: { id: progress.homeworkId, title: homeworkTitle, deadline: homeworkDeadline },
        pairSpace: { id: pairSpaceId, universityId: pairSpaceUniversityId, subject: pairSpaceSubject, date: pairSpaceDate, pairNumber: pairSpacePairNumber },
      }));
      const settings = preferences.map(({ id, userId: ownerId, universityId, updatedAt, ...values }) => ({ id, userId: ownerId, universityId, updatedAt, settings: values }));

      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId,
        action: 'platform.personal_data.viewed',
        entity: 'personal_data',
        entityId: userId,
        newValues: {
          targetUserId: userId,
          universityId: user.universityId,
          sections,
          recordCounts: {
            notificationPreferences: preferences.length,
            favorites: favorites.length,
            lessonNotes: normalizedNotes.length,
            homeworkProgress: validProgress.length,
          },
        },
        ip: context.ip,
        userAgent: context.userAgent?.slice(0, 512),
      }));

      return {
        user: {
          id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role,
          universityId: user.universityId, groupId: user.groupId, isActive: user.isActive,
          createdAt: user.createdAt, updatedAt: user.updatedAt,
          university: university ? { id: university.id, name: university.name, city: university.city } : null,
          group: group ? { id: group.id, name: group.name, externalId: group.externalId } : user.groupId ? { id: null, name: user.groupId, externalId: user.groupId } : null,
        },
        sections: {
          notificationPreferences: settings,
          favorites,
          lessonNotes: normalizedNotes,
          homeworkProgress: validProgress,
        },
        meta: {
          counts: {
            notificationPreferences: settings.length,
            favorites: favorites.length,
            lessonNotes: normalizedNotes.length,
            homeworkProgress: validProgress.length,
          },
          accessedAt: new Date().toISOString(),
        },
      };
    });
  }

  async putPreferences(userId: string, dto: PlatformNotificationPreferencesDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    const patch = this.pick(dto, PREFERENCE_FIELDS);
    if (!Object.keys(patch).length) throw new BadRequestException('Укажите хотя бы одну настройку уведомлений.');
    this.assertNonNull(patch, ['quietHoursStart', 'quietHoursEnd']);
    this.assertTimeZone(patch.timeZone as string | null | undefined);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      await this.assertUserUniversity(manager, user, dto.universityId);
      const repository = manager.getRepository(NotificationPreference);
      let record = await repository.findOne({ where: { userId, universityId: dto.universityId }, lock: { mode: 'pessimistic_write' } });
      const oldValues = record ? this.snapshot(record, Object.keys(patch)) : null;
      if (!record) record = repository.create({ userId, universityId: dto.universityId });
      Object.assign(record, patch);
      this.assertQuietHours(record);
      record = await repository.save(record);
      await this.audit(manager, access.actorId, 'notification_preferences', record.id, oldValues, { ...this.snapshot(record, Object.keys(patch)), reason: dto.reason.trim(), result: oldValues ? 'updated' : 'created', targetUserId: userId }, record.universityId, context);
      return this.preferenceResponse(record);
    });
  }

  async patchPreferences(userId: string, id: string, dto: PlatformNotificationPreferencesPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    const patch = this.pick(dto, PREFERENCE_FIELDS);
    if (!Object.keys(patch).length) throw new BadRequestException('Укажите хотя бы одну настройку уведомлений.');
    this.assertNonNull(patch, ['quietHoursStart', 'quietHoursEnd']);
    this.assertTimeZone(patch.timeZone as string | null | undefined);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(NotificationPreference, { where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Настройки уведомлений не найдены.');
      await this.assertStoredUniversity(manager, record.universityId);
      const oldValues = this.snapshot(record, Object.keys(patch));
      Object.assign(record, patch);
      this.assertQuietHours(record);
      const updated = await manager.save(NotificationPreference, record);
      await this.audit(manager, access.actorId, 'notification_preferences', id, oldValues, { ...this.snapshot(updated, Object.keys(patch)), reason: dto.reason.trim(), result: 'updated', targetUserId: userId }, updated.universityId, context);
      return this.preferenceResponse(updated);
    });
  }

  async deletePreferences(userId: string, id: string, dto: PlatformPersonalRecordDeleteDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(NotificationPreference, { where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Настройки уведомлений не найдены.');
      await this.assertStoredUniversity(manager, record.universityId);
      const oldValues = this.snapshot(record, [...PREFERENCE_FIELDS]);
      await manager.remove(NotificationPreference, record);
      await this.audit(manager, access.actorId, 'notification_preferences', id, oldValues, { reason: dto.reason.trim(), result: 'deleted', targetUserId: userId }, record.universityId, context);
      return { deleted: true, id };
    });
  }

  async putFavorite(userId: string, dto: PlatformFavoriteDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    const values = this.normalizeFavorite(dto.kind, dto.externalId, dto.label);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const universityId = await this.requireCurrentUniversity(manager, user);
      const repository = manager.getRepository(Favorite);
      let record = await repository.findOne({ where: { userId, universityId, kind: dto.kind, externalId: values.externalId }, lock: { mode: 'pessimistic_write' } });
      const oldValues = record ? this.snapshot(record, ['kind', 'externalId', 'label']) : null;
      if (!record) record = repository.create({ userId, universityId, kind: dto.kind, ...values });
      else Object.assign(record, values);
      record = await repository.save(record);
      await this.audit(manager, access.actorId, 'favorite', record.id, oldValues, { ...this.snapshot(record, ['kind', 'externalId', 'label']), reason: dto.reason.trim(), result: oldValues ? 'updated' : 'created', targetUserId: userId }, record.universityId, context);
      return record;
    });
  }

  async patchFavorite(userId: string, id: string, dto: PlatformFavoritePatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    const supplied = this.pick(dto, ['kind', 'externalId', 'label'] as const);
    if (!Object.keys(supplied).length) throw new BadRequestException('Укажите хотя бы одно поле избранного элемента.');
    this.assertNonNull(supplied);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(Favorite, { where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Запись избранного не найдена.');
      const universityId = record.universityId;
      await this.assertStoredUniversity(manager, universityId);
      const kind = (supplied.kind ?? record.kind) as FavoriteKind;
      const normalized = this.normalizeFavorite(kind, String(supplied.externalId ?? record.externalId), String(supplied.label ?? record.label));
      const duplicate = await manager.getRepository(Favorite).createQueryBuilder('favorite')
        .where('favorite.userId = :userId AND favorite.universityId = :universityId AND favorite.kind = :kind AND favorite.externalId = :externalId AND favorite.id != :id', { userId, universityId, kind, externalId: normalized.externalId, id }).getExists();
      if (duplicate) throw new ConflictException('Такой элемент уже есть в избранном пользователя.');
      const oldValues = this.snapshot(record, Object.keys(supplied));
      Object.assign(record, { kind, ...normalized });
      const updated = await manager.save(Favorite, record);
      await this.audit(manager, access.actorId, 'favorite', id, oldValues, { ...this.snapshot(updated, Object.keys(supplied)), reason: dto.reason.trim(), result: 'updated', targetUserId: userId }, updated.universityId, context);
      return updated;
    });
  }

  async deleteFavorite(userId: string, id: string, dto: PlatformPersonalRecordDeleteDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(Favorite, { where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Запись избранного не найдена.');
      const universityId = record.universityId;
      await this.assertStoredUniversity(manager, universityId);
      const oldValues = this.snapshot(record, ['universityId', 'kind', 'externalId', 'label']);
      await manager.remove(Favorite, record);
      await this.audit(manager, access.actorId, 'favorite', id, oldValues, { reason: dto.reason.trim(), result: 'deleted', targetUserId: userId }, record.universityId, context);
      return { deleted: true, id };
    });
  }

  async putLessonNote(userId: string, pairSpaceId: string, dto: PlatformPersonalLessonNoteDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const pairSpace = await this.assertUserPairSpace(manager, user, pairSpaceId);
      const repository = manager.getRepository(PersonalLessonNote);
      let record = await repository.findOne({ where: { userId, pairSpaceId, universityId: pairSpace.universityId }, lock: { mode: 'pessimistic_write' } });
      const oldValues = record ? this.snapshot(record, ['content']) : null;
      if (!record) record = repository.create({ userId, universityId: pairSpace.universityId, pairSpaceId, content: dto.content });
      else record.content = dto.content;
      record = await repository.save(record);
      await this.audit(manager, access.actorId, 'personal_lesson_note', record.id, oldValues, { content: record.content, reason: dto.reason.trim(), result: oldValues ? 'updated' : 'created', targetUserId: userId }, record.universityId, context);
      return { ...record, lesson: await this.lessonSummary(manager, pairSpace) };
    });
  }

  async patchLessonNote(userId: string, id: string, dto: PlatformPersonalLessonNotePatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(PersonalLessonNote, { where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Личная заметка не найдена.');
      const pairSpace = await this.assertStoredPairSpace(manager, record.pairSpaceId, record.universityId);
      const oldValues = this.snapshot(record, ['content']);
      record.content = dto.content;
      const updated = await manager.save(PersonalLessonNote, record);
      await this.audit(manager, access.actorId, 'personal_lesson_note', id, oldValues, { content: updated.content, reason: dto.reason.trim(), result: 'updated', targetUserId: userId }, updated.universityId, context);
      return { ...updated, lesson: await this.lessonSummary(manager, pairSpace) };
    });
  }

  async deleteLessonNote(userId: string, id: string, dto: PlatformPersonalRecordDeleteDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(PersonalLessonNote, { where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Личная заметка не найдена.');
      await this.assertStoredPairSpace(manager, record.pairSpaceId, record.universityId);
      const oldValues = this.snapshot(record, ['universityId', 'pairSpaceId', 'content']);
      await manager.remove(PersonalLessonNote, record);
      await this.audit(manager, access.actorId, 'personal_lesson_note', id, oldValues, { reason: dto.reason.trim(), result: 'deleted', targetUserId: userId }, record.universityId, context);
      return { deleted: true, id };
    });
  }

  async putHomeworkProgress(userId: string, homeworkId: string, dto: PlatformHomeworkProgressDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    this.assertUniqueSubtasks(dto.subtasks);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const homework = await this.assertStudentHomework(manager, user, homeworkId);
      const repository = manager.getRepository(HomeworkProgress);
      let record = await repository.findOne({ where: { studentId: userId, homeworkId }, lock: { mode: 'pessimistic_write' } });
      const oldValues = record ? this.snapshot(record, ['state', 'subtasks']) : null;
      if (!record) record = repository.create({ studentId: userId, homeworkId, state: dto.state, subtasks: dto.subtasks });
      else Object.assign(record, { state: dto.state, subtasks: dto.subtasks });
      record = await repository.save(record);
      await this.audit(manager, access.actorId, 'homework_progress', record.id, oldValues, { state: record.state, subtasks: record.subtasks as unknown as JsonValue, reason: dto.reason.trim(), result: oldValues ? 'updated' : 'created', targetUserId: userId }, user.universityId ?? undefined, context);
      return { ...record, homework: this.homeworkSummary(homework), pairSpace: this.pairSpaceSummary(homework.pairSpace) };
    });
  }

  async patchHomeworkProgress(userId: string, id: string, dto: PlatformHomeworkProgressPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    const patch = this.pick(dto, ['state', 'subtasks'] as const);
    if (!Object.keys(patch).length) throw new BadRequestException('Укажите статус или чек-лист прогресса.');
    this.assertNonNull(patch);
    if (patch.subtasks) this.assertUniqueSubtasks(patch.subtasks as HomeworkProgressSubtask[]);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(HomeworkProgress, { where: { id, studentId: userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Личный прогресс подготовки не найден.');
      const homework = await this.assertStoredHomework(manager, record.homeworkId);
      const oldValues = this.snapshot(record, Object.keys(patch));
      Object.assign(record, patch);
      const updated = await manager.save(HomeworkProgress, record);
      await this.audit(manager, access.actorId, 'homework_progress', id, oldValues, { ...this.snapshot(updated, Object.keys(patch)), reason: dto.reason.trim(), result: 'updated', targetUserId: userId }, user.universityId ?? undefined, context);
      return { ...updated, homework: this.homeworkSummary(homework), pairSpace: this.pairSpaceSummary(homework.pairSpace) };
    });
  }

  async deleteHomeworkProgress(userId: string, id: string, dto: PlatformPersonalRecordDeleteDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('personal-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const user = await this.lockUser(manager, userId);
      const record = await manager.findOne(HomeworkProgress, { where: { id, studentId: userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Личный прогресс подготовки не найден.');
      await this.assertStoredHomework(manager, record.homeworkId);
      const oldValues = this.snapshot(record, ['homeworkId', 'state', 'subtasks']);
      await manager.remove(HomeworkProgress, record);
      await this.audit(manager, access.actorId, 'homework_progress', id, oldValues, { reason: dto.reason.trim(), result: 'deleted', targetUserId: userId }, user.universityId ?? undefined, context);
      return { deleted: true, id };
    });
  }

  private async lockUser(manager: EntityManager, userId: string): Promise<User> {
    const user = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
    if (!user) throw new NotFoundException('Пользователь не найден.');
    const access = await this.platform.access();
    this.platform.assertUniversityScope(access, user.universityId);
    return user;
  }

  private async assertUserUniversity(manager: EntityManager, user: User, universityId: string): Promise<void> {
    const university = await manager.findOne(University, { where: { id: universityId }, select: ['id'] });
    if (!university || user.universityId !== universityId) throw new BadRequestException('Университет записи не совпадает с университетом пользователя.');
  }

  private async assertStoredUniversity(manager: EntityManager, universityId: string): Promise<void> {
    const access = await this.platform.access();
    this.platform.assertUniversityScope(access, universityId);
    if (!await manager.getRepository(University).existsBy({ id: universityId })) throw new BadRequestException('Университет сохранённой записи больше не существует.');
  }

  private async requireCurrentUniversity(manager: EntityManager, user: User): Promise<string> {
    if (!user.universityId) throw new BadRequestException('У пользователя не указан университет.');
    await this.assertUserUniversity(manager, user, user.universityId);
    return user.universityId;
  }

  private async assertUserPairSpace(manager: EntityManager, user: User, pairSpaceId: string, expectedUniversityId?: string): Promise<PairSpace> {
    const pairSpace = await manager.findOne(PairSpace, { where: { id: pairSpaceId }, lock: { mode: 'pessimistic_read' } });
    if (!pairSpace) throw new NotFoundException('Пространство пары не найдено.');
    await this.assertUserUniversity(manager, user, pairSpace.universityId);
    const access = await this.platform.access();
    this.platform.assertUniversityScope(access, pairSpace.universityId);
    if (expectedUniversityId && expectedUniversityId !== pairSpace.universityId) throw new BadRequestException('Университет заметки не совпадает с университетом пространства пары.');
    const lesson = await manager.findOne(Lesson, { where: { id: pairSpace.lessonId, universityId: pairSpace.universityId }, select: ['id', 'groupId', 'teacherId', 'subject', 'startDate', 'pairNumber'] });
    if (!lesson) throw new BadRequestException('Пространство пары не связано с занятием этого университета.');
    if (user.role === UserRole.STUDENT && !await this.studentMatchesLessonGroup(manager, user, lesson.groupId)) {
      throw new BadRequestException('Занятие не относится к учебной группе пользователя.');
    }
    if (user.role === UserRole.TEACHER && lesson.teacherId !== user.id) throw new BadRequestException('Занятие не принадлежит преподавателю.');
    if (user.role === UserRole.CURATOR) {
      const assignment = await manager.getRepository(CuratorAssignment).createQueryBuilder('assignment')
        .where('assignment.userId = :userId AND assignment.universityId = :universityId AND assignment.groupId = :groupId AND assignment.revokedAt IS NULL', { userId: user.id, universityId: pairSpace.universityId, groupId: lesson.groupId }).getExists();
      if (!assignment) throw new BadRequestException('У пользователя нет активного назначения на группу занятия.');
    }
    return pairSpace;
  }

  private async assertStoredPairSpace(manager: EntityManager, pairSpaceId: string, expectedUniversityId: string): Promise<PairSpace> {
    const pairSpace = await manager.findOne(PairSpace, { where: { id: pairSpaceId }, lock: { mode: 'pessimistic_read' } });
    if (!pairSpace || pairSpace.universityId !== expectedUniversityId) throw new BadRequestException('Заметка не связана с сохранённым пространством пары.');
    await this.assertStoredUniversity(manager, expectedUniversityId);
    const lesson = await manager.findOne(Lesson, { where: { id: pairSpace.lessonId, universityId: expectedUniversityId }, select: ['id'] });
    if (!lesson) throw new BadRequestException('Пространство пары не связано с занятием этого университета.');
    return pairSpace;
  }

  private async assertStudentHomework(manager: EntityManager, user: User, homeworkId: string): Promise<Homework & { pairSpace: PairSpace }> {
    if (user.role !== UserRole.STUDENT) throw new BadRequestException('Личный прогресс подготовки доступен только студенту.');
    const homework = await manager.getRepository(Homework).createQueryBuilder('homework')
      .innerJoinAndMapOne('homework.pairSpace', PairSpace, 'pairSpace', 'pairSpace.id = homework.pairSpaceId')
      .setLock('pessimistic_read', undefined, ['homework', 'pairSpace'])
      .where('homework.id = :homeworkId', { homeworkId }).getOne() as (Homework & { pairSpace: PairSpace }) | null;
    if (!homework?.pairSpace) throw new NotFoundException('Подготовка к занятию не найдена.');
    await this.assertUserPairSpace(manager, user, homework.pairSpace.id, homework.pairSpace.universityId);
    return homework;
  }

  private async assertStoredHomework(manager: EntityManager, homeworkId: string): Promise<Homework & { pairSpace: PairSpace }> {
    const homework = await manager.getRepository(Homework).createQueryBuilder('homework')
      .innerJoinAndMapOne('homework.pairSpace', PairSpace, 'pairSpace', 'pairSpace.id = homework.pairSpaceId')
      .setLock('pessimistic_read', undefined, ['homework', 'pairSpace'])
      .where('homework.id = :homeworkId', { homeworkId }).getOne() as (Homework & { pairSpace: PairSpace }) | null;
    if (!homework?.pairSpace) throw new NotFoundException('Подготовка к занятию не найдена.');
    await this.assertStoredUniversity(manager, homework.pairSpace.universityId);
    const lesson = await manager.findOne(Lesson, { where: { id: homework.pairSpace.lessonId, universityId: homework.pairSpace.universityId }, select: ['id'] });
    if (!lesson) throw new BadRequestException('Подготовка не связана с занятием этого университета.');
    return homework;
  }

  private async studentMatchesLessonGroup(manager: EntityManager, user: User, lessonGroupId: string): Promise<boolean> {
    if (!user.groupId) return false;
    if (user.groupId === lessonGroupId) return true;
    if (!user.universityId || !/^\d+$/.test(user.groupId)) return false;
    const group = await manager.findOne(Group, { where: { universityId: user.universityId, externalId: user.groupId }, select: ['id'] });
    return group?.id === lessonGroupId;
  }

  private async lessonSummary(manager: EntityManager, pairSpace: PairSpace) {
    const lesson = await manager.findOne(Lesson, { where: { id: pairSpace.lessonId, universityId: pairSpace.universityId }, select: ['id', 'subject', 'startDate', 'pairNumber'] });
    return lesson ? { id: lesson.id, subject: lesson.subject, date: lesson.startDate, pairNumber: lesson.pairNumber } : null;
  }

  private homeworkSummary(homework: Homework) { return { id: homework.id, title: homework.title, deadline: homework.deadline }; }
  private pairSpaceSummary(pairSpace: PairSpace) { return { id: pairSpace.id, universityId: pairSpace.universityId, subject: pairSpace.subject, date: pairSpace.date, pairNumber: pairSpace.pairNumber }; }
  private preferenceResponse(record: NotificationPreference) {
    const { userId, ...preference } = record;
    return preference;
  }

  private normalizeFavorite(kind: FavoriteKind, externalIdInput: string, labelInput: string) {
    const trimmed = externalIdInput.trim().normalize('NFKC');
    const externalId = kind === 'teacher' ? trimmed.toLocaleLowerCase('ru-RU') : trimmed;
    const label = labelInput.trim().normalize('NFKC');
    if (!externalId || externalId.length > 220 || (kind === 'group' && !/^\d+$/.test(externalId))) throw new BadRequestException('Идентификатор избранного элемента недопустим.');
    if (!label || label.length > 220) throw new BadRequestException('Название избранного элемента недопустимо.');
    return { externalId, label };
  }

  private assertTimeZone(timeZone?: string | null): void {
    if (timeZone === undefined || timeZone === null) return;
    try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); }
    catch { throw new BadRequestException('Укажите действующий часовой пояс IANA.'); }
  }

  private assertQuietHours(preference: NotificationPreference): void {
    if ((preference.quietHoursStart && !preference.quietHoursEnd) || (!preference.quietHoursStart && preference.quietHoursEnd)) {
      throw new BadRequestException('Укажите оба времени тихих часов или очистите оба поля.');
    }
  }

  private assertUniqueSubtasks(subtasks: HomeworkProgressSubtask[]): void {
    if (new Set(subtasks.map(item => item.id)).size !== subtasks.length) throw new BadRequestException('ID шагов чек-листа должны быть уникальными.');
  }

  private assertReason(reason: string): void {
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину изменения (не менее 3 символов).');
  }

  private assertNonNull(values: Record<string, unknown>, nullableFields: readonly string[] = []): void {
    const invalid = Object.entries(values).find(([field, value]) => value === null && !nullableFields.includes(field));
    if (invalid) throw new BadRequestException(`Поле ${invalid[0]} не может быть пустым.`);
  }

  private applySearch(qb: SelectQueryBuilder<User>, query: string): void {
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    qb.andWhere("(u.id::text ILIKE :q ESCAPE E'\\\\' OR u.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', u.firstName, u.lastName) ILIKE :q ESCAPE E'\\\\' OR COALESCE(u.phone, '') ILIKE :q ESCAPE E'\\\\' OR COALESCE(u.groupId, '') ILIKE :q ESCAPE E'\\\\' OR COALESCE(university.name, '') ILIKE :q ESCAPE E'\\\\')", { q: pattern });
  }

  private pick<T extends string>(source: object, fields: readonly T[]): Partial<Record<T, unknown>> {
    const values = source as Record<string, unknown>;
    return Object.fromEntries(fields.filter(field => values[field] !== undefined).map(field => [field, values[field]])) as Partial<Record<T, unknown>>;
  }

  private snapshot<T extends object>(record: T, fields: readonly string[]): JsonObject {
    const source = record as Record<string, unknown>;
    return Object.fromEntries(fields.map(field => [field, this.toJson(source[field])])) as JsonObject;
  }

  private toJson(value: unknown): JsonValue {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
    if (Array.isArray(value)) return value.map(item => this.toJson(item));
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.toJson(item)]));
    return String(value);
  }

  private async audit(manager: EntityManager, actorId: string, entity: string, entityId: string, oldValues: JsonObject | null, newValues: JsonObject, universityId?: string, context: RequestAuditContext = {}): Promise<void> {
    const result = newValues.result;
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId,
      action: `platform.${entity}.${result === 'created' ? 'created' : result === 'deleted' ? 'deleted' : 'updated'}`,
      entity: `personal_data.${entity}`,
      entityId,
      oldValues: oldValues ?? undefined,
      newValues: universityId ? { ...newValues, universityId } : newValues,
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 512),
    }));
  }
}
