import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { JsonObject } from '../common/types/json-value.type';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { PlatformService } from '../platform/platform.service';
import { Group } from '../users/entities/group.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformCurationAssignmentDto, PlatformCurationQueryDto, PlatformCurationResourceQueryDto, PlatformCurationRevokeDto } from './platform-curation.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };
const CANDIDATE_ROLES = [UserRole.STUDENT, UserRole.TEACHER, UserRole.CURATOR, UserRole.FACULTY_DEAN, UserRole.DEPARTMENT_HEAD, UserRole.UNIVERSITY_ADMIN];
const userSummary = (user?: User | null) => user ? ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }) : null;

@Injectable()
export class PlatformCurationService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async assignments(query: PlatformCurationQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.read');
    if (query.organizationId) this.platform.assertUniversityScope(access, query.organizationId);
    const qb = this.db.getRepository(CuratorAssignment).createQueryBuilder('ca')
      .innerJoin(Group, 'g', 'g.id = ca."groupId" AND g."organizationId" = ca."organizationId"')
      .innerJoin(University, 'un', 'un.id = ca."organizationId"')
      .leftJoin(User, 'u', 'u.id = ca."userId" AND u."organizationId" = ca."organizationId"')
      .where('1 = 1');
    if (query.organizationId) qb.andWhere('ca."organizationId" = :organizationId', { organizationId: query.organizationId });
    else if (!access.owner && access.organizationIds !== null) {
      if (!access.organizationIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('ca."organizationId" IN (:...allowedOrganizationIds)', { allowedOrganizationIds: access.organizationIds });
    }
    if (query.userId) qb.andWhere('ca."userId" = :userId', { userId: query.userId });
    const status = query.status ?? 'active';
    if (status === 'active') qb.andWhere('ca."revokedAt" IS NULL');
    else if (status === 'revoked') qb.andWhere('ca."revokedAt" IS NOT NULL');
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(ca.id::text ILIKE :q ESCAPE E'\\\\' OR ca.\"userId\"::text ILIKE :q ESCAPE E'\\\\' OR ca.\"groupId\"::text ILIKE :q ESCAPE E'\\\\' OR u.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', u.firstName, u.lastName) ILIKE :q ESCAPE E'\\\\' OR g.name ILIKE :q ESCAPE E'\\\\' OR g.\"externalId\" ILIKE :q ESCAPE E'\\\\' OR un.name ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
    const total = await qb.clone().getCount();
    const rows = await qb.select('ca.id', 'id').addSelect('ca."organizationId"', 'organizationId').addSelect('un.name', 'universityName')
      .addSelect('ca."groupId"', 'groupId').addSelect('g.name', 'groupName').addSelect('g."externalId"', 'groupExternalId')
      .addSelect('ca."userId"', 'userId').addSelect("concat_ws(' ', u.\"firstName\", u.\"lastName\")", 'userName').addSelect('u.email', 'userEmail').addSelect('u.role', 'userRole')
      .addSelect('ca."grantedBy"', 'grantedBy').addSelect('ca."createdAt"', 'createdAt').addSelect('ca."revokedAt"', 'revokedAt').addSelect('ca."revokedBy"', 'revokedBy')
      .addSelect("CASE WHEN ca.\"revokedAt\" IS NULL THEN 'active' ELSE 'revoked' END", 'status')
      .orderBy('ca."createdAt"', 'DESC').addOrderBy('ca.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany();
    await this.audit(this.db.manager, access.actorId, 'platform.curation_data.search', 'curator_assignment_search', 'search', {
      organizationId: query.organizationId ?? null, targetUserId: query.userId ?? null, status, queryEntered: Boolean(query.q?.trim()),
      page: query.page, limit: query.limit, resultCount: rows.length, total, assignmentIds: rows.map(row => row.id),
    }, context);
    return toPaginatedResponse(rows, total, query);
  }

  async assignment(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.read');
    return this.db.transaction(async manager => {
      const assignment = await manager.findOne(CuratorAssignment, { where: { id } });
      if (!assignment) throw new NotFoundException('Назначение куратора не найдено.');
      this.platform.assertUniversityScope(access, assignment.organizationId);
      const [group, university, user, grantedBy, revokedBy] = await Promise.all([
        manager.findOne(Group, { where: { id: assignment.groupId, organizationId: assignment.organizationId } }),
        manager.findOne(University, { where: { id: assignment.organizationId } }),
        manager.findOne(User, { where: { id: assignment.userId, organizationId: assignment.organizationId } }),
        assignment.grantedBy ? manager.findOne(User, { where: access.owner || access.organizationIds === null ? { id: assignment.grantedBy } : { id: assignment.grantedBy, organizationId: assignment.organizationId } }) : null,
        assignment.revokedBy ? manager.findOne(User, { where: access.owner || access.organizationIds === null ? { id: assignment.revokedBy } : { id: assignment.revokedBy, organizationId: assignment.organizationId } }) : null,
      ]);
      if (!group || !university) throw new NotFoundException('Связанная группа или университет назначения не найдены.');
      await this.audit(manager, access.actorId, 'platform.curation_data.viewed', 'curator_assignment', id, {
        organizationId: assignment.organizationId, targetUserId: assignment.userId, groupId: group.id, result: 'viewed',
      }, context);
      return {
        assignment: { id: assignment.id, organizationId: assignment.organizationId, createdAt: assignment.createdAt, revokedAt: assignment.revokedAt, grantedBy: assignment.grantedBy, revokedBy: assignment.revokedBy, status: assignment.revokedAt ? 'revoked' : 'active' },
        university: { id: university.id, name: university.name, city: university.city },
        group: { id: group.id, name: group.name, externalId: group.externalId },
        user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive, organizationId: user.organizationId } : null,
        grantedByUser: userSummary(grantedBy), revokedByUser: userSummary(revokedBy),
      };
    });
  }

  async groups(query: PlatformCurationResourceQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.read');
    this.platform.assertUniversityScope(access, query.organizationId);
    if (!await this.db.getRepository(University).existsBy({ id: query.organizationId })) throw new NotFoundException('Университет не найден.');
    const qb = this.db.getRepository(Group).createQueryBuilder('g').innerJoin(Faculty, 'f', 'f.id = g."facultyId" AND f."organizationId" = g."organizationId" AND f."archivedAt" IS NULL').select(['g.id', 'g.name', 'g.externalId', 'g.organizationId'])
      .where('g.organizationId = :organizationId AND g."archivedAt" IS NULL', { organizationId: query.organizationId });
    if (query.q?.trim()) qb.andWhere('(g.name ILIKE :q OR g."externalId" ILIKE :q)', { q: `%${query.q.trim()}%` });
    const [data, total] = await qb.orderBy('g.name', 'ASC').addOrderBy('g.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    await this.audit(this.db.manager, access.actorId, 'platform.curation_data.group_search', 'curator_assignment_search', 'groups', { organizationId: query.organizationId, queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: data.length, total, groupIds: data.map(group => group.id) }, context);
    return toPaginatedResponse(data.map(({ id, name, externalId, organizationId }) => ({ id, name, externalId, organizationId })), total, query);
  }

  async candidates(query: PlatformCurationResourceQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.read');
    this.platform.assertUniversityScope(access, query.organizationId);
    if (!await this.db.getRepository(University).existsBy({ id: query.organizationId })) throw new NotFoundException('Университет не найден.');
    const qb = this.db.getRepository(User).createQueryBuilder('u').select(['u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.role'])
      .where('u."organizationId" = :organizationId AND u."isActive" = true AND u.role IN (:...roles)', { organizationId: query.organizationId, roles: CANDIDATE_ROLES });
    if (query.q?.trim()) qb.andWhere("(u.email ILIKE :q OR concat_ws(' ', u.\"firstName\", u.\"lastName\") ILIKE :q OR u.id::text ILIKE :q)", { q: `%${query.q.trim()}%` });
    const [data, total] = await qb.orderBy('u."lastName"', 'ASC').addOrderBy('u."firstName"', 'ASC').addOrderBy('u.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    await this.audit(this.db.manager, access.actorId, 'platform.curation_data.candidate_search', 'curator_assignment_search', 'candidates', { organizationId: query.organizationId, queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: data.length, total, userIds: data.map(user => user.id) }, context);
    return toPaginatedResponse(data, total, query);
  }

  async grant(dto: PlatformCurationAssignmentDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.write');
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
    try {
      return await this.db.transaction(async manager => {
        const group = await manager.findOne(Group, { where: { id: dto.groupId }, lock: { mode: 'pessimistic_write' } });
        if (!group) throw new NotFoundException('Группа не найдена.');
        this.platform.assertUniversityScope(access, group.organizationId);
        if (group.archivedAt || !await manager.getRepository(Faculty).existsBy({ id: group.facultyId, organizationId: group.organizationId, archivedAt: IsNull() })) throw new BadRequestException('Нельзя назначить куратора в архивную группу или архивный факультет.');
        const university = await manager.findOne(University, { where: { id: group.organizationId } });
        if (!university) throw new NotFoundException('Университет группы не найден.');
        const user = await manager.findOne(User, { where: { id: dto.userId, organizationId: group.organizationId, isActive: true }, lock: { mode: 'pessimistic_read' } });
        if (!user || !CANDIDATE_ROLES.includes(user.role)) throw new BadRequestException('Выберите активный аккаунт допустимой роли из того же университета.');
        const current = await manager.findOne(CuratorAssignment, { where: { groupId: group.id, organizationId: group.organizationId, userId: user.id, revokedAt: IsNull() } });
        if (current) throw new ConflictException('Этот аккаунт уже назначен куратором группы.');
        const assignment = await manager.save(CuratorAssignment, manager.create(CuratorAssignment, { organizationId: group.organizationId, groupId: group.id, userId: user.id, grantedBy: access.actorId }));
        const first = await manager.findOne(CuratorAssignment, { where: { groupId: group.id, organizationId: group.organizationId, revokedAt: IsNull() }, order: { createdAt: 'ASC', id: 'ASC' } });
        await manager.update(Group, group.id, { curatorId: first?.userId ?? null });
        await this.audit(manager, access.actorId, 'platform.curation_data.granted', 'curator_assignment', assignment.id, {
          organizationId: group.organizationId, groupId: group.id, targetUserId: user.id, status: 'active', reason, result: 'granted',
        }, context);
        return { id: assignment.id, changed: true, status: 'active' };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Этот аккаунт уже назначен куратором группы.');
      throw error;
    }
  }

  async revoke(id: string, dto: PlatformCurationRevokeDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.write');
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
    return this.db.transaction(async manager => {
      const snapshot = await manager.findOne(CuratorAssignment, { where: { id } });
      if (!snapshot) throw new NotFoundException('Назначение куратора не найдено.');
      this.platform.assertUniversityScope(access, snapshot.organizationId);
      const group = await manager.findOne(Group, { where: { id: snapshot.groupId, organizationId: snapshot.organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!group) throw new NotFoundException('Группа назначения не найдена.');
      const assignment = await manager.findOne(CuratorAssignment, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!assignment) throw new NotFoundException('Назначение куратора не найдено.');
      if (assignment.revokedAt) throw new ConflictException('Назначение уже отозвано.');
      const revokedAt = new Date();
      await manager.update(CuratorAssignment, id, { revokedAt, revokedBy: access.actorId });
      const first = await manager.findOne(CuratorAssignment, { where: { groupId: group.id, organizationId: group.organizationId, revokedAt: IsNull() }, order: { createdAt: 'ASC', id: 'ASC' } });
      await manager.update(Group, group.id, { curatorId: first?.userId ?? null });
      await this.audit(manager, access.actorId, 'platform.curation_data.revoked', 'curator_assignment', id, {
        organizationId: assignment.organizationId, groupId: group.id, targetUserId: assignment.userId, status: 'revoked', revokedAt: revokedAt.toISOString(), reason, result: 'revoked',
      }, context, { organizationId: assignment.organizationId, groupId: group.id, targetUserId: assignment.userId, status: 'active' });
      return { id, changed: true, status: 'revoked', revokedAt };
    });
  }

  private async audit(manager: EntityManager, actorId: string, action: string, entity: string, entityId: string, newValues: JsonObject, context: RequestAuditContext = {}, oldValues?: JsonObject) {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId, action, entity, entityId,
      ...(oldValues ? { oldValues } : {}), newValues,
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }
}
