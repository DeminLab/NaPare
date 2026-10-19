import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TenantContext } from '../common/tenant/tenant-context';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { EventBusService } from '../events/event-bus.service';
import { Course } from '../academic/entities/course.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { ScheduleChange } from '../academic/entities/schedule-change.entity';
import { LessonOccurrenceStatus } from '../academic/academic.types';
import { PlatformService } from '../platform/platform.service';
import { PlatformAcademicOccurrencesQueryDto, PlatformAcademicOccurrencePatchDto } from './platform-academic.dto';

type AuditContext = { ip?: string; userAgent?: string };
type OccurrenceContext = { occurrence: LessonOccurrence; university: University; course: Course; series: LessonSeries; group: Group; teacher: User | null };

@Injectable()
export class PlatformAcademicService {
  constructor(
    @InjectRepository(LessonOccurrence) private readonly occurrences: Repository<LessonOccurrence>,
    @InjectRepository(LessonSeries) private readonly series: Repository<LessonSeries>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ScheduleChange) private readonly changes: Repository<ScheduleChange>,
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
    private readonly db: DataSource,
    private readonly platform: PlatformService,
    private readonly tenant: TenantContext,
    private readonly eventBus: EventBusService,
  ) {}

  async list(query: PlatformAcademicOccurrencesQueryDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) throw new BadRequestException('Дата начала фильтра должна предшествовать дате окончания.');
    const qb = this.occurrences.createQueryBuilder('o')
      .leftJoin(University, 'u', 'u.id = o.universityId')
      .leftJoin(Course, 'c', 'c.id = o.courseId AND c.universityId = o.universityId')
      .leftJoin(Group, 'g', 'g.id = o.groupId AND g.universityId = o.universityId')
      .leftJoin(User, 't', 't.id = o.teacherId AND t.universityId = o.universityId')
      .addSelect('u.name', 'platform_university_name')
      .addSelect('c.name', 'platform_course_name')
      .addSelect('g.name', 'platform_group_name')
      .addSelect("concat_ws(' ', t.firstName, t.lastName)", 'platform_teacher_name');
    if (query.universityId) {
      this.platform.assertUniversityScope(access, query.universityId);
      qb.andWhere('o.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('o.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    if (query.from) qb.andWhere('o.startsAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('o.startsAt < :to', { to: new Date(query.to) });
    if (query.status && query.status !== 'all') qb.andWhere('o.status = :status', { status: query.status });
    if (query.q?.trim()) {
      const escaped = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(o.id::text ILIKE :q ESCAPE E'\\\\' OR o.courseId::text ILIKE :q ESCAPE E'\\\\' OR o.groupId::text ILIKE :q ESCAPE E'\\\\' OR c.name ILIKE :q ESCAPE E'\\\\' OR g.name ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', t.firstName, t.lastName) ILIKE :q ESCAPE E'\\\\' OR u.name ILIKE :q ESCAPE E'\\\\')", { q: escaped });
    }
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('o.startsAt', 'ASC').addOrderBy('o.id', 'ASC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const data = rows.entities.map((occurrence, index) => this.toListItem(occurrence, rows.raw[index]));
    await this.audits.save({
      userId: access.actorId, action: 'platform.academic_occurrence.search', entity: 'academic_occurrence_search', entityId: 'search',
      newValues: { queryEntered: Boolean(query.q?.trim()), universityId: query.universityId ?? null, from: query.from ?? null, to: query.to ?? null, status: query.status ?? null, page: query.page, limit: query.limit, resultCount: data.length, total, resultOccurrenceIds: data.map(item => item.id) },
      ...this.auditContext(auditContext),
    });
    return toPaginatedResponse(data, total, query);
  }

  async detail(id: string, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    const context = await this.getContext(this.occurrences, id);
    this.platform.assertUniversityScope(access, context.occurrence.universityId);
    const history = await this.changes.find({ where: { occurrenceId: id, universityId: context.occurrence.universityId }, order: { timestamp: 'DESC' }, take: 20 });
    await this.audits.save({ userId: access.actorId, action: 'platform.academic_occurrence.viewed', entity: 'academic_occurrence', entityId: id, newValues: this.auditScope(context), ...this.auditContext(auditContext) });
    return { ...this.toListItem(context.occurrence, context), changes: history.map(change => ({ id: change.id, originalValue: change.originalValue, newValue: change.newValue, reason: change.reason, actorId: change.actorId, timestamp: change.timestamp })) };
  }

  async update(id: string, dto: PlatformAcademicOccurrencePatchDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.write');
    const actor = this.tenant.getUser();
    if (!actor) throw new BadRequestException('Не удалось определить пользователя, выполнившего изменение.');
    const reason = dto.reason.trim();
    if (reason.length < 3 || reason.length > 500) throw new BadRequestException('Причина должна содержать от 3 до 500 символов.');
    if (dto.startsAt === undefined && dto.endsAt === undefined && dto.room === undefined && dto.building === undefined && dto.status === undefined) {
      throw new BadRequestException('Укажите хотя бы одно поле расписания для изменения.');
    }
    const updated = await this.db.transaction(async manager => {
      const occurrenceRepo = manager.getRepository(LessonOccurrence);
      const occurrence = await occurrenceRepo.createQueryBuilder('o').setLock('pessimistic_write').where('o.id = :id', { id }).getOne();
      if (!occurrence) throw new NotFoundException('Занятие не найдено.');
      this.platform.assertUniversityScope(access, occurrence.universityId);
      if (occurrence.source !== 'manual') throw new BadRequestException('Это занятие синхронизируется из внешнего источника и доступно только для просмотра.');
      const context = await this.getContext(manager.getRepository(LessonOccurrence), id, manager);
      const originalValue = this.snapshot(occurrence);
      const startsAt = dto.startsAt ? new Date(dto.startsAt) : occurrence.startsAt;
      const endsAt = dto.endsAt ? new Date(dto.endsAt) : occurrence.endsAt;
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) {
        throw new BadRequestException('Время начала должно предшествовать времени окончания.');
      }
      occurrence.startsAt = startsAt;
      occurrence.endsAt = endsAt;
      if (dto.room !== undefined) occurrence.room = this.cleanNullable(dto.room);
      if (dto.building !== undefined) occurrence.building = this.cleanNullable(dto.building);
      if (dto.status !== undefined) occurrence.status = dto.status as LessonOccurrenceStatus;
      occurrence.changeReason = reason;
      const saved = await occurrenceRepo.save(occurrence);
      const newValue = this.snapshot(saved);
      const change = await manager.getRepository(ScheduleChange).save(manager.create(ScheduleChange, {
        universityId: saved.universityId, occurrenceId: saved.id, originalValue, newValue,
        reason, actorId: access.actorId, source: 'manual', timestamp: new Date(),
      }));
      await manager.getRepository(AuditLog).save({
        userId: access.actorId, action: 'platform.academic_occurrence.updated', entity: 'academic_occurrence', entityId: saved.id,
        oldValues: { ...originalValue, ...this.auditScope(context) }, newValues: { ...newValue, ...this.auditScope(context), reason },
        ...this.auditContext(auditContext),
      });
      return { occurrence: saved, changeId: change.id, context, originalValue };
    });

    const originalValue = updated.originalValue;
    const newValue = this.snapshot(updated.occurrence);
    const eventType = updated.occurrence.status === 'cancelled' && originalValue.status !== 'cancelled'
      ? 'lesson.cancelled'
      : originalValue.room !== updated.occurrence.room
        ? 'room.changed'
        : originalValue.startsAt !== newValue.startsAt || originalValue.endsAt !== newValue.endsAt
          ? 'lesson.rescheduled'
          : 'lesson.changed';
    await this.eventBus.publish({
      idempotencyKey: `academic-schedule-change:${updated.changeId}`,
      type: eventType,
      universityId: updated.occurrence.universityId,
      actor: { id: actor.id, type: 'user', role: actor.role },
      target: { type: 'lesson_occurrence', id: updated.occurrence.id },
      payload: {
        subject: updated.context.course.name, originalValue, newValue, reason, source: 'manual',
        groupId: updated.occurrence.groupId, teacherId: updated.occurrence.teacherId,
        deepLink: updated.occurrence.legacyLessonId ? `/pair-space/${updated.occurrence.legacyLessonId}` : `/week?date=${newValue.startsAt.slice(0, 10)}`,
      },
      priority: 'high',
    });
    return this.toListItem(updated.occurrence, updated.context);
  }

  private async getContext(repo: Repository<LessonOccurrence>, id: string, manager?: import('typeorm').EntityManager): Promise<OccurrenceContext> {
    const occurrence = await repo.findOne({ where: { id } });
    if (!occurrence) throw new NotFoundException('Занятие не найдено.');
    const universityRepo = manager?.getRepository(University) ?? this.universities;
    const courseRepo = manager?.getRepository(Course) ?? this.courses;
    const seriesRepo = manager?.getRepository(LessonSeries) ?? this.series;
    const groupRepo = manager?.getRepository(Group) ?? this.groups;
    const userRepo = manager?.getRepository(User) ?? this.users;
    const [university, course, series] = await Promise.all([
      universityRepo.findOne({ where: { id: occurrence.universityId } }),
      courseRepo.findOne({ where: { id: occurrence.courseId } }),
      seriesRepo.findOne({ where: { id: occurrence.seriesId } }),
    ]);
    const group = await groupRepo.findOne({ where: { id: occurrence.groupId } });
    const teacher = occurrence.teacherId ? await userRepo.findOne({ where: { id: occurrence.teacherId } }) : null;
    if (!university || !course || !series || !group || course.universityId !== occurrence.universityId || series.universityId !== occurrence.universityId || series.courseId !== course.id || series.groupId !== group.id || group.universityId !== occurrence.universityId || series.teacherId !== occurrence.teacherId || (occurrence.teacherId && (!teacher || teacher.universityId !== occurrence.universityId || teacher.role !== UserRole.TEACHER))) {
      throw new BadRequestException('Связи занятия с вузом, курсом, группой или преподавателем не согласованы.');
    }
    return { occurrence, university, course, series, group, teacher };
  }

  private toListItem(occurrence: LessonOccurrence, joined: OccurrenceContext | Record<string, unknown>) {
    if ('university' in joined) {
      const context = joined as OccurrenceContext;
      return { id: occurrence.id, universityId: occurrence.universityId, universityName: context.university.name, courseId: occurrence.courseId, courseName: context.course.name, seriesId: occurrence.seriesId, groupId: occurrence.groupId, groupName: context.group.name, teacherId: occurrence.teacherId, teacherName: context.teacher ? `${context.teacher.firstName} ${context.teacher.lastName}`.trim() : null, startsAt: occurrence.startsAt.toISOString(), endsAt: occurrence.endsAt.toISOString(), room: occurrence.room, building: occurrence.building, status: occurrence.status, source: occurrence.source, syncStatus: occurrence.syncStatus, changeReason: occurrence.changeReason };
    }
    const row = joined as Record<string, unknown>;
    return { id: occurrence.id, universityId: occurrence.universityId, universityName: row.platform_university_name ?? null, courseId: occurrence.courseId, courseName: row.platform_course_name ?? null, seriesId: occurrence.seriesId, groupId: occurrence.groupId, groupName: row.platform_group_name ?? null, teacherId: occurrence.teacherId, teacherName: occurrence.teacherId ? row.platform_teacher_name ?? null : null, startsAt: occurrence.startsAt.toISOString(), endsAt: occurrence.endsAt.toISOString(), room: occurrence.room, building: occurrence.building, status: occurrence.status, source: occurrence.source, syncStatus: occurrence.syncStatus, changeReason: occurrence.changeReason };
  }

  private snapshot(occurrence: LessonOccurrence) {
    return { id: occurrence.id, seriesId: occurrence.seriesId, courseId: occurrence.courseId, groupId: occurrence.groupId, teacherId: occurrence.teacherId, startsAt: occurrence.startsAt.toISOString(), endsAt: occurrence.endsAt.toISOString(), room: occurrence.room, building: occurrence.building, status: occurrence.status, changeReason: occurrence.changeReason };
  }

  private auditScope(context: OccurrenceContext) {
    return { universityId: context.occurrence.universityId, groupId: context.occurrence.groupId, courseId: context.occurrence.courseId, teacherId: context.occurrence.teacherId };
  }

  private auditContext(context: AuditContext) {
    return { ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) };
  }

  private cleanNullable(value: string | null) {
    if (value === null) return null;
    const clean = value.trim();
    return clean || null;
  }
}
