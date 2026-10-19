import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AcademicEvent } from '../academic/entities/academic-event.entity';
import { University } from '../users/entities/university.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { JsonObject } from '../common/types/json-value.type';
import { TenantContext } from '../common/tenant/tenant-context';
import { PlatformService } from '../platform/platform.service';
import { PlatformAcademicEventPatchDto, PlatformAcademicEventReasonDto, PlatformAcademicEventsQueryDto } from './platform-academic-events.dto';

type RequestAudit = { ip?: string; userAgent?: string };
type EventRead = { event: AcademicEvent; universityName: string | null; courseName: string | null; groupName: string | null; actorName: string | null };
const columns = ['event.id', 'event.universityId', 'event.type', 'event.courseId', 'event.groupId', 'event.occurrenceId', 'event.actorId', 'event.title', 'event.description', 'event.startsAt', 'event.endsAt', 'event.priority', 'event.source', 'event.lastSyncedAt', 'event.sourceVersion', 'event.syncStatus', 'event.createdAt', 'event.hiddenAt', 'event.hiddenBy', 'event.hideReason'];

@Injectable()
export class PlatformAcademicEventsService {
  constructor(
    @InjectRepository(AcademicEvent) private readonly events: Repository<AcademicEvent>,
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    private readonly db: DataSource,
    private readonly platform: PlatformService,
    private readonly tenant: TenantContext,
  ) {}

  async list(query: PlatformAcademicEventsQueryDto, request: RequestAudit = {}) {
    const access = await this.platform.require('academic-data.read');
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) throw new BadRequestException('Дата начала фильтра должна предшествовать дате окончания.');
    const qb = this.events.createQueryBuilder('event')
      .select(columns)
      .leftJoin(University, 'university', 'university.id = event.universityId')
      .leftJoin('academic_courses', 'course', 'course.id = event.courseId AND course."universityId" = event."universityId"')
      .leftJoin('groups', 'grp', 'grp.id = event.groupId AND grp."universityId" = event."universityId"')
      .addSelect('university.name', 'platform_university_name')
      .addSelect('course.name', 'platform_course_name')
      .addSelect('grp.name', 'platform_group_name');
    if (query.universityId) {
      this.platform.assertUniversityScope(access, query.universityId);
      qb.andWhere('event.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('event.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    if (query.type) qb.andWhere('event.type = :type', { type: query.type });
    if (query.visibility === 'visible') qb.andWhere('event.hiddenAt IS NULL');
    if (query.visibility === 'hidden') qb.andWhere('event.hiddenAt IS NOT NULL');
    if (query.from) qb.andWhere('event.startsAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('event.startsAt < :to', { to: new Date(query.to) });
    if (query.q?.trim()) {
      const q = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(event.id::text ILIKE :q ESCAPE E'\\\\' OR event.title ILIKE :q ESCAPE E'\\\\' OR event.description ILIKE :q ESCAPE E'\\\\' OR event.courseId::text ILIKE :q ESCAPE E'\\\\' OR event.groupId::text ILIKE :q ESCAPE E'\\\\' OR university.name ILIKE :q ESCAPE E'\\\\' OR course.name ILIKE :q ESCAPE E'\\\\' OR grp.name ILIKE :q ESCAPE E'\\\\')", { q });
    }
    const total = await qb.clone().getCount();
    const { entities, raw } = await qb.orderBy('event.startsAt', 'DESC', 'NULLS LAST').addOrderBy('event.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const data = entities.map((event, index) => this.toListItem({ event, universityName: raw[index].platform_university_name, courseName: raw[index].platform_course_name, groupName: raw[index].platform_group_name, actorName: null }));
    await this.audits.save({ userId: access.actorId, action: 'platform.academic_event.search', entity: 'academic_event_search', entityId: 'search', newValues: { queryEntered: Boolean(query.q?.trim()), universityId: query.universityId ?? null, type: query.type ?? null, visibility: query.visibility, from: query.from ?? null, to: query.to ?? null, page: query.page, limit: query.limit, resultCount: data.length, total, resultEventIds: data.map(item => item.id) }, ...this.auditContext(request) });
    return toPaginatedResponse(data, total, query);
  }

  async detail(id: string, request: RequestAudit = {}) {
    const access = await this.platform.require('academic-data.read');
    const context = await this.load(id);
    this.platform.assertUniversityScope(access, context.event.universityId);
    const history = await this.audits.find({ where: { entity: 'academic_event', entityId: id, action: In(['platform.academic_event.updated', 'platform.academic_event.hidden', 'platform.academic_event.restored']) }, order: { createdAt: 'DESC' }, take: 20 });
    await this.audits.save({ userId: access.actorId, action: 'platform.academic_event.viewed', entity: 'academic_event', entityId: id, newValues: this.auditScope(context.event), ...this.auditContext(request) });
    return { ...this.toListItem(context), changes: history.map(item => ({ id: item.id, action: item.action, oldValues: item.oldValues, newValues: item.newValues, actorId: item.userId, timestamp: item.createdAt })) };
  }

  async update(id: string, dto: PlatformAcademicEventPatchDto, request: RequestAudit = {}) {
    const access = await this.platform.require('academic-data.write');
    const actor = this.tenant.getUser();
    if (!actor) throw new BadRequestException('Не удалось определить пользователя, выполнившего изменение.');
    const reason = dto.reason.trim();
    if (reason.length < 3 || reason.length > 500) throw new BadRequestException('Причина должна содержать от 3 до 500 символов.');
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException('Заголовок не может быть пустым.');
    const fields = ['title', 'description', 'priority', 'startsAt', 'endsAt'] as const;
    if (!fields.some(key => dto[key] !== undefined)) throw new BadRequestException('Укажите хотя бы одно поле события для изменения.');
    await this.db.transaction(async manager => {
      const repo = manager.getRepository(AcademicEvent);
      const event = await repo.createQueryBuilder('event').setLock('pessimistic_write').where('event.id = :id', { id }).getOne();
      if (!event) throw new NotFoundException('Академическое событие не найдено.');
      this.platform.assertUniversityScope(access, event.universityId);
      this.assertEditable(event);
      const oldValues = snapshot(event);
      for (const key of fields) if (dto[key] !== undefined) {
        const value = key === 'title' && typeof dto.title === 'string' ? dto.title.trim() : key === 'description' && typeof dto.description === 'string' ? (dto.description.trim() || null) : dto[key];
        (event as unknown as Record<string, unknown>)[key] = value === null ? null : key === 'startsAt' || key === 'endsAt' ? new Date(value as string) : value;
      }
      this.validateDates(event);
      const saved = await repo.save(event);
      await manager.getRepository(AuditLog).save({ userId: access.actorId, action: 'platform.academic_event.updated', entity: 'academic_event', entityId: id, oldValues, newValues: { ...snapshot(saved), ...this.auditScope(saved), reason }, ...this.auditContext(request) });
    });
    return this.detail(id, request);
  }

  async setHidden(id: string, dto: PlatformAcademicEventReasonDto, hidden: boolean, request: RequestAudit = {}) {
    const access = await this.platform.require('academic-data.write');
    const reason = dto.reason.trim();
    if (reason.length < 3 || reason.length > 500) throw new BadRequestException('Причина должна содержать от 3 до 500 символов.');
    await this.db.transaction(async manager => {
      const repo = manager.getRepository(AcademicEvent);
      const event = await repo.createQueryBuilder('event').setLock('pessimistic_write').where('event.id = :id', { id }).getOne();
      if (!event) throw new NotFoundException('Академическое событие не найдено.');
      this.platform.assertUniversityScope(access, event.universityId);
      const alreadyHidden = Boolean(event.hiddenAt);
      if (alreadyHidden === hidden) throw new BadRequestException(hidden ? 'Событие уже скрыто.' : 'Событие уже доступно в академической ленте.');
      const oldValues = { hiddenAt: event.hiddenAt?.toISOString() ?? null, hiddenBy: event.hiddenBy, hideReason: event.hideReason };
      event.hiddenAt = hidden ? new Date() : null;
      event.hiddenBy = hidden ? access.actorId : null;
      event.hideReason = hidden ? reason : null;
      const saved = await repo.save(event);
      await manager.getRepository(AuditLog).save({ userId: access.actorId, action: hidden ? 'platform.academic_event.hidden' : 'platform.academic_event.restored', entity: 'academic_event', entityId: id, oldValues: { ...oldValues, universityId: event.universityId }, newValues: { hiddenAt: saved.hiddenAt?.toISOString() ?? null, hiddenBy: saved.hiddenBy, hideReason: saved.hideReason, universityId: event.universityId, reason }, ...this.auditContext(request) });
    });
    return this.detail(id, request);
  }

  private async load(id: string): Promise<EventRead> {
    const qb = this.events.createQueryBuilder('event').select(columns)
      .leftJoin(University, 'university', 'university.id = event.universityId')
      .leftJoin('academic_courses', 'course', 'course.id = event.courseId AND course."universityId" = event."universityId"')
      .leftJoin('groups', 'grp', 'grp.id = event.groupId AND grp."universityId" = event."universityId"')
      .leftJoin('users', 'actor', 'actor.id = event.actorId AND actor."universityId" = event."universityId"')
      .addSelect('university.name', 'platform_university_name').addSelect('course.name', 'platform_course_name').addSelect('grp.name', 'platform_group_name')
      .addSelect("concat_ws(' ', actor.\"firstName\", actor.\"lastName\")", 'platform_actor_name').where('event.id = :id', { id });
    const { entities, raw } = await qb.getRawAndEntities();
    if (!entities[0]) throw new NotFoundException('Академическое событие не найдено.');
    const row = raw[0];
    return { event: entities[0], universityName: row.platform_university_name ?? null, courseName: row.platform_course_name ?? null, groupName: row.platform_group_name ?? null, actorName: row.platform_actor_name ?? null };
  }

  private toListItem(context: EventRead) {
    const { event } = context;
    return { id: event.id, universityId: event.universityId, universityName: context.universityName, type: event.type, courseId: event.courseId, courseName: context.courseName, groupId: event.groupId, groupName: context.groupName, occurrenceId: event.occurrenceId, actorId: event.actorId, actorName: context.actorName, title: event.title, description: event.description, startsAt: event.startsAt?.toISOString() ?? null, endsAt: event.endsAt?.toISOString() ?? null, priority: event.priority, source: event.source, lastSyncedAt: event.lastSyncedAt?.toISOString() ?? null, sourceVersion: event.sourceVersion, syncStatus: event.syncStatus, createdAt: event.createdAt.toISOString(), hiddenAt: event.hiddenAt?.toISOString() ?? null, hiddenBy: event.hiddenBy, hideReason: event.hideReason };
  }

  private assertEditable(event: AcademicEvent) {
    if (event.occurrenceId) throw new BadRequestException('Событие связано с занятием; корректируйте исходное занятие, чтобы не расходились данные.');
    if (!event.actorId) throw new BadRequestException('У события нет подтверждённого автора; оно доступно только для просмотра.');
    if (event.source && event.source !== 'manual') throw new BadRequestException('Событие из внешнего источника доступно только для просмотра.');
  }

  private validateDates(event: AcademicEvent) {
    if (event.startsAt && !Number.isFinite(new Date(event.startsAt).getTime())) throw new BadRequestException('Некорректная дата начала.');
    if (event.endsAt && !Number.isFinite(new Date(event.endsAt).getTime())) throw new BadRequestException('Некорректная дата окончания.');
    if (event.startsAt && event.endsAt && event.startsAt >= event.endsAt) throw new BadRequestException('Дата начала должна предшествовать дате окончания.');
  }

  private auditScope(event: AcademicEvent) { return { universityId: event.universityId, courseId: event.courseId, groupId: event.groupId, occurrenceId: event.occurrenceId }; }
  private auditContext(context: RequestAudit) { return { ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }; }
}

function snapshot(event: AcademicEvent): JsonObject {
  return { title: event.title, description: event.description, priority: event.priority, startsAt: event.startsAt?.toISOString() ?? null, endsAt: event.endsAt?.toISOString() ?? null };
}
