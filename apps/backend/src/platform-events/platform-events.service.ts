import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject, JsonPrimitive } from '../common/types/json-value.type';
import { EventRecord } from '../events/entities/event-record.entity';
import { University } from '../users/entities/university.entity';
import { PlatformService } from '../platform/platform.service';
import { PlatformEventsQueryDto } from './platform-events.dto';

type AuditContext = { ip?: string; userAgent?: string };

const PAYLOAD_FIELDS = [
  'subject',
  'courseName',
  'groupName',
  'groupId',
  'lessonId',
  'occurrenceId',
  'teacherId',
  'deadline',
  'deepLink',
] as const;
const MAX_PAYLOAD_STRING_LENGTH = 300;

@Injectable()
export class PlatformEventsService {
  constructor(
    @InjectRepository(EventRecord) private readonly events: Repository<EventRecord>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
    private readonly platform: PlatformService,
  ) {}

  async list(query: PlatformEventsQueryDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('events-data.read');
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) {
      throw new BadRequestException('Дата начала должна предшествовать дате окончания.');
    }

    const qb = this.events.createQueryBuilder('event')
      .innerJoin(University, 'university', 'university.id = event.universityId')
      .addSelect('university.name', 'event_university_name');
    this.applyFilters(qb, query, access);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('event.timestamp', 'DESC').addOrderBy('event.id', 'ASC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const data = rows.entities.map((event, index) => this.toSafeEvent(event, rows.raw[index]?.event_university_name));

    await this.audits.save({
      userId: access.actorId,
      action: 'platform.event_record.search',
      entity: 'event_record_search',
      entityId: 'search',
      newValues: {
        actorId: access.actorId,
        queryEntered: Boolean(query.q?.trim()),
        filters: this.auditFilters(query),
        page: query.page,
        limit: query.limit,
        resultCount: data.length,
        total,
        resultEventIds: data.map(event => event.id),
      },
      ...this.auditContext(auditContext),
    });
    return toPaginatedResponse(data, total, query);
  }

  async detail(id: string, auditContext: AuditContext = {}) {
    const access = await this.platform.require('events-data.read');
    const event = await this.events.findOneBy({ id });
    if (!event) throw new NotFoundException('Событие не найдено.');
    this.platform.assertUniversityScope(access, event.universityId);
    const university = await this.universities.findOne({ where: { id: event.universityId }, select: ['id', 'name'] });
    if (!university) throw new NotFoundException('Университет события не найден.');
    const safeEvent = this.toSafeEvent(event, university?.name);
    await this.audits.save({
      userId: access.actorId,
      action: 'platform.event_record.viewed',
      entity: 'event_record',
      entityId: id,
      newValues: {
        actorId: access.actorId,
        eventId: id,
        universityId: event.universityId,
        targetType: safeEvent.targetType,
        targetId: safeEvent.targetId,
        result: 'read',
      },
      ...this.auditContext(auditContext),
    });
    return safeEvent;
  }

  private applyFilters(qb: ReturnType<Repository<EventRecord>['createQueryBuilder']>, query: PlatformEventsQueryDto, access: Awaited<ReturnType<PlatformService['access']>>) {
    if (query.universityId) {
      if (access.owner || access.universityIds === null || access.universityIds.length > 0) {
        this.platform.assertUniversityScope(access, query.universityId);
      }
      qb.andWhere('event.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('event.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    if (query.type?.trim()) qb.andWhere('event.type = :type', { type: query.type.trim() });
    if (query.from) qb.andWhere('event.timestamp >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('event.timestamp < :to', { to: new Date(query.to) });
    if (query.priority) qb.andWhere('event.priority = :priority', { priority: query.priority });
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      const allowlistedPayloadSearch = PAYLOAD_FIELDS.map(field => `COALESCE(event.payload ->> '${field}', '') ILIKE :q ESCAPE E'\\\\'`).join(' OR ');
      qb.andWhere(`(event.type ILIKE :q ESCAPE E'\\\\' OR event."universityId"::text ILIKE :q ESCAPE E'\\\\' OR university.name ILIKE :q ESCAPE E'\\\\' OR event.target ->> 'type' ILIKE :q ESCAPE E'\\\\' OR event.target ->> 'id' ILIKE :q ESCAPE E'\\\\' OR ${allowlistedPayloadSearch})`, { q: pattern });
    }
  }

  private toSafeEvent(event: EventRecord, universityName: unknown) {
    const actor: Record<string, unknown> = isObject(event.actor) ? event.actor : {};
    const target: Record<string, unknown> = isObject(event.target) ? event.target : {};
    const recipients = Array.isArray(event.recipients) ? event.recipients : [];
    return {
      id: event.id,
      type: safeString(event.type, 100),
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : String(event.timestamp),
      universityId: event.universityId,
      universityName: safeString(universityName, 200),
      actorId: safeString(actor.id, 128),
      actorType: safeString(actor.type, 40),
      actorRole: safeString(actor.role, 80),
      targetType: safeString(target.type, 100),
      targetId: safeString(target.id, 128),
      priority: safeString(event.priority, 30),
      recipientCount: recipients.length,
      payload: sanitizePayload(event.payload),
    };
  }

  private auditFilters(query: PlatformEventsQueryDto): JsonObject {
    return {
      universityId: query.universityId ?? null,
      type: query.type?.trim() || null,
      from: query.from ?? null,
      to: query.to ?? null,
      priority: query.priority ?? null,
    };
  }

  private auditContext(context: AuditContext) {
    return {
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    };
  }
}

function sanitizePayload(value: unknown): JsonObject {
  if (!isObject(value)) return {};
  const result: JsonObject = {};
  for (const field of PAYLOAD_FIELDS) {
    const candidate = value[field];
    if (candidate === null || typeof candidate === 'boolean' || (typeof candidate === 'number' && Number.isFinite(candidate))) {
      result[field] = candidate as JsonPrimitive;
      continue;
    }
    if (typeof candidate !== 'string') continue;
    const cleaned = candidate.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (field === 'deepLink') {
      if (!cleaned.startsWith('/') || cleaned.startsWith('//')) continue;
      const pathOnly = cleaned.split(/[?#]/, 1)[0];
      result[field] = pathOnly.slice(0, MAX_PAYLOAD_STRING_LENGTH);
    } else {
      result[field] = cleaned.slice(0, MAX_PAYLOAD_STRING_LENGTH);
    }
  }
  return result;
}

function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || !value) return null;
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength) || null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
