import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { RaspScraperService, SIBIT_UNIVERSITY } from '../auth/rasp-scraper.service';
import { PlatformControl, PlatformGrant } from './platform.entity';
import { PLATFORM_PERMISSIONS, PlatformAccountDto, PlatformCreateAccountDto, PlatformGrantDto, PlatformJobDto, PlatformPermission, PlatformQueryDto, PlatformSettingsDto, PlatformUniversityDto, SERVICE_IDS } from './platform.dto';
import { ControlAgentClient } from './control-agent.client';

type AgentJob = { id: string; service: string; action: string; status: string; actorId: string; createdAt: string; log?: string };
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
    return { owner, ownerConfigured: !!control, permissions: owner ? [...PLATFORM_PERMISSIONS] : grant?.permissions ?? [], serviceIds: owner ? [...SERVICE_IDS] : grant?.serviceIds ?? [], agentConfigured: this.agent.configured(), actorId: actor.id };
  }
  async require(permission: PlatformPermission, service?: string) {
    const access = await this.access();
    if (!access.permissions.includes(permission) || (service && !access.serviceIds.includes(service))) throw new ForbiddenException('Это действие не разрешено владельцем платформы.');
    return access;
  }
  async requireOwner() {
    const access = await this.access();
    if (!access.owner) throw new ForbiddenException('Управление разрешениями доступно только владельцу.');
    return access;
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
  async accounts(query: PlatformQueryDto) {
    await this.require('accounts.read');
    const qb = this.db.getRepository(User).createQueryBuilder('u');
    if (query.q) qb.andWhere("concat_ws(' ', u.email, u.firstName, u.lastName) ILIKE :q", { q: `%${query.q}%` });
    if (query.universityId) qb.andWhere('u.universityId = :universityId', { universityId: query.universityId });
    const [data, total] = await qb.orderBy('u.createdAt', 'DESC').addOrderBy('u.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    const control = await this.db.getRepository(PlatformControl).findOneBy({ id: 'platform' });
    return toPaginatedResponse(data.map(user => ({ ...safeAccount(user), isOwner: user.id === control?.ownerId })), total, query);
  }
  private async manageable(id: string, manager: EntityManager = this.db.manager) {
    const access = await this.require('accounts.write');
    await this.protectOwner(id);
    if (id === access.actorId) throw new ForbiddenException('Изменение собственного доступа через эту форму запрещено.');
    const target = await manager.findOne(User, { where: { id }, ...(manager.queryRunner?.isTransactionActive ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!target) throw new NotFoundException('Аккаунт не найден.');
    return { access, target };
  }
  async updateAccount(id: string, dto: PlatformAccountDto) {
    return this.db.transaction(async manager => {
      const { access, target } = await this.manageable(id, manager);
      if (dto.role === UserRole.CURATOR && target.role !== UserRole.CURATOR) throw new BadRequestException('Кураторство назначается дополнительно в разделе кураторства.');
      if (!access.owner && dto.role && dto.role !== target.role && ([UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(dto.role) || [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(target.role))) throw new ForbiddenException('Назначение и смена платформенной роли доступны только владельцу.');
      if ((dto.firstName !== undefined && !dto.firstName.trim()) || (dto.lastName !== undefined && !dto.lastName.trim())) throw new BadRequestException('Имя и фамилия не могут быть пустыми.');
      if (dto.role && ![UserRole.DEVELOPER, UserRole.SUPERADMIN, UserRole.EMPLOYER, UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN].includes(dto.role) && !target.universityId) throw new BadRequestException('Сначала требуется привязка аккаунта к университету.');
      const current = await manager.findOneByOrFail(User, { id });
      // Atomic version bump: concurrent role/status updates cannot revive older tokens.
      await manager.update(User, id, { ...dto, sessionVersion: () => '"sessionVersion" + 1' });
      if (dto.role && dto.role !== current.role) await manager.delete(PlatformGrant, { userId: id });
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.updated', entity: 'platform', entityId: id, newValues: { role: dto.role ?? target.role, isActive: dto.isActive ?? target.isActive } });
      return safeAccount(await manager.findOneByOrFail(User, { id }));
    });
  }
  async createAccount(dto: PlatformCreateAccountDto) {
    const access = await this.require('accounts.write');
    if (Buffer.byteLength(dto.password) > 72) throw new BadRequestException('Пароль должен занимать не более 72 байт UTF-8.');
    if (!dto.firstName?.trim() || !dto.lastName?.trim() || !dto.role) throw new BadRequestException('Укажите имя, фамилию и основную роль.');
    if (dto.role === UserRole.CURATOR) throw new BadRequestException('Кураторство назначается существующему аккаунту.');
    if (!access.owner && [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(dto.role)) throw new ForbiddenException('Платформенные роли назначает только владелец.');
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
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.created', entity: 'platform', entityId: user.id, newValues: { role: user.role } });
      return safeAccount(user);
    });
  }
  async resetPassword(id: string, password: string) {
    await this.require('accounts.write');
    if (Buffer.byteLength(password) > 72) throw new BadRequestException('Пароль должен занимать не более 72 байт UTF-8.');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.transaction(async manager => {
      const { access } = await this.manageable(id, manager);
      await manager.update(User, id, { passwordHash, sessionVersion: () => '"sessionVersion" + 1' });
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.password_reset', entity: 'platform', entityId: id });
    });
    return { changed: true };
  }
  async revokeSessions(id: string) {
    await this.db.transaction(async manager => {
      const { access } = await this.manageable(id, manager);
      await manager.increment(User, { id }, 'sessionVersion', 1);
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.account.sessions_revoked', entity: 'platform', entityId: id });
    });
    return { changed: true };
  }
  async grants(query: PlatformQueryDto) {
    await this.requireOwner();
    const qb = this.db.getRepository(User).createQueryBuilder('u').where('u.role IN (:...roles)', { roles: [UserRole.DEVELOPER, UserRole.SUPERADMIN] });
    if (query.q) qb.andWhere("concat_ws(' ', u.email, u.firstName, u.lastName) ILIKE :q", { q: `%${query.q}%` });
    const [data, total] = await qb.orderBy('u.email', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    const grants = await this.db.getRepository(PlatformGrant).find();
    return toPaginatedResponse(data.map(user => ({ ...safeAccount(user), grant: grants.find(g => g.userId === user.id) ?? null })), total, query);
  }
  async setGrant(id: string, dto: PlatformGrantDto) {
    const access = await this.requireOwner();
    await this.protectOwner(id);
    const user = await this.db.getRepository(User).findOneBy({ id });
    if (!user?.isActive || ![UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(user.role)) throw new BadRequestException('Выберите действующий аккаунт разработчика.');
    const permissions = new Set(dto.permissions);
    if (dto.permissions.some(p => p.startsWith('services.') || p === 'logs.read')) {
      if (!dto.serviceIds.length) throw new BadRequestException('Выберите сервисы для выданных разрешений.');
      permissions.add('services.read');
    }
    for (const [write, read] of [['accounts.write','accounts.read'], ['universities.write','universities.read'], ['settings.write','settings.read']] as const) if (permissions.has(write)) permissions.add(read);
    if (permissions.has('accounts.write')) permissions.add('universities.read');
    await this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(707247126)');
      await manager.upsert(PlatformGrant, { userId: id, permissions: [...permissions], serviceIds: dto.serviceIds, grantedBy: access.actorId }, ['userId']);
      await manager.save(AuditLog, { userId: access.actorId, action: 'platform.permissions.updated', entity: 'platform', entityId: id, newValues: { permissions: [...permissions], serviceIds: dto.serviceIds } });
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
    await this.require('universities.read');
    const qb = this.db.getRepository(University).createQueryBuilder('u').select(['u.id', 'u.name', 'u.city', 'u.status', 'u.connectorType']);
    if (query.q) qb.where('u.name ILIKE :q', { q: `%${query.q}%` });
    const [data, total] = await qb.orderBy('u.name', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(data, total, query);
  }
  async saveUniversity(dto: PlatformUniversityDto, id?: string) {
    const access = await this.require('universities.write');
    if (!dto.name.trim() || !dto.city.trim()) throw new BadRequestException('Укажите название и город.');
    return this.db.transaction(async manager => {
      if (id && !await manager.existsBy(University, { id })) throw new NotFoundException('Университет не найден.');
      const saved = await manager.save(University, manager.create(University, { ...(id ? { id } : {}), ...dto, name: dto.name.trim(), city: dto.city.trim() }));
      await manager.save(AuditLog, { userId: access.actorId, action: id ? 'platform.university.updated' : 'platform.university.created', entity: 'platform', entityId: saved.id, newValues: { name: saved.name, city: saved.city, status: saved.status } });
      return { id: saved.id, name: saved.name, city: saved.city, status: saved.status };
    });
  }
  async auditLog(query: PlatformQueryDto) {
    await this.require('audit.read');
    const [data, total] = await this.db.getRepository(AuditLog).findAndCount({ where: { entity: 'platform' }, order: { createdAt: 'DESC', id: 'DESC' }, skip: (query.page - 1) * query.limit, take: query.limit });
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
