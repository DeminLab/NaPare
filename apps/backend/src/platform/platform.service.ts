import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, DataSource, EntityManager, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { Group } from '../users/entities/group.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { TelegramLinkChallenge } from '../users/entities/telegram-link-challenge.entity';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { RaspScraperService, SIBIT_UNIVERSITY } from '../auth/rasp-scraper.service';
import { PlatformControl, PlatformGrant } from './platform.entity';
import { PLATFORM_PERMISSIONS, PlatformAccountDto, PlatformCreateAccountDto, PlatformFacultyDto, PlatformGrantDto, PlatformGroupDto, PlatformJobDto, PlatformPermission, PlatformQueryDto, PlatformSettingsDto, PlatformUniversityDto, SERVICE_IDS } from './platform.dto';
import { ControlAgentClient } from './control-agent.client';
import { platformDatabaseGrants, PLATFORM_TENANT_TABLES } from '../common/tenant/tenant-database-platform';

type AgentJob = { id: string; service: string; action: string; status: string; actorId: string; createdAt: string; log?: string };
type PlatformAuditContext = { ip?: string; userAgent?: string };
const safeAccount = ({ id, email, firstName, lastName, role, universityId, groupId, isActive, lastLoginAt }: User) => ({ id, email, firstName, lastName, role, universityId, groupId, isActive, lastLoginAt });

@Injectable()
export class PlatformService {
  constructor(private readonly db: DataSource, private readonly tenant: TenantContext, private readonly agent: ControlAgentClient, private readonly raspScraper: RaspScraperService) {}
  async access() {
    const actor = this.tenant.getUser();
    if (!actor || ![UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(actor.role)) throw new ForbiddenException('Требуется доступ к управлению платформой.');
    const control = await this.db.getRepository(PlatformControl).findOneBy({ id: 'platform' });
    const owner = !!control && control.ownerId === actor.id;
    const grant = control && !owner ? await this.db.getRepository(PlatformGrant).findOneBy({ userId: actor.id }) : null;
    const permissions = new Set(owner ? [...PLATFORM_PERMISSIONS] : grant?.permissions ?? []);
    if ([
      'accounts.read', 'accounts.write', 'student-data.read', 'personal-data.read', 'attendance-qr.read',
      'homework-data.read', 'notification-data.read', 'curation-data.read', 'pairspace-content.read',
      'academic-data.read', 'career-data.read', 'discussion-data.read', 'events-data.read', 'attachments-data.read',
    ].some(permission => permissions.has(permission))) permissions.add('universities.read');
    if (permissions.has('identity-links.write')) permissions.add('identity-links.read');
    return { owner, ownerConfigured: !!control, permissions: [...permissions], serviceIds: owner ? [...SERVICE_IDS] : grant?.serviceIds ?? [], universityIds: owner ? null : grant?.universityIds ?? null, agentConfigured: this.agent.configured(), actorId: actor.id };
  }
  async require(permission: PlatformPermission, service?: string) {
    const access = await this.access();
    if (!access.permissions.includes(permission) || (service && !access.serviceIds.includes(service))) throw new ForbiddenException('Это действие не разрешено владельцем платформы.');
    for (const grant of platformDatabaseGrants(permission, access.universityIds)) this.tenant.authorizeDatabaseAccess(grant);
    return access;
  }
  async requireOwner() {
    const access = await this.access();
    if (!access.owner) throw new ForbiddenException('Управление разрешениями доступно только владельцу.');
    this.tenant.authorizeDatabaseAccess({ tables: PLATFORM_TENANT_TABLES, universityIds: null, write: true, replaceActor: true });
    return access;
  }
  assertUniversityScope(access: Awaited<ReturnType<PlatformService['access']>>, universityId: string | null | undefined) {
    if (access.owner || access.universityIds === null) return;
    if (!universityId || !access.universityIds.includes(universityId)) throw new ForbiddenException('У этого разрешения нет доступа к выбранному университету.');
  }
  async protectOwner(id: string) {
    const control = await this.db.getRepository(PlatformControl).findOneBy({ id: 'platform' });
    if (control?.ownerId === id) throw new ForbiddenException('Аккаунт владельца защищён от блокировки, смены роли и сброса доступа.');
  }
  async protectLegacyMutation(id: string) {
    await this.protectOwner(id);
    const target = await this.db.getRepository(User).findOneBy({ id });
    if (target && [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(target.role)) await this.require('accounts.write');
  }
  async clearLegacyGrant(id: string) { await this.db.getRepository(PlatformGrant).delete({ userId: id }); }
  private async audit(action: string, entityId: string, values: Record<string, string | boolean | string[] | null> = {}) {
    await this.db.getRepository(AuditLog).save({ userId: this.tenant.getUser()!.id, action: `platform.${action}`, entity: 'platform', entityId, newValues: values });
  }
  async accounts(query: PlatformQueryDto, auditContext: PlatformAuditContext = {}) {
    const access = await this.require('accounts.read');
    const qb = this.db.getRepository(User).createQueryBuilder('u');
    if (query.q) qb.andWhere("concat_ws(' ', u.email, u.firstName, u.lastName, u.phone, u.groupId, u.id) ILIKE :q", { q: `%${query.q}%` });
    if (query.universityId) { this.assertUniversityScope(access, query.universityId); qb.andWhere('u.universityId = :universityId', { universityId: query.universityId }); }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('u.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    const [data, total] = await qb.orderBy('u.createdAt', 'DESC').addOrderBy('u.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    const control = await this.db.getRepository(PlatformControl).findOneBy({ id: 'platform' });
    await this.db.getRepository(AuditLog).save({ userId: access.actorId, action: 'platform.account.search', entity: 'platform', entityId: 'accounts', newValues: { queryEntered: Boolean(query.q?.trim()), universityId: query.universityId ?? null, page: query.page, limit: query.limit, resultCount: data.length, total, resultUserIds: data.map(user => user.id) }, ...(auditContext.ip ? { ip: auditContext.ip } : {}), ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}) });
    return toPaginatedResponse(data.map(user => ({ ...safeAccount(user), isOwner: user.id === control?.ownerId })), total, query);
  }
  async account(id: string, auditContext: PlatformAuditContext = {}) {
    const access = await this.require('accounts.read');
    const user = await this.db.getRepository(User).findOne({
      where: { id },
      select: ['id', 'email', 'firstName', 'lastName', 'phone', 'avatarUrl', 'role', 'universityId', 'groupId', 'isActive', 'lastLoginAt', 'createdAt', 'updatedAt', 'maxUserId', 'telegramUserId'],
    });
    if (!user) throw new NotFoundException('Аккаунт не найден.');
    this.assertUniversityScope(access, user.universityId);
    const assignmentQuery = this.db.getRepository(CuratorAssignment).createQueryBuilder('a')
      .leftJoin(Group, 'g', 'g.id = a."groupId" AND g."universityId" = a."universityId"')
      .select(['a.id', 'a.universityId', 'a.groupId', 'a.createdAt', 'g.name'])
      .where('a."userId" = :userId AND a."revokedAt" IS NULL', { userId: id });
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) assignmentQuery.andWhere('1 = 0');
      else assignmentQuery.andWhere('a."universityId" IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    const [university, group, assignments, control, history, telegramChallenges] = await Promise.all([
      user.universityId ? this.db.getRepository(University).findOne({ where: { id: user.universityId }, select: ['id', 'name', 'city'] }) : null,
      user.universityId && user.groupId
        ? this.db.getRepository(Group).createQueryBuilder('g').select(['g.id', 'g.name', 'g.externalId', 'g.universityId']).where('g.universityId = :universityId AND (g.id::text = :groupId OR g."externalId" = :groupId)', { universityId: user.universityId, groupId: user.groupId }).getOne()
        : null,
      assignmentQuery.orderBy('a."createdAt"', 'DESC').getRawMany(),
      this.db.getRepository(PlatformControl).findOneBy({ id: 'platform' }),
      access.owner || access.universityIds === null
        ? this.db.getRepository(AuditLog).find({ where: { entity: 'platform', entityId: id }, order: { createdAt: 'DESC', id: 'DESC' }, take: 10 })
        : Promise.resolve([] as AuditLog[]),
      this.db.getRepository(TelegramLinkChallenge).createQueryBuilder('challenge').select(['challenge.id', 'challenge.expiresAt'])
        .where('challenge.userId = :id AND challenge."consumedAt" IS NULL AND challenge."expiresAt" > CURRENT_TIMESTAMP', { id })
        .orderBy('challenge.expiresAt', 'ASC').getMany(),
    ]);
    await this.db.getRepository(AuditLog).save({ userId: access.actorId, action: 'platform.account.read', entity: 'platform', entityId: id, newValues: { targetUserId: id, universityId: user.universityId ?? null, result: 'read' }, ...(auditContext.ip ? { ip: auditContext.ip } : {}), ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}) });
    return {
      ...safeAccount(user),
      phone: user.phone ?? '',
      avatarUrl: user.avatarUrl ?? '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      linkedAccounts: { max: Boolean(user.maxUserId), telegram: Boolean(user.telegramUserId) },
      telegramLink: { pendingChallenges: telegramChallenges.length, nextExpiryAt: telegramChallenges[0]?.expiresAt?.toISOString() ?? null },
      university: university ? { id: university.id, name: university.name, city: university.city } : null,
      group: group ? { id: group.id, name: group.name, externalId: group.externalId } : user.groupId ? { id: null, name: user.groupId, externalId: user.groupId } : null,
      curatorAssignments: assignments.map((assignment: { id: string; universityId: string; groupId: string; createdAt: Date; g_name?: string }) => ({ id: assignment.id, universityId: assignment.universityId, groupId: assignment.groupId, groupName: assignment.g_name ?? assignment.groupId, createdAt: assignment.createdAt })),
      recentActions: history.map(entry => ({ id: entry.id, action: entry.action, actorId: entry.userId, createdAt: entry.createdAt, oldValues: entry.oldValues, newValues: entry.newValues })),
      isOwner: user.id === control?.ownerId,
    };
  }
  private async manageable(id: string, manager: EntityManager = this.db.manager) {
    const access = await this.require('accounts.write');
    await this.protectOwner(id);
    if (id === access.actorId) throw new ForbiddenException('Изменение собственного доступа через эту форму запрещено.');
    const target = await manager.findOne(User, { where: { id }, ...(manager.queryRunner?.isTransactionActive ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!target) throw new NotFoundException('Аккаунт не найден.');
    this.assertUniversityScope(access, target.universityId);
    return { access, target };
  }
  async updateAccount(id: string, dto: PlatformAccountDto, auditContext: PlatformAuditContext = {}) {
    return this.db.transaction(async manager => {
      const { access, target } = await this.manageable(id, manager);
      if (dto.role === UserRole.CURATOR && target.role !== UserRole.CURATOR) throw new BadRequestException('Кураторство назначается дополнительно в разделе кураторства.');
      if (!access.owner && dto.role && dto.role !== target.role && ([UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(dto.role) || [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(target.role))) throw new ForbiddenException('Назначение и смена платформенной роли доступны только владельцу.');
      if ((dto.firstName !== undefined && !dto.firstName.trim()) || (dto.lastName !== undefined && !dto.lastName.trim())) throw new BadRequestException('Имя и фамилия не могут быть пустыми.');
      const current = await manager.findOneByOrFail(User, { id });
      const nextRole = dto.role ?? current.role;
      const nextUniversityId = dto.universityId !== undefined ? dto.universityId : current.universityId;
      this.assertUniversityScope(access, nextUniversityId);
      if (![UserRole.DEVELOPER, UserRole.SUPERADMIN, UserRole.EMPLOYER, UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN].includes(nextRole) && !nextUniversityId) throw new BadRequestException('Для этой роли требуется привязка к университету.');
      if (dto.universityId && !await manager.getRepository(University).existsBy({ id: dto.universityId })) throw new BadRequestException('Университет не найден.');
      if (dto.email !== undefined) {
        const email = dto.email.trim().toLowerCase();
        const duplicate = await manager.getRepository(User).createQueryBuilder('u').where('LOWER(u.email) = :email AND u.id != :id', { email, id }).getExists();
        if (duplicate) throw new ConflictException('Email уже используется.');
        dto.email = email;
      }
      if (dto.phone !== undefined && dto.phone !== null) dto.phone = dto.phone.trim() || null;
      if (dto.avatarUrl !== undefined && dto.avatarUrl !== null) dto.avatarUrl = dto.avatarUrl.trim() || null;
      if (dto.universityId !== undefined && dto.universityId !== current.universityId && dto.groupId === undefined) {
        const activeAssignments = await manager.getRepository(CuratorAssignment).countBy({ userId: id, revokedAt: IsNull() });
        if (activeAssignments) throw new BadRequestException('Сначала отзовите активные назначения куратора, затем переносите аккаунт в другой университет.');
        dto.groupId = null;
      }
      const nextGroupId = dto.groupId !== undefined ? dto.groupId : current.groupId;
      if (nextGroupId) {
        if (nextRole !== UserRole.STUDENT) throw new BadRequestException('Учебную группу можно назначить только аккаунту студента.');
        if (!nextUniversityId) throw new BadRequestException('Сначала привяжите аккаунт к университету.');
        const localGroup = await manager.getRepository(Group).createQueryBuilder('g')
          .where('g.universityId = :universityId AND (g.id::text = :groupId OR g."externalId" = :groupId)', { universityId: nextUniversityId, groupId: nextGroupId }).getOne();
        if (!localGroup) {
          const university = await manager.getRepository(University).findOneBy({ id: nextUniversityId });
          const isSibit = university?.name === SIBIT_UNIVERSITY.name && university.city === SIBIT_UNIVERSITY.city && university.connectorType === 'rasp-sano';
          if (!isSibit || !/^\d+$/.test(nextGroupId) || !await this.raspScraper.isValidGroup(nextGroupId)) throw new BadRequestException('Выберите существующую группу этого университета.');
        }
      }
      const { reason: suppliedReason, ...requestedChanges } = dto;
      const changes = Object.fromEntries(Object.entries(requestedChanges).filter(([key, value]) => value !== undefined && current[key as keyof User] !== value));
      if (!Object.keys(changes).length) return safeAccount(current);
      const oldValues: JsonObject = {};
      const newValues: JsonObject = {};
      for (const [key, value] of Object.entries(changes)) {
        oldValues[key] = (current[key as keyof User] ?? null) as JsonObject[string];
        newValues[key] = value as JsonObject[string];
      }
      const accessChanged = ['email', 'role', 'isActive', 'universityId', 'groupId'].some(key => key in changes);
      // Only changes that affect login or authorization invalidate existing sessions.
      await manager.update(User, id, { ...changes, ...(accessChanged ? { sessionVersion: () => '"sessionVersion" + 1' } : {}) });
      if (dto.role && dto.role !== current.role) await manager.delete(PlatformGrant, { userId: id });
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.updated', entity: 'platform', entityId: id, oldValues, newValues: { ...newValues, targetUserId: id, universityId: nextUniversityId ?? null, reason: suppliedReason?.trim() || 'Изменение аккаунта через управление платформой', result: 'updated' }, ...(auditContext.ip ? { ip: auditContext.ip } : {}), ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}) });
      return safeAccount(await manager.findOneByOrFail(User, { id }));
    });
  }
  async createAccount(dto: PlatformCreateAccountDto, auditContext: PlatformAuditContext = {}) {
    const access = await this.require('accounts.write');
    if (Buffer.byteLength(dto.password) > 72) throw new BadRequestException('Пароль должен занимать не более 72 байт UTF-8.');
    if (!dto.firstName?.trim() || !dto.lastName?.trim() || !dto.role) throw new BadRequestException('Укажите имя, фамилию и основную роль.');
    if (dto.role === UserRole.CURATOR) throw new BadRequestException('Кураторство назначается существующему аккаунту.');
    if (!access.owner && [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(dto.role)) throw new ForbiddenException('Платформенные роли назначает только владелец.');
    this.assertUniversityScope(access, dto.universityId);
    if (dto.universityId && !await this.db.getRepository(University).existsBy({ id: dto.universityId })) throw new BadRequestException('Университет не найден.');
    if (![UserRole.DEVELOPER, UserRole.SUPERADMIN, UserRole.EMPLOYER, UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN].includes(dto.role) && !dto.universityId) throw new BadRequestException('Для учебного аккаунта требуется университет.');
    if (dto.groupId) {
      if (dto.role !== UserRole.STUDENT) throw new BadRequestException('Учебная группа назначается аккаунту студента.');
      const university = dto.universityId ? await this.db.getRepository(University).findOneBy({ id: dto.universityId }) : null;
      if (university?.name !== SIBIT_UNIVERSITY.name || university.city !== SIBIT_UNIVERSITY.city || university.connectorType !== 'rasp-sano') throw new BadRequestException('Выберите университет СИБИТ с подключённым каталогом расписания.');
      if (!/^\d+$/.test(dto.groupId) || !await this.raspScraper.isValidGroup(dto.groupId)) throw new BadRequestException('Выберите группу из каталога СИБИТ.');
    }
    const email = dto.email.trim().toLowerCase();
    if (await this.db.getRepository(User).createQueryBuilder('u').where('LOWER(u.email) = :email', { email }).getExists()) throw new ConflictException('Email уже используется.');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.db.transaction(async manager => {
      let user: User;
      try { user = await manager.save(User, manager.create(User, { email, firstName: dto.firstName!.trim(), lastName: dto.lastName!.trim(), role: dto.role, universityId: dto.universityId ?? null, groupId: dto.groupId ?? undefined, passwordHash, isActive: dto.isActive ?? true })); }
      catch (error) { if ((error as { code?: string }).code === '23505') throw new ConflictException('Email уже используется.'); throw error; }
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.created', entity: 'platform', entityId: user.id, newValues: { role: user.role, result: 'created' }, ...(auditContext.ip ? { ip: auditContext.ip } : {}), ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}) });
      return safeAccount(user);
    });
  }
  async resetPassword(id: string, password: string, auditContext: PlatformAuditContext = {}) {
    await this.require('accounts.write');
    if (Buffer.byteLength(password) > 72) throw new BadRequestException('Пароль должен занимать не более 72 байт UTF-8.');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.transaction(async manager => {
      const { access } = await this.manageable(id, manager);
      await manager.update(User, id, { passwordHash, sessionVersion: () => '"sessionVersion" + 1' });
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.password_reset', entity: 'platform', entityId: id, newValues: { result: 'password_reset' }, ...(auditContext.ip ? { ip: auditContext.ip } : {}), ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}) });
    });
    return { changed: true };
  }
  async revokeSessions(id: string, auditContext: PlatformAuditContext = {}) {
    await this.db.transaction(async manager => {
      const { access } = await this.manageable(id, manager);
      await manager.increment(User, { id }, 'sessionVersion', 1);
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.sessions_revoked', entity: 'platform', entityId: id, newValues: { result: 'sessions_revoked' }, ...(auditContext.ip ? { ip: auditContext.ip } : {}), ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}) });
    });
    return { changed: true };
  }
  async unlinkMaxIdentity(id: string, reason: string, auditContext: PlatformAuditContext = {}) {
    const access = await this.require('identity-links.write');
    if (id === access.actorId) throw new ForbiddenException('Нельзя отзывать внешнюю привязку собственного аккаунта.');
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину отзыва длиной не менее 3 символов.');
    return this.db.transaction(async manager => {
      const target = await manager.findOne(User, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!target) throw new NotFoundException('Аккаунт не найден.');
      const control = await manager.findOne(PlatformControl, { where: { id: 'platform' }, lock: { mode: 'pessimistic_read' } });
      if (control?.ownerId === id) throw new ForbiddenException('Внешнюю привязку аккаунта владельца нельзя отозвать.');
      if (!target.maxUserId) throw new ConflictException('У аккаунта нет активной MAX-привязки.');
      await manager.update(User, id, { maxUserId: null, sessionVersion: () => '\"sessionVersion\" + 1' });
      await manager.save(AuditLog, {
        userId: access.actorId,
        action: 'platform.account.identity_max_unlinked',
        entity: 'platform',
        entityId: id,
        oldValues: { maxLinked: true },
        newValues: { maxLinked: false, targetUserId: id, universityId: target.universityId ?? null, provider: 'max', reason: reason.trim(), sessionsRevoked: true, result: 'unlinked' },
        ...(auditContext.ip ? { ip: auditContext.ip } : {}),
        ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}),
      });
      return { changed: true, maxLinked: false, sessionsRevoked: true };
    });
  }
  async revokeTelegramIdentity(id: string, reason: string, auditContext: PlatformAuditContext = {}) {
    const access = await this.require('identity-links.write');
    if (id === access.actorId) throw new ForbiddenException('Нельзя отзывать Telegram-привязку собственного аккаунта.');
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3 || normalizedReason.length > 500) throw new BadRequestException('Укажите причину отзыва длиной от 3 до 500 символов.');
    return this.db.transaction(async manager => {
      const target = await manager.findOne(User, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!target) throw new NotFoundException('Аккаунт не найден.');
      const control = await manager.findOne(PlatformControl, { where: { id: 'platform' }, lock: { mode: 'pessimistic_read' } });
      if (control?.ownerId === id) throw new ForbiddenException('Telegram-привязку аккаунта владельца нельзя отозвать.');
      const challenges = await manager.getRepository(TelegramLinkChallenge).createQueryBuilder()
        .update(TelegramLinkChallenge).set({ consumedAt: () => 'CURRENT_TIMESTAMP' })
        .where('"userId" = :id AND "consumedAt" IS NULL', { id }).execute();
      const wasLinked = Boolean(target.telegramUserId);
      if (!wasLinked && !challenges.affected) throw new ConflictException('У аккаунта нет активной Telegram-привязки или ожидающего подключения.');
      if (wasLinked) await manager.update(User, id, { telegramUserId: null, sessionVersion: () => '"sessionVersion" + 1' });
      await manager.save(AuditLog, {
        userId: access.actorId, action: 'platform.account.identity_telegram_revoked', entity: 'platform', entityId: id,
        oldValues: { telegramLinked: wasLinked, pendingChallengesRevoked: challenges.affected ?? 0 },
        newValues: { telegramLinked: false, pendingChallengesRevoked: challenges.affected ?? 0, targetUserId: id, universityId: target.universityId ?? null, provider: 'telegram', reason: normalizedReason, sessionsRevoked: wasLinked, result: 'revoked' },
        ...(auditContext.ip ? { ip: auditContext.ip } : {}),
        ...(auditContext.userAgent ? { userAgent: auditContext.userAgent.slice(0, 512) } : {}),
      });
      return { changed: true, telegramLinked: false, pendingChallengesRevoked: challenges.affected ?? 0, sessionsRevoked: wasLinked };
    });
  }
  async grants(query: PlatformQueryDto) {
    await this.requireOwner();
    const qb = this.db.getRepository(User).createQueryBuilder('u').where('u.role IN (:...roles)', { roles: [UserRole.DEVELOPER, UserRole.SUPERADMIN] });
    if (query.q) qb.andWhere("concat_ws(' ', u.email, u.firstName, u.lastName) ILIKE :q", { q: `%${query.q}%` });
    const [data, total] = await qb.orderBy('u.email', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    const grants = await this.db.getRepository(PlatformGrant).find();
    return toPaginatedResponse(data.map(user => {
      const grant = grants.find(g => g.userId === user.id);
      return { ...safeAccount(user), grant: grant ? { permissions: grant.permissions, serviceIds: grant.serviceIds, universityIds: grant.universityIds } : null };
    }), total, query);
  }
  async setGrant(id: string, dto: PlatformGrantDto) {
    const access = await this.requireOwner();
    await this.protectOwner(id);
    const permissions = new Set(dto.permissions);
    const universityScopedPermissions = [
      'accounts.read', 'accounts.write', 'universities.read',
      'student-data.read', 'student-data.write', 'personal-data.read', 'personal-data.write',
      'attendance-qr.read', 'attendance-qr.revoke', 'homework-data.read', 'homework-data.write',
      'notification-data.read', 'notification-data.write', 'curation-data.read', 'curation-data.write',
      'pairspace-content.read', 'pairspace-content.write', 'attachments-data.read', 'attachments-data.write',
      'academic-data.read', 'academic-data.write', 'events-data.read', 'discussion-data.read', 'discussion-data.write',
      'career-data.read', 'career-data.write',
    ];
    if (dto.permissions.some(p => p.startsWith('services.') || p === 'logs.read')) {
      if (!dto.serviceIds.length) throw new BadRequestException('Выберите сервисы для выданных разрешений.');
      permissions.add('services.read');
    }
    for (const [write, read] of [['accounts.write','accounts.read'], ['identity-links.write','identity-links.read'], ['universities.write','universities.read'], ['student-data.write','student-data.read'], ['attendance-qr.revoke','attendance-qr.read'], ['personal-data.write','personal-data.read'], ['homework-data.write','homework-data.read'], ['notification-data.write','notification-data.read'], ['curation-data.write','curation-data.read'], ['academic-data.write','academic-data.read'], ['career-data.write','career-data.read'], ['discussion-data.write','discussion-data.read'], ['pairspace-content.write','pairspace-content.read'], ['attachments-data.write','attachments-data.read'], ['settings.write','settings.read']] as const) if (permissions.has(write)) permissions.add(read);
    await this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(707247126)');
      const user = await manager.findOne(User, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!user?.isActive || ![UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(user.role)) throw new BadRequestException('Выберите действующий аккаунт разработчика.');
      const existing = await manager.getRepository(PlatformGrant).findOneBy({ userId: id });
      const universityIds = dto.universityIds === undefined ? existing?.universityIds ?? null : dto.universityIds;
      if (universityIds !== null) {
        const unique = new Set(universityIds);
        const validCount = unique.size ? await manager.getRepository(University).createQueryBuilder('u').where('u.id IN (:...ids)', { ids: [...unique] }).getCount() : 0;
        if (validCount !== unique.size) throw new BadRequestException('Выберите только существующие университеты.');
      }
      if (universityIds !== null && dto.permissions.some(permission => !universityScopedPermissions.includes(permission))) {
        throw new BadRequestException('Для ограниченной области доступны только разрешения, изолированные по выбранным вузам. Управление компаниями, сервисами и другими глобальными операциями требует доступа ко всем вузам.');
      }
      await manager.upsert(PlatformGrant, { userId: id, permissions: [...permissions], serviceIds: dto.serviceIds, universityIds, grantedBy: access.actorId }, ['userId']);
      await manager.save(AuditLog, {
        userId: access.actorId, action: 'platform.permissions.updated', entity: 'platform', entityId: id,
        ...(existing ? { oldValues: { permissions: existing.permissions, serviceIds: existing.serviceIds, universityIds: existing.universityIds } } : {}),
        newValues: { permissions: [...permissions], serviceIds: dto.serviceIds, universityIds },
      });
    });
    return { changed: true };
  }
  async emergencyRevoke(password: string) {
    const access = await this.requireOwner();
    const owner = await this.db.getRepository(User).findOneByOrFail({ id: access.actorId });
    if (!await bcrypt.compare(password, owner.passwordHash)) throw new ForbiddenException('Неверный пароль владельца.');
    return this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(707247126)');
      const revoked = await manager.createQueryBuilder().delete().from(PlatformGrant).where('"userId" != :owner', { owner: access.actorId }).execute();
      const sessions = await manager.createQueryBuilder().update(User).set({ sessionVersion: () => '"sessionVersion" + 1' }).where('role IN (:...roles) AND id != :owner', { roles: [UserRole.DEVELOPER, UserRole.SUPERADMIN], owner: access.actorId }).execute();
      const result = { grantsRevoked: revoked.affected ?? 0, accountsSignedOut: sessions.affected ?? 0 };
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.trust.emergency_revoked', entity: 'platform', entityId: 'platform', newValues: result });
      return result;
    });
  }
  async settings(publicOnly = false) {
    if (!publicOnly) await this.require('settings.read');
    const settings = await this.db.getRepository(PlatformControl).findOneBy({ id: 'platform' });
    return { platformName: settings?.platformName ?? 'НаПаре', supportEmail: settings?.supportEmail ?? '', announcement: settings?.announcement ?? '', readOnly: settings?.readOnly ?? false };
  }
  async updateSettings(dto: PlatformSettingsDto) {
    const access = await this.require('settings.write');
    if (!dto.platformName.trim() || (dto.supportEmail && !isEmail(dto.supportEmail))) throw new BadRequestException('Проверьте название платформы и email поддержки.');
    await this.db.transaction(async manager => {
      await manager.update(PlatformControl, { id: 'platform' }, { ...dto, platformName: dto.platformName.trim() });
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.settings.updated', entity: 'platform', entityId: 'platform', newValues: { ...dto } });
    });
    return this.settings(true);
  }
  async universities(query: PlatformQueryDto) {
    const access = await this.require('universities.read');
    const qb = this.db.getRepository(University).createQueryBuilder('u').select(['u.id', 'u.name', 'u.city', 'u.status', 'u.connectorType']);
    if (query.q) qb.where('u.name ILIKE :q', { q: `%${query.q}%` });
    if (query.universityId) { this.assertUniversityScope(access, query.universityId); qb.andWhere('u.id = :universityId', { universityId: query.universityId }); }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('u.id IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    const [data, total] = await qb.orderBy('u.name', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(data, total, query);
  }
  async groups(universityId: string) {
    const access = await this.require('universities.read');
    this.assertUniversityScope(access, universityId);
    if (!await this.db.getRepository(University).existsBy({ id: universityId })) throw new NotFoundException('Университет не найден.');
    return this.db.getRepository(Group).createQueryBuilder('g')
      .select(['g.id', 'g.name', 'g.externalId', 'g.curriculumYear', 'g.universityId'])
      .where('g.universityId = :universityId', { universityId })
      .orderBy('g.name', 'ASC').getMany();
  }
  async organizationFaculties(query: PlatformQueryDto) {
    const access = await this.require('universities.read');
    if (!query.universityId) throw new BadRequestException('Выберите университет.');
    this.assertUniversityScope(access, query.universityId);
    if (!await this.db.getRepository(University).existsBy({ id: query.universityId })) throw new NotFoundException('Университет не найден.');
    const qb = this.db.getRepository(Faculty).createQueryBuilder('f')
      .select(['f.id', 'f.universityId', 'f.name', 'f.code', 'f.createdAt', 'f.updatedAt'])
      .addSelect('(SELECT COUNT(*) FROM "groups" g WHERE g."facultyId" = f.id)', 'groupCount')
      .where('f.universityId = :universityId', { universityId: query.universityId });
    if (query.q?.trim()) qb.andWhere("(f.name ILIKE :q OR f.code ILIKE :q OR f.id::text ILIKE :q)", { q: `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%` });
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('f.name', 'ASC').addOrderBy('f.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const countById = new Map(rows.raw.map(row => [row.f_id, Number(row.groupCount)]));
    await this.db.getRepository(AuditLog).save({ userId: this.tenant.getUser()!.id, action: 'platform.organization.faculty.search', entity: 'platform', entityId: query.universityId, newValues: { universityId: query.universityId, queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.entities.length, total } });
    return toPaginatedResponse(rows.entities.map(faculty => ({ id: faculty.id, universityId: faculty.universityId, name: faculty.name, code: faculty.code, groupCount: countById.get(faculty.id) ?? 0, createdAt: faculty.createdAt, updatedAt: faculty.updatedAt })), total, query);
  }
  async organizationGroups(query: PlatformQueryDto) {
    const access = await this.require('universities.read');
    if (!query.universityId) throw new BadRequestException('Выберите университет.');
    this.assertUniversityScope(access, query.universityId);
    if (!await this.db.getRepository(University).existsBy({ id: query.universityId })) throw new NotFoundException('Университет не найден.');
    const qb = this.db.getRepository(Group).createQueryBuilder('g')
      .leftJoin(Faculty, 'f', 'f.id = g."facultyId" AND f."universityId" = g."universityId"')
      .select(['g.id', 'g.universityId', 'g.facultyId', 'g.name', 'g.externalId', 'g.curriculumYear', 'g.specialization', 'g.createdAt', 'g.updatedAt'])
      .addSelect('f.name', 'facultyName')
      .where('g.universityId = :universityId', { universityId: query.universityId });
    if (query.q?.trim()) qb.andWhere("(g.name ILIKE :q OR COALESCE(g.\"externalId\", '') ILIKE :q OR COALESCE(g.specialization, '') ILIKE :q OR f.name ILIKE :q OR g.id::text ILIKE :q)", { q: `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%` });
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('g.name', 'ASC').addOrderBy('g.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const facultyNameByGroup = new Map(rows.raw.map(row => [row.g_id, row.facultyName ?? '']));
    await this.db.getRepository(AuditLog).save({ userId: this.tenant.getUser()!.id, action: 'platform.organization.group.search', entity: 'platform', entityId: query.universityId, newValues: { universityId: query.universityId, queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.entities.length, total } });
    return toPaginatedResponse(rows.entities.map(group => ({ id: group.id, universityId: group.universityId, facultyId: group.facultyId, facultyName: facultyNameByGroup.get(group.id) ?? '', name: group.name, externalId: group.externalId, curriculumYear: group.curriculumYear, specialization: group.specialization ?? '', curatorManagedSeparately: Boolean(group.curatorId), createdAt: group.createdAt, updatedAt: group.updatedAt })), total, query);
  }
  async saveOrganizationFaculty(universityId: string | undefined, dto: PlatformFacultyDto, id?: string) {
    const access = await this.require('universities.write');
    const name = dto.name.trim(), code = dto.code.trim(), reason = dto.reason.trim();
    if (!name || !code || reason.length < 3) throw new BadRequestException('Укажите название, код и причину изменения.');
    return this.db.transaction(async manager => {
      const faculty = id ? await manager.getRepository(Faculty).createQueryBuilder('f').where('f.id = :id', { id }).setLock('pessimistic_write').getOne() : null;
      if (id && !faculty) throw new NotFoundException('Факультет не найден.');
      const targetUniversityId = faculty?.universityId ?? universityId;
      if (!targetUniversityId || !await manager.getRepository(University).existsBy({ id: targetUniversityId })) throw new NotFoundException('Университет не найден.');
      this.assertUniversityScope(access, targetUniversityId);
      const duplicate = await manager.getRepository(Faculty).createQueryBuilder('f').where('f."universityId" = :universityId AND f.id IS DISTINCT FROM :id AND (LOWER(f.name) = LOWER(:name) OR LOWER(f.code) = LOWER(:code))', { universityId: targetUniversityId, id: id ?? null, name, code }).getExists();
      if (duplicate) throw new ConflictException('Факультет с таким названием или кодом уже есть в университете.');
      const saved = await manager.save(Faculty, manager.create(Faculty, { ...(faculty ? { ...faculty, id: faculty.id } : {}), universityId: targetUniversityId, name, code }));
      await manager.save(AuditLog, { userId: access.actorId, action: id ? 'platform.organization.faculty.updated' : 'platform.organization.faculty.created', entity: 'platform', entityId: saved.id, oldValues: faculty ? { universityId: faculty.universityId, name: faculty.name, code: faculty.code } : undefined, newValues: { universityId: saved.universityId, name: saved.name, code: saved.code, reason } });
      return { id: saved.id, universityId: saved.universityId, name: saved.name, code: saved.code };
    });
  }
  async saveOrganizationGroup(universityId: string | undefined, dto: PlatformGroupDto, id?: string) {
    const access = await this.require('universities.write');
    const name = dto.name.trim(), specialization = dto.specialization?.trim() || null, reason = dto.reason.trim();
    if (!name || reason.length < 3 || !Number.isInteger(dto.curriculumYear) || dto.curriculumYear < 1 || dto.curriculumYear > 12) throw new BadRequestException('Проверьте название, курс и причину изменения.');
    return this.db.transaction(async manager => {
      const group = id ? await manager.getRepository(Group).createQueryBuilder('g').where('g.id = :id', { id }).setLock('pessimistic_write').getOne() : null;
      if (id && !group) throw new NotFoundException('Группа не найдена.');
      const targetUniversityId = group?.universityId ?? universityId;
      if (!targetUniversityId || !await manager.getRepository(University).existsBy({ id: targetUniversityId })) throw new NotFoundException('Университет не найден.');
      this.assertUniversityScope(access, targetUniversityId);
      const faculty = await manager.getRepository(Faculty).findOneBy({ id: dto.facultyId, universityId: targetUniversityId });
      if (!faculty) throw new BadRequestException('Факультет должен принадлежать выбранному университету.');
      const saved = await manager.save(Group, manager.create(Group, { ...(group ? { ...group, id: group.id } : {}), universityId: targetUniversityId, facultyId: faculty.id, name, curriculumYear: dto.curriculumYear, specialization }));
      await manager.save(AuditLog, { userId: access.actorId, action: id ? 'platform.organization.group.updated' : 'platform.organization.group.created', entity: 'platform', entityId: saved.id, oldValues: group ? { universityId: group.universityId, facultyId: group.facultyId, name: group.name, curriculumYear: group.curriculumYear, specialization: group.specialization } : undefined, newValues: { universityId: saved.universityId, facultyId: saved.facultyId, name: saved.name, curriculumYear: saved.curriculumYear, specialization: saved.specialization, externalId: saved.externalId, reason } });
      return { id: saved.id, universityId: saved.universityId, facultyId: saved.facultyId, name: saved.name, curriculumYear: saved.curriculumYear, specialization: saved.specialization ?? '', externalId: saved.externalId };
    });
  }
  async saveUniversity(dto: PlatformUniversityDto, id?: string) {
    const access = await this.require('universities.write');
    if (!access.owner) throw new ForbiddenException('Создание и изменение университетов доступно только владельцу платформы.');
    if (!dto.name.trim() || !dto.city.trim()) throw new BadRequestException('Укажите название и город.');
    return this.db.transaction(async manager => {
      if (id && !await manager.existsBy(University, { id })) throw new NotFoundException('Университет не найден.');
      const saved = await manager.save(University, manager.create(University, { ...(id ? { id } : {}), ...dto, name: dto.name.trim(), city: dto.city.trim() }));
      await manager.save(AuditLog, { userId: access.actorId, action: id ? 'platform.university.updated' : 'platform.university.created', entity: 'platform', entityId: saved.id, newValues: { name: saved.name, city: saved.city, status: saved.status } });
      return { id: saved.id, name: saved.name, city: saved.city, status: saved.status };
    });
  }
  async auditLog(query: PlatformQueryDto) {
    const access = await this.require('audit.read');
    const qb = this.db.getRepository(AuditLog).createQueryBuilder('audit')
      .where(new Brackets(scope => {
        scope.where("(audit.entity = 'platform' AND audit.action NOT LIKE 'platform.account.%')");
        if (access.owner || access.permissions.includes('accounts.read')) {
          scope.orWhere("(audit.entity = 'platform' AND audit.action LIKE 'platform.account.%')");
        }
        if (access.owner || access.permissions.includes('identity-links.read')) {
          scope.orWhere("(audit.entity = 'platform' AND audit.action IN ('platform.account.identity_max_unlinked', 'platform.account.identity_telegram_revoked'))");
        }
        if (access.owner || access.permissions.includes('personal-data.read')) {
          scope.orWhere("audit.entity = 'personal_data' OR audit.entity IN ('personal_data_user_search', 'personal_data.notification_preferences', 'personal_data.favorite', 'personal_data.personal_lesson_note', 'personal_data.homework_progress')");
        }
        if (access.owner || access.permissions.includes('student-data.read')) {
          scope.orWhere("audit.entity IN ('absence', 'attendance_record', 'absence_search', 'attendance_search', 'absence_confirmation', 'absence_confirmation_search')");
        }
        if (access.owner || access.permissions.includes('career-data.read')) {
          scope.orWhere("audit.entity IN ('personal_data.career_profile', 'personal_data.career_admission', 'personal_data.career_application', 'personal_data.career_work', 'personal_data.career_task', 'personal_data.career_company', 'personal_data.career_partnership', 'personal_data.career_membership', 'personal_data.career_test', 'personal_data.career_test_attempt', 'personal_data.career_portfolio', 'personal_data.career_review', 'personal_data.career_notice', 'personal_data.career_availability')");
        }
        if (access.owner || access.permissions.includes('discussion-data.read')) {
          scope.orWhere("audit.entity = 'personal_data.discussion_message'");
        }
        if (access.owner || access.permissions.includes('homework-data.read')) {
          scope.orWhere("audit.entity = 'learning_data.homework_submission'");
        }
        if (access.owner || access.permissions.includes('notification-data.read')) {
          scope.orWhere("audit.entity LIKE 'notification_data.%'");
        }
        if (access.owner || access.permissions.includes('academic-data.read')) {
          scope.orWhere("audit.entity IN ('academic_occurrence', 'academic_occurrence_search', 'academic_lesson', 'academic_lesson_search', 'academic_event', 'academic_event_search', 'academic_course', 'academic_course_search', 'academic_series', 'academic_series_search')");
        }
        if (access.owner || access.permissions.includes('curation-data.read')) {
          scope.orWhere("audit.entity IN ('curator_assignment', 'curator_assignment_search') OR (audit.entity = 'group' AND audit.action IN ('curation.granted', 'curation.revoked'))");
        }
        if (access.owner || access.permissions.includes('attendance-qr.read')) {
          scope.orWhere("audit.entity = 'attendance_qr_session'");
        }
        if (access.owner || access.permissions.includes('pairspace-content.read')) {
          scope.orWhere("audit.entity IN ('pair_space_announcement', 'pair_space_announcement_search', 'pair_space', 'pair_space_search')");
        }
        if (access.owner || access.permissions.includes('events-data.read')) {
          scope.orWhere("audit.entity IN ('event_record', 'event_record_search')");
        }
        if (access.owner || access.permissions.includes('attachments-data.read')) {
          scope.orWhere("audit.entity IN ('file_attachment', 'file_attachment_search')");
        }
      }));
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(audit.action ILIKE :q ESCAPE E'\\\\' OR audit.entity ILIKE :q ESCAPE E'\\\\' OR audit.entityId ILIKE :q ESCAPE E'\\\\' OR audit.userId::text ILIKE :q ESCAPE E'\\\\' OR COALESCE(audit.newValues::text, '') ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
    if (query.universityId) qb.andWhere("(audit.newValues ->> 'universityId' = :universityId OR audit.oldValues ->> 'universityId' = :universityId OR (audit.newValues -> 'universityIds') ? :universityId)", { universityId: query.universityId });
    const total = await qb.clone().getCount();
    const data = await qb.orderBy('audit.createdAt', 'DESC').addOrderBy('audit.id', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getMany();
    return toPaginatedResponse(data, total, query);
  }
  async services() {
    const access = await this.require('services.read');
    const result = await this.agent.call<{ services: Array<{ id: string; state: string; health: string; image: string }>; host: unknown }>('/services');
    return { ...result, services: result.services.filter(s => access.serviceIds.includes(s.id)) };
  }
  async logs(service: string) {
    await this.require('logs.read', service);
    if (!(SERVICE_IDS as readonly string[]).includes(service)) throw new BadRequestException('Неизвестный сервис.');
    return this.agent.call(`/logs/${service}`);
  }
  async jobs() {
    const access = await this.require('services.read');
    const jobs = await this.agent.call<AgentJob[]>('/jobs');
    return jobs.filter(job => access.serviceIds.includes(job.service));
  }
  async job(id: string) {
    const access = await this.require('services.read');
    const job = await this.agent.call<AgentJob>(`/jobs/${id}`);
    if (!access.serviceIds.includes(job.service)) throw new ForbiddenException();
    return job;
  }
  async startJob(dto: PlatformJobDto) {
    const access = await this.require(dto.action === 'restart' ? 'services.restart' : 'services.rebuild', dto.service);
    if (dto.confirm !== dto.service) throw new BadRequestException('Введите имя выбранного сервиса для подтверждения.');
    if (dto.action === 'rebuild' && ['postgres', 'redis', 'nginx'].includes(dto.service)) throw new BadRequestException('Этот сервис использует готовый образ и не пересобирается.');
    await this.audit('service.requested', dto.idempotencyKey, { service: dto.service, action: dto.action });
    return this.agent.call<AgentJob>('/jobs', 'POST', { ...dto, actorId: access.actorId });
  }
}
