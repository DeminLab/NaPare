import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, IsNull, SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TenantContext } from '../common/tenant/tenant-context';
import { requireOrganizationId } from '../common/tenant/require-university';
import { PaginationQueryDto, toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Group } from '../users/entities/group.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Absence } from '../absences/entities/absence.entity';
import { AbsenceConfirmation } from '../absences/entities/absence-confirmation.entity';
import { CuratorAssignment } from './entities/curator-assignment.entity';
import { CurationQueryDto } from './curation-query.dto';

export const CURATION_MANAGERS = [UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN];
const CANDIDATE_ROLES = [UserRole.STUDENT, UserRole.TEACHER, UserRole.CURATOR, UserRole.FACULTY_DEAN, UserRole.DEPARTMENT_HEAD, UserRole.UNIVERSITY_ADMIN];
const REVIEW_MANAGERS = [...CURATION_MANAGERS, UserRole.DEPARTMENT_HEAD];

@Injectable()
export class CurationService {
  constructor(private readonly db: DataSource, private readonly tenant: TenantContext) {}

  private actor(): AuthenticatedUser {
    const actor = this.tenant.getUser();
    if (!actor) throw new ForbiddenException('Требуется вход в аккаунт.');
    requireOrganizationId(actor);
    return actor;
  }

  private managerActor() {
    const actor = this.actor();
    if (!CURATION_MANAGERS.includes(actor.role)) throw new ForbiddenException('Назначать кураторов может деканат или администратор.');
    return actor;
  }

  async context() {
    const actor = this.actor();
    const count = await this.db.getRepository(CuratorAssignment).count({ where: { organizationId: requireOrganizationId(actor), userId: actor.id, revokedAt: IsNull() } });
    return { canCurate: count > 0, canManage: CURATION_MANAGERS.includes(actor.role), groupCount: count };
  }

  async assignedGroupIds(): Promise<string[]> {
    const actor = this.actor();
    const rows = await this.db.getRepository(CuratorAssignment).createQueryBuilder('ca').innerJoin(Group, 'g', 'g.id = ca."groupId" AND g."organizationId" = ca."organizationId" AND g."archivedAt" IS NULL').where('ca."organizationId" = :organizationId AND ca."userId" = :userId AND ca."revokedAt" IS NULL', { organizationId: requireOrganizationId(actor), userId: actor.id }).select('ca."groupId"', 'groupId').getRawMany<{ groupId: string }>();
    return rows.map(row => row.groupId);
  }

  async assertStudent(studentId: string) {
    const actor = this.actor();
    const student = await this.db.getRepository(User).findOne({ where: { id: studentId, organizationId: requireOrganizationId(actor), role: UserRole.STUDENT } });
    if (!student?.groupId) throw new ForbiddenException('Учебная группа студента недоступна.');
    const group = await this.db.getRepository(Group).createQueryBuilder('g').where('g.organizationId = :organizationId AND (g.id::text = :groupId OR g.externalId = :groupId)', { organizationId: requireOrganizationId(actor), groupId: student.groupId }).getOne();
    if (!group) throw new ForbiddenException('Учебная группа студента недоступна.');
    return this.assertGroup(group.id);
  }

  async decisions(absences: Absence[]) {
    if (!absences.length) return [];
    const rows = await this.db.getRepository(AbsenceConfirmation).find({ where: { absenceId: In(absences.map(item => item.id)) }, order: { confirmedAt: 'DESC', id: 'DESC' } });
    return absences.map(item => {
      const decision = rows.find(row => row.absenceId === item.id);
      return { ...item, status: item.confirmationRequired ? 'pending' : decision?.status ?? 'confirmed', decision: decision ? { status: decision.status, comment: decision.comment, confirmedAt: decision.confirmedAt, curatorId: decision.curatorId } : null };
    });
  }

  private assignedGroups(qb: SelectQueryBuilder<Group>, actor: AuthenticatedUser) {
    return qb.andWhere(`EXISTS (SELECT 1 FROM curator_assignments ca WHERE ca."groupId" = g.id AND ca."organizationId" = g."organizationId" AND ca."userId" = :actorId AND ca."revokedAt" IS NULL)`, { actorId: actor.id });
  }

  async groups(query: CurationQueryDto, manage = false) {
    const actor = manage ? this.managerActor() : this.actor();
    const qb = this.db.getRepository(Group).createQueryBuilder('g').innerJoin(Faculty, 'f', 'f.id = g."facultyId" AND f."organizationId" = g."organizationId" AND f."archivedAt" IS NULL').where('g.organizationId = :organizationId AND g."archivedAt" IS NULL', { organizationId: requireOrganizationId(actor) });
    if (!manage) this.assignedGroups(qb, actor);
    if (query.q) qb.andWhere('g.name ILIKE :q', { q: `%${query.q}%` });
    const [data, total] = await qb.orderBy('g.name', 'ASC').addOrderBy('g.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    // The legacy singular pointer is not the current assignment contract.
    return toPaginatedResponse(data.map(({ id, name, facultyId, curriculumYear }) => ({ id, name, facultyId, curriculumYear })), total, query);
  }

  async assertGroup(groupId: string, manager = this.db.manager, manage = false): Promise<Group> {
    const actor = manage ? this.managerActor() : this.actor();
    const group = await manager.findOne(Group, { where: { id: groupId, organizationId: requireOrganizationId(actor) } });
    if (!group) throw new NotFoundException('Группа не найдена.');
    if (!manage) {
      const assignment = await manager.findOne(CuratorAssignment, { where: { groupId, organizationId: group.organizationId, userId: actor.id, revokedAt: IsNull() } });
      if (!assignment) throw new ForbiddenException('Кураторство этой группы не назначено или уже снято.');
    }
    return group;
  }

  async candidates(query: CurationQueryDto) {
    const actor = this.managerActor();
    const qb = this.db.getRepository(User).createQueryBuilder('u').select(['u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.role'])
      .where('u.organizationId = :organizationId AND u.isActive = true AND u.role IN (:...roles)', { organizationId: requireOrganizationId(actor), roles: CANDIDATE_ROLES });
    if (query.q) qb.andWhere("concat_ws(' ', u.lastName, u.firstName, u.email) ILIKE :q", { q: `%${query.q}%` });
    const [data, total] = await qb.orderBy('u.lastName', 'ASC').addOrderBy('u.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(data, total, query);
  }

  async curators(groupId: string, query: PaginationQueryDto) {
    await this.assertGroup(groupId, this.db.manager, true);
    const [data, total] = await this.db.getRepository(CuratorAssignment).createQueryBuilder('ca')
      .innerJoin(User, 'u', 'u.id = ca.userId AND u.organizationId = ca.organizationId')
      .where('ca.groupId = :groupId AND ca.revokedAt IS NULL', { groupId })
      .select('ca.id', 'id').addSelect('ca.userId', 'userId').addSelect('ca.createdAt', 'createdAt')
      .addSelect('u.firstName', 'firstName').addSelect('u.lastName', 'lastName').addSelect('u.email', 'email').addSelect('u.role', 'role')
      .orderBy('ca.createdAt', 'ASC').addOrderBy('ca.id', 'ASC')
      .offset((query.page - 1) * query.limit).limit(query.limit).getRawMany().then(async data => [data, await this.db.getRepository(CuratorAssignment).count({ where: { groupId, revokedAt: IsNull() } })] as const);
    return toPaginatedResponse(data, total, query);
  }

  async setAssignment(groupId: string, userId: string, grant: boolean) {
    const actor = this.managerActor();
    return this.db.transaction(async manager => {
      // Serialize grant/revoke and curator decisions for this group.
      const group = await manager.findOne(Group, { where: { id: groupId, organizationId: requireOrganizationId(actor) }, lock: { mode: 'pessimistic_write' } });
      if (!group) throw new NotFoundException('Группа не найдена.');
      if (grant && (group.archivedAt || !await manager.getRepository(Faculty).existsBy({ id: group.facultyId, organizationId: group.organizationId, archivedAt: IsNull() }))) throw new BadRequestException('Нельзя назначить куратора в архивную группу или архивный факультет.');
      const current = await manager.findOne(CuratorAssignment, { where: { groupId, userId, revokedAt: IsNull() } });
      if (grant && current) return { changed: false };
      if (!grant && !current) return { changed: false };
      if (grant) {
        const user = await manager.findOne(User, { where: { id: userId, organizationId: group.organizationId, isActive: true } });
        if (!user || !CANDIDATE_ROLES.includes(user.role)) throw new BadRequestException('Выберите действующий аккаунт студента или сотрудника своего университета.');
        await manager.save(CuratorAssignment, manager.create(CuratorAssignment, { organizationId: group.organizationId, groupId, userId, grantedBy: actor.id }));
      } else {
        await manager.update(CuratorAssignment, current!.id, { revokedAt: new Date(), revokedBy: actor.id });
      }
      await manager.save(AuditLog, manager.create(AuditLog, { userId: actor.id, action: grant ? 'curation.granted' : 'curation.revoked', entity: 'group', entityId: groupId, newValues: { organizationId: group.organizationId, userId } }));
      // Keep old clients' read-only pointer useful without using it for authorization.
      const first = await manager.findOne(CuratorAssignment, { where: { groupId, revokedAt: IsNull() }, order: { createdAt: 'ASC', id: 'ASC' } });
      await manager.update(Group, groupId, { curatorId: first?.userId ?? null });
      return { changed: true };
    });
  }

  async students(groupId: string, query: PaginationQueryDto) {
    const group = await this.assertGroup(groupId);
    const [data, total] = await this.db.getRepository(User).findAndCount({ where: { organizationId: group.organizationId, role: UserRole.STUDENT, groupId: In([group.id, ...(group.externalId ? [group.externalId] : [])]) }, select: ['id', 'firstName', 'lastName', 'groupId'], order: { lastName: 'ASC', id: 'ASC' }, skip: (query.page - 1) * query.limit, take: query.limit });
    return toPaginatedResponse(data, total, query);
  }

  async lessons(groupId: string, query: CurationQueryDto) {
    const group = await this.assertGroup(groupId);
    const start = query.startDate ? new Date(query.startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = query.endDate ? new Date(query.endDate) : new Date(start.getTime() + 7 * 86400000);
    if (end <= start || end.getTime() - start.getTime() > 32 * 86400000) throw new BadRequestException('Период расписания должен быть от 1 до 32 дней.');
    const [data, total] = await this.db.getRepository(Lesson).createQueryBuilder('l').where('l.organizationId = :organizationId AND l.groupId = :groupId AND l.startDate >= :start AND l.startDate < :end', { organizationId: group.organizationId, groupId, start, end })
      .orderBy('l.startDate', 'ASC').addOrderBy('l.pairNumber', 'ASC').addOrderBy('l.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(data.map(({ id, subject, startDate, startTime, endTime, room, teacherName }) => ({ id, subject, startDate, startTime, endTime, room, teacherName })), total, query);
  }

  async absences(query: CurationQueryDto, assignedOnly = true) {
    const actor = this.actor();
    if (query.groupId) await this.assertGroup(query.groupId);
    const qb = this.db.getRepository(Absence).createQueryBuilder('a')
      .innerJoin(User, 's', 's.id = a.studentId AND s.organizationId = a.organizationId')
      .where('a.organizationId = :organizationId', { organizationId: requireOrganizationId(actor) });
    if (assignedOnly || !REVIEW_MANAGERS.includes(actor.role)) {
      qb.andWhere(`EXISTS (SELECT 1 FROM groups g JOIN curator_assignments ca ON ca."groupId" = g.id AND ca."organizationId" = g."organizationId" WHERE g."organizationId" = a."organizationId" AND g."archivedAt" IS NULL AND (s."groupId" = g.id::text OR s."groupId" = g."externalId") AND ca."userId" = :actorId AND ca."revokedAt" IS NULL ${query.groupId ? 'AND g.id = :groupId' : ''})`, { actorId: actor.id, groupId: query.groupId });
    }
    if (query.status === 'pending') qb.andWhere('a.confirmationRequired = true');
    if (query.startDate) qb.andWhere('a.startDate >= :startDate', { startDate: new Date(query.startDate) });
    if (query.endDate) qb.andWhere('a.startDate <= :endDate', { endDate: new Date(query.endDate) });
    if (query.absenceId) qb.andWhere('a.id = :absenceId', { absenceId: query.absenceId });
    const [data, total] = await qb.orderBy('a.createdAt', 'DESC').addOrderBy('a.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    const students = data.length ? await this.db.getRepository(User).find({ where: { id: In(data.map(item => item.studentId)), organizationId: requireOrganizationId(actor) }, select: ['id', 'firstName', 'lastName', 'groupId'] }) : [];
    return toPaginatedResponse(data.map(item => ({ ...item, student: students.find(s => s.id === item.studentId) ?? null, canReview: item.studentId !== actor.id })), total, query);
  }

  async absenceContext(id: string) {
    const actor = this.actor();
    const absence = await this.db.getRepository(Absence).findOne({ where: { id, organizationId: requireOrganizationId(actor) } });
    if (!absence) throw new NotFoundException('Обращение не найдено.');
    const group = await this.assertStudent(absence.studentId);
    return { id: group.id, name: group.name };
  }

  async review(id: string, status: 'confirmed' | 'rejected', comment?: string, allowTeacher = false) {
    const actor = this.actor();
    if (status === 'rejected' && !comment?.trim()) throw new BadRequestException('Укажите причину отклонения.');
    return this.db.transaction(async manager => {
      const source = await manager.findOne(Absence, { where: { id, organizationId: requireOrganizationId(actor) } });
      if (!source) throw new NotFoundException('Обращение не найдено.');
      if (source.studentId === actor.id) throw new ForbiddenException('Нельзя рассматривать собственное обращение.');
      const student = await manager.findOne(User, { where: { id: source.studentId, organizationId: source.organizationId }, lock: { mode: 'pessimistic_read' } });
      const group = student?.groupId ? await manager.getRepository(Group).createQueryBuilder('g').where('g.organizationId = :organizationId AND (g.id::text = :groupId OR g.externalId = :groupId)', { organizationId: source.organizationId, groupId: student.groupId }).setLock('pessimistic_write').getOne() : null;
      if (!REVIEW_MANAGERS.includes(actor.role)) {
        const assignment = group && !group.archivedAt && await manager.findOne(CuratorAssignment, { where: { groupId: group.id, organizationId: source.organizationId, userId: actor.id, revokedAt: IsNull() } });
        const ownLesson = !assignment && allowTeacher && actor.role === UserRole.TEACHER && source.affectedLessonIds?.length && await manager.findOne(Lesson, { where: { id: In(source.affectedLessonIds), organizationId: source.organizationId, teacherId: actor.id } });
        if (!assignment && !ownLesson) throw new ForbiddenException('Нет прав на рассмотрение обращения этой группы.');
      }
      const absence = await manager.findOne(Absence, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!absence || !absence.confirmationRequired) throw new ConflictException('Обращение уже рассмотрено. Обновите список.');
      await manager.save(AbsenceConfirmation, manager.create(AbsenceConfirmation, { absenceId: id, curatorId: actor.id, status, comment, confirmedAt: new Date() }));
      // Preserve the student's original reason; the decision comment has its own history.
      absence.confirmationRequired = false;
      const saved = await manager.save(Absence, absence);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: actor.id, action: `absence.${status}`, entity: 'absence', entityId: id, newValues: { organizationId: source.organizationId, groupId: group?.id ?? null } }));
      return saved;
    });
  }

  async assignedReviewers(organizationId: string, studentId: string) {
    const student = await this.db.getRepository(User).findOne({ where: { id: studentId, organizationId } });
    if (!student?.groupId) return [];
    return this.db.getRepository(User).createQueryBuilder('u').where('u.organizationId = :organizationId AND u.isActive = true AND u.id <> :studentId', { organizationId, studentId })
      .andWhere(`EXISTS (SELECT 1 FROM curator_assignments ca JOIN groups g ON g.id = ca."groupId" AND g."organizationId" = ca."organizationId" WHERE ca."userId" = u.id AND ca."organizationId" = :organizationId AND ca."revokedAt" IS NULL AND (g.id::text = :groupId OR g."externalId" = :groupId))`, { groupId: student.groupId }).getMany();
  }
}
