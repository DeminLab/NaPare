import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { EventBusService } from '../events/event-bus.service';
import { Lesson } from '../schedule/entities/lesson.entity';
import { LessonChange } from '../schedule/entities/lesson-change.entity';
import { Course } from '../academic/entities/course.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { ScheduleChange } from '../academic/entities/schedule-change.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformService } from '../platform/platform.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { JsonObject } from '../common/types/json-value.type';
import { PlatformAcademicLessonPatchDto, PlatformAcademicLessonsQueryDto } from './platform-academic-legacy.dto';

type AuditContext = { ip?: string; userAgent?: string };
type LegacyLessonContext = { lesson: Lesson; university: University; group: Group; teacher: User | null; course: Course | null; series: LessonSeries | null };

@Injectable()
export class PlatformAcademicLegacyService {
  constructor(
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(LessonChange) private readonly changes: Repository<LessonChange>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(LessonSeries) private readonly series: Repository<LessonSeries>,
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
    private readonly db: DataSource,
    private readonly platform: PlatformService,
    private readonly tenant: TenantContext,
    private readonly eventBus: EventBusService,
  ) {}

  async list(query: PlatformAcademicLessonsQueryDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) throw new BadRequestException('Дата начала фильтра должна предшествовать дате окончания.');
    const qb = this.lessons.createQueryBuilder('l')
      .leftJoin(University, 'u', 'u.id = l.universityId')
      .leftJoin(Group, 'g', 'g.id = l.groupId AND g.universityId = l.universityId')
      .leftJoin(User, 't', 't.id = l.teacherId AND t.universityId = l.universityId')
      .addSelect('u.name', 'platform_university_name')
      .addSelect('g.name', 'platform_group_name')
      .addSelect("concat_ws(' ', t.firstName, t.lastName)", 'platform_teacher_name')
      .where('l.occurrenceId IS NULL');
    if (query.universityId) {
      this.platform.assertUniversityScope(access, query.universityId);
      qb.andWhere('l.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('l.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    if (query.from) qb.andWhere('l.startDate >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('l.startDate < :to', { to: new Date(query.to) });
    if (query.q?.trim()) {
      const escaped = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(l.id::text ILIKE :q ESCAPE E'\\\\' OR l.subject ILIKE :q ESCAPE E'\\\\' OR l.groupId::text ILIKE :q ESCAPE E'\\\\' OR l.teacherId::text ILIKE :q ESCAPE E'\\\\' OR g.name ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', t.firstName, t.lastName) ILIKE :q ESCAPE E'\\\\' OR l.teacherName ILIKE :q ESCAPE E'\\\\' OR u.name ILIKE :q ESCAPE E'\\\\')", { q: escaped });
    }
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('l.startDate', 'ASC').addOrderBy('l.startTime', 'ASC').addOrderBy('l.id', 'ASC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const data = rows.entities.map((lesson, index) => this.toListItem(lesson, rows.raw[index]));
    await this.audits.save({
      userId: access.actorId, action: 'platform.academic_lesson.search', entity: 'academic_lesson_search', entityId: 'search',
      newValues: { queryEntered: Boolean(query.q?.trim()), universityId: query.universityId ?? null, from: query.from ?? null, to: query.to ?? null, page: query.page, limit: query.limit, resultCount: data.length, total, resultLessonIds: data.map(item => item.id) },
      ...this.auditContext(auditContext),
    });
    return toPaginatedResponse(data, total, query);
  }

  async detail(id: string, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    const context = await this.getContext(this.lessons, id);
    this.platform.assertUniversityScope(access, context.lesson.universityId);
    const history = await this.changes.find({ where: { lessonId: id }, order: { createdAt: 'DESC' }, take: 20 });
    await this.audits.save({ userId: access.actorId, action: 'platform.academic_lesson.viewed', entity: 'academic_lesson', entityId: id, newValues: this.auditScope(context), ...this.auditContext(auditContext) });
    return { ...this.toListItem(context.lesson, context), changes: history.map(change => ({ id: change.id, changeType: change.changeType, oldValues: change.oldValues, newValues: change.newValues, reason: change.reason, actorId: change.changedBy, timestamp: change.changedAt })) };
  }

  async update(id: string, dto: PlatformAcademicLessonPatchDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.write');
    const actor = this.tenant.getUser();
    if (!actor) throw new BadRequestException('Не удалось определить пользователя, выполнившего изменение.');
    const reason = dto.reason.trim();
    if (reason.length < 3 || reason.length > 500) throw new BadRequestException('Причина должна содержать от 3 до 500 символов.');
    const editable = ['groupId', 'teacherId', 'subject', 'subjectType', 'room', 'building', 'dayOfWeek', 'startTime', 'endTime', 'pairNumber', 'weekType', 'startDate', 'endDate', 'teacherName', 'groupName', 'subgroup', 'department', 'faculty', 'notes', 'isChanged'] as const;
    if (!editable.some(key => dto[key] !== undefined)) throw new BadRequestException('Укажите хотя бы одно поле занятия для изменения.');

    const result = await this.db.transaction(async manager => {
      const lessonRepo = manager.getRepository(Lesson);
      const lesson = await lessonRepo.createQueryBuilder('l').setLock('pessimistic_write').where('l.id = :id', { id }).getOne();
      if (!lesson || lesson.occurrenceId !== null) throw new NotFoundException('Legacy-занятие без LessonOccurrence не найдено.');
      this.platform.assertUniversityScope(access, lesson.universityId);
      if (lesson.source !== 'manual') throw new BadRequestException('Это занятие синхронизируется из внешнего источника и доступно только для просмотра.');
      const context = await this.getContext(lessonRepo, id, manager);
      const oldValues = lessonChangeValues(lesson);
      const patch = Object.fromEntries(editable.map(key => [key, dto[key]]).filter(([, value]) => value !== undefined));
      Object.assign(lesson, patch);
      if (dto.startDate !== undefined) lesson.startDate = new Date(dto.startDate);
      if (dto.endDate !== undefined) lesson.endDate = new Date(dto.endDate);
      if (!Number.isFinite(lesson.startDate.getTime()) || !Number.isFinite(lesson.endDate.getTime()) || lesson.startDate >= lesson.endDate) throw new BadRequestException('Дата начала должна предшествовать дате окончания.');
      if (lesson.startTime >= lesson.endTime) throw new BadRequestException('Время начала должно предшествовать времени окончания.');
      const newContext = await this.getContextFor(lesson, manager);
      lesson.changeDescription = reason;
      const saved = await lessonRepo.save(lesson);
      const newValues = lessonChangeValues(saved);
      const change = await manager.getRepository(LessonChange).save({ lessonId: saved.id, changeType: lessonChangeType(oldValues, newValues), oldValues, newValues, changedBy: access.actorId, reason, source: 'manual' });
      await manager.getRepository(ScheduleChange).save({ universityId: saved.universityId, occurrenceId: null, legacyLessonId: saved.id, originalValue: oldValues, newValue: newValues, reason, actorId: access.actorId, source: 'manual', timestamp: new Date() });
      await manager.getRepository(AuditLog).save({ userId: access.actorId, action: 'platform.academic_lesson.updated', entity: 'academic_lesson', entityId: saved.id, oldValues: { ...oldValues, ...this.auditScope(context) }, newValues: { ...newValues, ...this.auditScope(newContext), reason }, ...this.auditContext(auditContext) });
      return { lesson: saved, oldValues, newValues, context: newContext, changeId: change.id };
    });

    const roomChanged = result.oldValues.room !== result.newValues.room || result.oldValues.building !== result.newValues.building;
    const timeChanged = result.oldValues.startDate !== result.newValues.startDate || result.oldValues.endDate !== result.newValues.endDate || result.oldValues.startTime !== result.newValues.startTime || result.oldValues.endTime !== result.newValues.endTime;
    const eventType = roomChanged ? 'room.changed' : timeChanged ? 'lesson.rescheduled' : 'lesson.changed';
    await this.eventBus.publish({
      idempotencyKey: `platform-academic-lesson-change:${result.changeId}`,
      type: eventType,
      universityId: result.lesson.universityId,
      actor: { id: actor.id, type: 'user', role: actor.role },
      target: { type: 'lesson', id: result.lesson.id },
      payload: { subject: result.lesson.subject, oldValue: result.oldValues, newValue: result.newValues, reason, groupId: result.lesson.groupId, teacherId: result.lesson.teacherId, deepLink: `/pair-space/${result.lesson.id}` },
      priority: eventType === 'lesson.changed' ? 'normal' : 'high',
    });
    return this.toListItem(result.lesson, result.context);
  }

  private async getContext(repo: Repository<Lesson>, id: string, manager?: EntityManager): Promise<LegacyLessonContext> {
    const lesson = await repo.findOne({ where: { id, occurrenceId: IsNull() } });
    if (!lesson) throw new NotFoundException('Legacy-занятие без LessonOccurrence не найдено.');
    return this.getContextFor(lesson, manager);
  }

  private async getContextFor(lesson: Lesson, manager?: EntityManager): Promise<LegacyLessonContext> {
    const universityRepo = manager?.getRepository(University) ?? this.universities;
    const groupRepo = manager?.getRepository(Group) ?? this.groups;
    const userRepo = manager?.getRepository(User) ?? this.users;
    const courseRepo = manager?.getRepository(Course) ?? this.courses;
    const seriesRepo = manager?.getRepository(LessonSeries) ?? this.series;
    const [university, group, teacher, course, series] = await Promise.all([
      universityRepo.findOne({ where: { id: lesson.universityId } }),
      groupRepo.findOne({ where: { id: lesson.groupId } }),
      lesson.teacherId ? userRepo.findOne({ where: { id: lesson.teacherId }, select: ['id', 'firstName', 'lastName', 'universityId', 'role'] }) : null,
      lesson.courseId ? courseRepo.findOne({ where: { id: lesson.courseId } }) : null,
      lesson.seriesId ? seriesRepo.findOne({ where: { id: lesson.seriesId } }) : null,
    ]);
    if (!university || !group || group.universityId !== lesson.universityId || (lesson.teacherId && (!teacher || teacher.universityId !== lesson.universityId || teacher.role !== UserRole.TEACHER)) || (lesson.courseId && (!course || course.universityId !== lesson.universityId)) || (lesson.seriesId && (!series || !course || series.universityId !== lesson.universityId || series.courseId !== lesson.courseId || series.groupId !== lesson.groupId || series.teacherId !== lesson.teacherId))) {
      throw new BadRequestException('Связи legacy-занятия с вузом, группой, курсом или преподавателем не согласованы.');
    }
    return { lesson, university, group, teacher, course, series };
  }

  private toListItem(lesson: Lesson, joined: LegacyLessonContext | Record<string, unknown>) {
    let universityName: string | null; let groupName: string | null; let teacherName: string | null;
    if ('university' in joined) {
      const context = joined as LegacyLessonContext;
      universityName = context.university.name; groupName = context.group.name;
      teacherName = context.teacher ? `${context.teacher.firstName} ${context.teacher.lastName}`.trim() : lesson.teacherName ?? null;
    } else {
      const row = joined as Record<string, unknown>;
      universityName = row.platform_university_name as string | null ?? null;
      groupName = row.platform_group_name as string | null ?? null;
      teacherName = row.platform_teacher_name as string | null ?? lesson.teacherName ?? null;
    }
    return {
      id: lesson.id, universityId: lesson.universityId, universityName, groupId: lesson.groupId, groupName,
      courseId: lesson.courseId, seriesId: lesson.seriesId, teacherId: lesson.teacherId, teacherName,
      subject: lesson.subject, subjectType: lesson.subjectType, room: lesson.room, building: lesson.building,
      dayOfWeek: lesson.dayOfWeek, startTime: lesson.startTime, endTime: lesson.endTime, pairNumber: lesson.pairNumber,
      weekType: lesson.weekType, startDate: lesson.startDate.toISOString(), endDate: lesson.endDate.toISOString(),
      subgroup: lesson.subgroup, department: lesson.department, faculty: lesson.faculty, notes: lesson.notes,
      isChanged: lesson.isChanged, changeDescription: lesson.changeDescription,
      source: lesson.source, syncStatus: lesson.syncStatus, lastSyncedAt: lesson.lastSyncedAt?.toISOString() ?? null,
    };
  }

  private auditScope(context: LegacyLessonContext) {
    return { universityId: context.lesson.universityId, groupId: context.lesson.groupId, courseId: context.lesson.courseId, teacherId: context.lesson.teacherId };
  }

  private auditContext(context: AuditContext) {
    return { ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) };
  }
}

function lessonChangeValues(lesson: Lesson): JsonObject {
  return {
    subject: lesson.subject, subjectType: lesson.subjectType ?? null, room: lesson.room ?? null, building: lesson.building ?? null,
    startTime: lesson.startTime, endTime: lesson.endTime, pairNumber: lesson.pairNumber, teacherId: lesson.teacherId ?? null,
    teacherName: lesson.teacherName ?? null, groupId: lesson.groupId, groupName: lesson.groupName ?? null,
    dayOfWeek: lesson.dayOfWeek, weekType: lesson.weekType,
    startDate: new Date(lesson.startDate).toISOString(), endDate: new Date(lesson.endDate).toISOString(),
    subgroup: lesson.subgroup ?? null, department: lesson.department ?? null, faculty: lesson.faculty ?? null,
    notes: lesson.notes ?? null, isChanged: lesson.isChanged, changeDescription: lesson.changeDescription ?? null,
  };
}

function lessonChangeType(oldValues: JsonObject, newValues: JsonObject): string {
  const changed = (...keys: string[]) => keys.some(key => oldValues[key] !== newValues[key]);
  if (changed('room', 'building')) return 'room_changed';
  if (changed('teacherId', 'teacherName')) return 'teacher_changed';
  if (changed('startDate', 'endDate', 'startTime', 'endTime')) return 'moved';
  return 'updated';
}
