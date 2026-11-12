import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { InboxItem } from '../notifications/entities/inbox-item.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { PlatformService } from '../platform/platform.service';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { PlatformDeviceTokenQueryDto, PlatformNotificationKind, PlatformNotificationPatchDto, PlatformNotificationQueryDto } from './platform-notifications.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };
type OperatorSummary = { id: string; kind: PlatformNotificationKind; userId: string; userName: string; userEmail: string; organizationId: string; universityName: string; title: string; status: string; priority: string; createdAt: Date; updatedAt: Date };

@Injectable()
export class PlatformNotificationsService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async records(query: PlatformNotificationQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('notification-data.read');
    this.assertKind(query.kind);
    if (query.organizationId) this.platform.assertUniversityScope(access, query.organizationId);
    if (query.userId) await this.assertUserScope(query.userId, access);
    const qb = (query.kind === 'notification'
      ? this.notificationQuery()
      : this.inboxQuery()) as unknown as SelectQueryBuilder<Notification | InboxItem>;
    this.applyUniversityScope(qb, access);
    if (query.userId) qb.andWhere('record.userId = :userId', { userId: query.userId });
    if (query.organizationId) qb.andWhere('record.organizationId = :organizationId', { organizationId: query.organizationId });
    if (query.status) {
      if (query.kind === 'notification') {
        if (!['read', 'unread'].includes(query.status)) throw new BadRequestException('Для уведомления выберите статус read или unread.');
        qb.andWhere('record.isRead = :isRead', { isRead: query.status === 'read' });
      } else {
        if (!['open', 'snoozed', 'done'].includes(query.status)) throw new BadRequestException('Неизвестный статус inbox-записи.');
        qb.andWhere('record.status = :status', { status: query.status });
      }
    }
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(query.kind === 'notification'
        ? "(record.id::text ILIKE :q ESCAPE E'\\\\' OR record.userId::text ILIKE :q ESCAPE E'\\\\' OR user.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', user.firstName, user.lastName) ILIKE :q ESCAPE E'\\\\' OR record.title ILIKE :q ESCAPE E'\\\\' OR record.body ILIKE :q ESCAPE E'\\\\')"
        : "(record.id::text ILIKE :q ESCAPE E'\\\\' OR record.userId::text ILIKE :q ESCAPE E'\\\\' OR user.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', user.firstName, user.lastName) ILIKE :q ESCAPE E'\\\\' OR record.title ILIKE :q ESCAPE E'\\\\' OR record.description ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('record.createdAt', 'DESC').addOrderBy('record.id', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawMany<OperatorSummary>();
    await this.audit(this.db.manager, access.actorId, 'platform.notification_data.search', query.kind, 'search', {
      kind: query.kind, userId: query.userId ?? null, organizationId: query.organizationId ?? null,
      status: query.status ?? null, queryEntered: Boolean(query.q?.trim()), page: query.page,
      limit: query.limit, resultCount: rows.length, total, recordIds: rows.map(row => row.id),
    }, context);
    return toPaginatedResponse(rows.map(row => ({ ...row, kind: query.kind })), total, query);
  }

  async record(kind: PlatformNotificationKind, id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('notification-data.read');
    this.assertKind(kind);
    return this.db.transaction(async manager => {
      const detail = await this.loadDetail(manager, kind, id, access);
      await this.audit(manager, access.actorId, 'platform.notification_data.viewed', kind, id, {
        kind, targetUserId: detail.user.id, organizationId: detail.university.id, result: 'viewed',
      }, context);
      return detail;
    });
  }

  async patch(kind: PlatformNotificationKind, id: string, dto: PlatformNotificationPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('notification-data.write');
    this.assertKind(kind);
    if (dto.reason.trim().length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
    if (kind === 'notification' && ['status', 'description', 'priority', 'dueAt', 'completedAt'].some(key => dto[key as keyof PlatformNotificationPatchDto] !== undefined)) throw new BadRequestException('Для уведомления указаны поля inbox-записи.');
    if (kind === 'inbox' && ['isRead', 'body', 'readAt'].some(key => dto[key as keyof PlatformNotificationPatchDto] !== undefined)) throw new BadRequestException('Для inbox-записи указаны поля уведомления.');
    const mutable = kind === 'notification'
      ? ['isRead', 'readAt', 'title', 'body', 'deepLink']
      : ['status', 'title', 'description', 'deepLink', 'priority', 'dueAt', 'completedAt'];
    if (!mutable.some(key => dto[key as keyof PlatformNotificationPatchDto] !== undefined)) throw new BadRequestException('Укажите хотя бы одно поле для исправления.');

    return this.db.transaction(async manager => {
      const entity = kind === 'notification'
        ? await manager.findOne(Notification, { where: { id }, lock: { mode: 'pessimistic_write' } })
        : await manager.findOne(InboxItem, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!entity) throw new NotFoundException('Запись уведомления не найдена.');
      const relation = await this.assertRecordContext(manager, entity.userId, entity.organizationId, access);
      const oldValues = this.snapshot(kind, entity);
      if (kind === 'notification') this.applyNotificationPatch(entity as Notification, dto);
      else this.applyInboxPatch(entity as InboxItem, dto);
      const newValues = this.snapshot(kind, entity);
      if (JSON.stringify(oldValues) === JSON.stringify(newValues)) throw new ConflictException('Исправленные значения совпадают с текущими.');
      const saved = kind === 'notification'
        ? await manager.save(Notification, entity as Notification)
        : await manager.save(InboxItem, entity as InboxItem);
      await this.audit(manager, access.actorId, 'platform.notification_data.corrected', kind, id, {
        oldValues, newValues, targetUserId: entity.userId, organizationId: relation.organizationId,
        reason: dto.reason.trim(), result: 'corrected',
      }, context);
      return { id, kind, updatedAt: saved.updatedAt };
    });
  }

  async devices(query: PlatformDeviceTokenQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('notification-data.read');
    if (query.userId) await this.assertUserScope(query.userId, access);
    const qb = this.db.getRepository(DeviceToken).createQueryBuilder('record')
      .innerJoin(User, 'user', 'user.id = record.userId')
      .select('record.id', 'id').addSelect('record.userId', 'userId')
      .addSelect("concat_ws(' ', user.firstName, user.lastName)", 'userName')
      .addSelect('user.email', 'userEmail').addSelect('record.platform', 'platform')
      .addSelect('record.deviceName', 'deviceName').addSelect('record.isActive', 'isActive')
      .addSelect('record.createdAt', 'createdAt').addSelect('record.updatedAt', 'updatedAt')
      .addSelect('user.organizationId', 'organizationId');
    this.applyUserUniversityScope(qb, access);
    if (query.userId) qb.andWhere('record.userId = :userId', { userId: query.userId });
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(record.id::text ILIKE :q ESCAPE E'\\\\' OR record.userId::text ILIKE :q ESCAPE E'\\\\' OR user.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', user.firstName, user.lastName) ILIKE :q ESCAPE E'\\\\' OR COALESCE(record.deviceName, '') ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('record.createdAt', 'DESC').addOrderBy('record.id', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawMany();
    await this.audit(this.db.manager, access.actorId, 'platform.notification_data.devices_searched', 'device_token', 'devices', {
      userId: query.userId ?? null, queryEntered: Boolean(query.q?.trim()), page: query.page,
      limit: query.limit, resultCount: rows.length, total, deviceIds: rows.map(row => row.id),
      organizationIds: [...new Set(rows.map(row => row.organizationId).filter((id): id is string => Boolean(id)))],
    }, context);
    return toPaginatedResponse(rows.map(({ organizationId: _organizationId, ...row }) => row), total, query);
  }

  async revokeDevice(id: string, reason: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('notification-data.write');
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
    return this.db.transaction(async manager => {
      const record = await manager.findOne(DeviceToken, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Push-устройство не найдено.');
      const user = await manager.findOne(User, { where: { id: record.userId }, select: ['id', 'organizationId'] });
      if (!user) throw new BadRequestException('Устройство связано с отсутствующим пользователем.');
      this.platform.assertUniversityScope(access, user.organizationId);
      if (!record.isActive) throw new ConflictException('Push-устройство уже отозвано.');
      record.isActive = false;
      await manager.save(DeviceToken, record);
      await this.audit(manager, access.actorId, 'platform.notification_data.device_revoked', 'device_token', id, {
        targetUserId: record.userId, organizationId: user.organizationId ?? null,
        platform: record.platform, deviceName: record.deviceName ?? null,
        result: 'revoked', reason: reason.trim(),
      }, context);
      return { id, isActive: false };
    });
  }

  private notificationQuery() {
    return this.db.getRepository(Notification).createQueryBuilder('record')
      .innerJoin(User, 'user', 'user.id = record.userId')
      .innerJoin(University, 'university', 'university.id = record.organizationId')
      .select('record.id', 'id').addSelect('record.userId', 'userId')
      .addSelect("concat_ws(' ', user.firstName, user.lastName)", 'userName')
      .addSelect('user.email', 'userEmail').addSelect('record.organizationId', 'organizationId')
      .addSelect('university.name', 'universityName').addSelect('record.title', 'title')
      .addSelect("CASE WHEN record.isRead THEN 'read' ELSE 'unread' END", 'status')
      .addSelect('record.priority', 'priority').addSelect('record.createdAt', 'createdAt').addSelect('record.updatedAt', 'updatedAt');
  }

  private inboxQuery() {
    return this.db.getRepository(InboxItem).createQueryBuilder('record')
      .innerJoin(User, 'user', 'user.id = record.userId')
      .innerJoin(University, 'university', 'university.id = record.organizationId')
      .select('record.id', 'id').addSelect('record.userId', 'userId')
      .addSelect("concat_ws(' ', user.firstName, user.lastName)", 'userName')
      .addSelect('user.email', 'userEmail').addSelect('record.organizationId', 'organizationId')
      .addSelect('university.name', 'universityName').addSelect('record.title', 'title')
      .addSelect('record.status', 'status').addSelect('record.priority', 'priority')
      .addSelect('record.createdAt', 'createdAt').addSelect('record.updatedAt', 'updatedAt');
  }

  private async loadDetail(manager: EntityManager, kind: PlatformNotificationKind, id: string, access: Awaited<ReturnType<PlatformService['access']>>) {
    const entity = kind === 'notification'
      ? await manager.findOne(Notification, { where: { id } })
      : await manager.findOne(InboxItem, { where: { id } });
    if (!entity) throw new NotFoundException('Запись уведомления не найдена.');
    const relation = await this.assertRecordContext(manager, entity.userId, entity.organizationId, access);
    return {
      ...entity,
      kind,
      status: kind === 'notification' ? ((entity as Notification).isRead ? 'read' : 'unread') : (entity as InboxItem).status,
      user: relation.user,
      userName: `${relation.user.firstName} ${relation.user.lastName}`.trim(),
      userEmail: relation.user.email,
      university: relation.university,
      organizationId: relation.organizationId,
      universityName: relation.university.name,
    };
  }

  private async assertRecordContext(manager: EntityManager, userId: string, organizationId: string, access: Awaited<ReturnType<PlatformService['access']>>) {
    const [user, university] = await Promise.all([
      manager.findOne(User, { where: { id: userId }, select: ['id', 'firstName', 'lastName', 'email'] }),
      manager.findOne(University, { where: { id: organizationId }, select: ['id', 'name'] }),
    ]);
    if (!user || !university) throw new BadRequestException('Запись уведомления ссылается на отсутствующего пользователя или университет.');
    this.platform.assertUniversityScope(access, university.id);
    return { user, university, organizationId: university.id };
  }

  private applyUniversityScope<T extends Notification | InboxItem>(qb: SelectQueryBuilder<T>, access: Awaited<ReturnType<PlatformService['access']>>): void {
    if (access.owner || access.organizationIds === null) return;
    if (!access.organizationIds.length) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('record.organizationId IN (:...allowedOrganizationIds)', { allowedOrganizationIds: access.organizationIds });
  }

  private applyUserUniversityScope<T extends Notification | InboxItem | DeviceToken>(qb: SelectQueryBuilder<T>, access: Awaited<ReturnType<PlatformService['access']>>): void {
    if (access.owner || access.organizationIds === null) return;
    if (!access.organizationIds.length) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('user.organizationId IN (:...allowedOrganizationIds)', { allowedOrganizationIds: access.organizationIds });
  }

  private async assertUserScope(userId: string, access: Awaited<ReturnType<PlatformService['access']>>): Promise<void> {
    const user = await this.db.getRepository(User).findOne({ where: { id: userId }, select: ['id', 'organizationId'] });
    if (user) this.platform.assertUniversityScope(access, user.organizationId);
  }

  private applyNotificationPatch(record: Notification, dto: PlatformNotificationPatchDto): void {
    if (dto.title !== undefined) record.title = dto.title.trim();
    if (dto.body !== undefined) record.body = dto.body;
    if (dto.deepLink !== undefined) record.deepLink = this.normalizeLink(dto.deepLink);
    if (dto.isRead !== undefined) record.isRead = dto.isRead;
    if (dto.readAt !== undefined) record.readAt = dto.readAt === null ? null : new Date(dto.readAt);
    if (record.isRead && record.readAt === null) record.readAt = new Date();
    if (!record.isRead) record.readAt = null;
  }

  private applyInboxPatch(record: InboxItem, dto: PlatformNotificationPatchDto): void {
    if (dto.title !== undefined) record.title = dto.title.trim();
    if (dto.description !== undefined) record.description = dto.description;
    if (dto.deepLink !== undefined) record.deepLink = this.normalizeLink(dto.deepLink);
    if (dto.priority !== undefined) record.priority = dto.priority;
    if (dto.dueAt !== undefined) record.dueAt = dto.dueAt === null ? null : new Date(dto.dueAt);
    if (dto.completedAt !== undefined) record.completedAt = dto.completedAt === null ? null : new Date(dto.completedAt);
    if (dto.status !== undefined) record.status = dto.status;
    if (record.status === 'done' && record.completedAt === null) record.completedAt = new Date();
    if (record.status !== 'done' && dto.status !== undefined && dto.completedAt === undefined) record.completedAt = null;
    if (record.status === 'snoozed' && record.dueAt === null) throw new BadRequestException('Для отложенной inbox-записи укажите срок напоминания.');
    if (record.status !== 'done' && record.completedAt !== null) throw new BadRequestException('Дата завершения допустима только для inbox-записи со статусом done.');
  }

  private snapshot(kind: PlatformNotificationKind, entity: Notification | InboxItem): JsonObject {
    if (kind === 'notification') {
      const record = entity as Notification;
      return { type: record.type, category: record.category, title: record.title, body: record.body, deepLink: this.sanitizeAuditLink(record.deepLink), isRead: record.isRead, readAt: record.readAt?.toISOString() ?? null, priority: record.priority };
    }
    const record = entity as InboxItem;
    return { type: record.type, title: record.title, description: record.description, deepLink: this.sanitizeAuditLink(record.deepLink), status: record.status, priority: record.priority, dueAt: record.dueAt?.toISOString() ?? null, completedAt: record.completedAt?.toISOString() ?? null };
  }

  private sanitizeAuditLink(value: string | null): string | null {
    if (!value) return null;
    try {
      const url = new URL(value, 'https://napare.invalid');
      if (url.search) url.search = '?[redacted]';
      if (url.hash) url.hash = '#[redacted]';
      return value.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.toString();
    } catch { return value; }
  }

  private normalizeLink(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:') throw new Error('unsafe protocol');
      return trimmed;
    } catch {
      throw new BadRequestException('Ссылка должна быть внутренним относительным путём или адресом HTTPS.');
    }
  }

  private async audit(manager: EntityManager, actorId: string, action: string, kind: PlatformNotificationKind | 'device_token', id: string, values: JsonObject, context: RequestAuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId, action, entity: `notification_data.${kind}`, entityId: id, newValues: values,
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private assertKind(kind: string): asserts kind is PlatformNotificationKind {
    if (kind !== 'notification' && kind !== 'inbox') throw new BadRequestException('Неизвестный тип записи уведомлений.');
  }
}
