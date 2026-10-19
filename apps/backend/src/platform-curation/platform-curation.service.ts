import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { JsonObject } from '../common/types/json-value.type';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { PlatformService } from '../platform/platform.service';
import { Group } from '../users/entities/group.entity';
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
    if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
    const qb = this.db.getRepository(CuratorAssignment).createQueryBuilder('ca')
      .innerJoin(Group, 'g', 'g.id = ca."groupId" AND g."universityId" = ca."universityId"')
      .innerJoin(University, 'un', 'un.id = ca."universityId"')
      .leftJoin(User, 'u', 'u.id = ca."userId" AND u."universityId" = ca."universityId"')
      .where('1 = 1');
    if (query.universityId) qb.andWhere('ca."universityId" = :universityId', { universityId: query.universityId });
    else if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('ca."universityId" IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
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
    const rows = await qb.select('ca.id', 'id').addSelect('ca."universityId"', 'universityId').addSelect('un.name', 'universityName')
      .addSelect('ca."groupId"', 'groupId').addSelect('g.name', 'groupName').addSelect('g."externalId"', 'groupExternalId')
      .addSelect('ca."userId"', 'userId').addSelect("concat_ws(' ', u.\"firstName\", u.\"lastName\")", 'userName').addSelect('u.email', 'userEmail').addSelect('u.role', 'userRole')
      .addSelect('ca."grantedBy"', 'grantedBy').addSelect('ca."createdAt"', 'createdAt').addSelect('ca."revokedAt"', 'revokedAt').addSelect('ca."revokedBy"', 'revokedBy')
      .addSelect("CASE WHEN ca.\"revokedAt\" IS NULL THEN 'active' ELSE 'revoked' END", 'status')
      .orderBy('ca."createdAt"', 'DESC').addOrderBy('ca.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany();
    await this.audit(this.db.manager, access.actorId, 'platform.curation_data.search', 'curator_assignment_search', 'search', {
      universityId: query.universityId ?? null, targetUserId: query.userId ?? null, status, queryEntered: Boolean(query.q?.trim()),
      page: query.page, limit: query.limit, resultCount: rows.length, total, assignmentIds: rows.map(row => row.id),
    }, context);
    return toPaginatedResponse(rows, total, query);
  }

  async assignment(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.read');
    return this.db.transaction(async manager => {
      const assignment = await manager.findOne(CuratorAssignment, { where: { id } });
      if (!assignment) throw new NotFoundException('Назначение куратора не найдено.');
      this.platform.assertUniversityScope(access, assignment.universityId);
      const [group, university, user, grantedBy, revokedBy] = await Promise.all([
        manager.findOne(Group, { where: { id: assignment.groupId, universityId: assignment.universityId } }),
        manager.findOne(University, { where: { id: assignment.universityId } }),
        manager.findOne(User, { where: { id: assignment.userId, universityId: assignment.universityId } }),
        assignment.grantedBy ? manager.findOne(User, { where: access.owner || access.universityIds === null ? { id: assignment.grantedBy } : { id: assignment.grantedBy, universityId: assignment.universityId } }) : null,
        assignment.revokedBy ? manager.findOne(User, { where: access.owner || access.universityIds === null ? { id: assignment.revokedBy } : { id: assignment.revokedBy, universityId: assignment.universityId } }) : null,
      ]);
      if (!group || !university) throw new NotFoundException('Связанная группа или университет назначения не найдены.');
      await this.audit(manager, access.actorId, 'platform.curation_data.viewed', 'curator_assignment', id, {
        universityId: assignment.universityId, targetUserId: assignment.userId, groupId: group.id, result: 'viewed',
      }, context);
      return {
        assignment: { id: assignment.id, universityId: assignment.universityId, createdAt: assignment.createdAt, revokedAt: assignment.revokedAt, grantedBy: assignment.grantedBy, revokedBy: assignment.revokedBy, status: assignment.revokedAt ? 'revoked' : 'active' },
        university: { id: university.id, name: university.name, city: university.city },
        group: { id: group.id, name: group.name, externalId: group.externalId },
        user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive, universityId: user.universityId } : null,
        grantedByUser: userSummary(grantedBy), revokedByUser: userSummary(revokedBy),
      };
    });
  }

  async groups(query: PlatformCurationResourceQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.read');
    this.platform.assertUniversityScope(access, query.universityId);
    if (!await this.db.getRepository(University).existsBy({ id: query.universityId })) throw new NotFoundException('Университет не найден.');
    const qb = this.db.getRepository(Group).createQueryBuilder('g').select(['g.id', 'g.name', 'g.externalId', 'g.universityId'])
      .where('g.universityId = :universityId', { universityId: query.universityId });
    if (query.q?.trim()) qb.andWhere('(g.name ILIKE :q OR g."externalId" ILIKE :q)', { q: `%${query.q.trim()}%` });
    const [data, total] = await qb.orderBy('g.name', 'ASC').addOrderBy('g.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    await this.audit(this.db.manager, access.actorId, 'platform.curation_data.group_search', 'curator_assignment_search', 'groups', { universityId: query.universityId, queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: data.length, total, groupIds: data.map(group => group.id) }, context);
    return toPaginatedResponse(data.map(({ id, name, externalId, universityId }) => ({ id, name, externalId, universityId })), total, query);
  }

  async candidates(query: PlatformCurationResourceQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('curation-data.read');
    this.platform.assertUniversityScope(access, query.universityId);
    if (!await this.db.getRepository(University).existsBy({ id: query.universityId })) throw new NotFoundException('Университет не найден.');
    const qb = this.db.getRepository(User).createQueryBuilder('u').select(['u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.role'])
      .where('u."universityId" = :universityId AND u."isActive" = true AND u.role IN (:...roles)', { universityId: query.universityId, roles: CANDIDATE_ROLES });
    if (query.q?.trim()) qb.andWhere("(u.email ILIKE :q OR concat_ws(' ', u.\"firstName\", u.\"lastName\") ILIKE :q OR u.id::text ILIKE :q)", { q: `%${query.q.trim()}%` });
    const [data, total] = await qb.orderBy('u."lastName"', 'ASC').addOrderBy('u."firstName"', 'ASC').addOrderBy('u.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    await this.audit(this.db.manager, access.actorId, 'platform.curation_data.candidate_search', 'curator_assignment_search', 'candidates', { universityId: query.universityId, queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: data.length, total, userIds: data.map(user => user.id) }, context);
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
        this.platform.assertUniversityScope(access, group.universityId);
        const university = await manager.findOne(University, { where: { id: group.universityId } });
        if (!university) throw new NotFoundException('Университет группы не найден.');
        const user = await manager.findOne(User, { where: { id: dto.userId, universityId: group.universityId, isActive: true }, lock: { mode: 'pessimistic_read' } });
        if (!user || !CANDIDATE_ROLES.includes(user.role)) throw new BadRequestException('Выберите активный аккаунт допустимой роли из того же университета.');
        const current = await manager.findOne(CuratorAssignment, { where: { groupId: group.id, universityId: group.universityId, userId: user.id, revokedAt: IsNull() } });
        if (current) throw new ConflictException('Этот аккаунт уже назначен куратором группы.');
        const assignment = await manager.save(CuratorAssignment, manager.create(CuratorAssignment, { universityId: group.universityId, groupId: group.id, userId: user.id, grantedBy: access.actorId }));
        const first = await manager.findOne(CuratorAssignment, { where: { groupId: group.id, universityId: group.universityId, revokedAt: IsNull() }, order: { createdAt: 'ASC', id: 'ASC' } });
        await manager.update(Group, group.id, { curatorId: first?.userId ?? null });
        await this.audit(manager, access.actorId, 'platform.curation_data.granted', 'curator_assignment', assignment.id, {
          universityId: group.universityId, groupId: group.id, targetUserId: user.id, status: 'active', reason, result: 'granted',
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
      this.platform.assertUniversityScope(access, snapshot.universityId);
      const group = await manager.findOne(Group, { where: { id: snapshot.groupId, universityId: snapshot.universityId }, lock: { mode: 'pessimistic_write' } });
      if (!group) throw new NotFoundException('Группа назначения не найдена.');
      const assignment = await manager.findOne(CuratorAssignment, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!assignment) throw new NotFoundException('Назначение куратора не найдено.');
      if (assignment.revokedAt) throw new ConflictException('Назначение уже отозвано.');
      const revokedAt = new Date();
      await manager.update(CuratorAssignment, id, { revokedAt, revokedBy: access.actorId });
      const first = await manager.findOne(CuratorAssignment, { where: { groupId: group.id, universityId: group.universityId, revokedAt: IsNull() }, order: { createdAt: 'ASC', id: 'ASC' } });
      await manager.update(Group, group.id, { curatorId: first?.userId ?? null });
      await this.audit(manager, access.actorId, 'platform.curation_data.revoked', 'curator_assignment', id, {
        universityId: assignment.universityId, groupId: group.id, targetUserId: assignment.userId, status: 'revoked', revokedAt: revokedAt.toISOString(), reason, result: 'revoked',
      }, context, { universityId: assignment.universityId, groupId: group.id, targetUserId: assignment.userId, status: 'active' });
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
