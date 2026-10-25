import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, DataSource, EntityManager, In, IsNull } from 'typeorm';
import { createHash } from 'node:crypto';
import { UserRole } from '../auth/interfaces/user-role';
import { Group } from '../users/entities/group.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { User } from '../users/entities/user.entity';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { OfficeAccessService, OFFICE_STAFF_ROLES, routeDuties } from './office-access.service';
import { CreateRequestDto, DispatcherQueryDto, OfficeAssignmentDto, OfficeRouteDto, RequestCommandDto, RequestQueryDto } from './request.dto';
import { OfficeAssignment, OfficeRoute, RequestDecision, RequestDocument, RequestStep, StepDuty, StudentRequest } from './request.entities';
import { OfficeReportService } from './office-report.service';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const ack = (row: StudentRequest) => ({ id: row.id, status: row.status, version: row.version });

@Injectable()
export class RequestService {
  constructor(private readonly db: DataSource, private readonly access: OfficeAccessService, private readonly reports: OfficeReportService) {}
  private async lock(manager: EntityManager) {
    // Grant revocation, route changes and decisions have a single ordering per university.
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`office:${this.access.actor().universityId}`]);
  }
  private async audit(manager: EntityManager, action: string, id: string, values: JsonObject) {
    await manager.save(AuditLog, manager.create(AuditLog, { userId: this.access.actor().id, action, entity: 'academic-office', entityId: id, newValues: { universityId: this.access.actor().universityId, ...values } }));
  }
  async context() {
    const actor = this.access.actor(), manager = this.db.manager;
    const scope = await this.access.scope(manager), assignments = scope.assignments;
    const allowedIds = new Set([...scope.office, ...scope.methodologist, ...scope.curator_or_dean, ...scope.dispatcher]);
    const allowed = scope.groups.filter(group => actor.role === UserRole.UNIVERSITY_ADMIN || allowedIds.has(group.id));
    const faculties = allowed.length ? await manager.findBy(Faculty, { id: In([...new Set(allowed.map(group => group.facultyId))]), universityId: actor.universityId }) : [];
    const grants = allowed.length ? await manager.findBy(OfficeAssignment, { universityId: actor.universityId, revokedAt: IsNull() }) : [];
    const curators = allowed.length ? await manager.findBy(CuratorAssignment, { universityId: actor.universityId, groupId: In(allowed.map(group => group.id)), revokedAt: IsNull() }) : [];
    const peopleIds = [...new Set([...grants.filter(row => allowed.some(group => this.access.covers(row, group))).map(row => row.userId), ...curators.map(row => row.userId), ...faculties.flatMap(row => row.deanUserId ? [row.deanUserId] : [])])];
    const assignees = peopleIds.length ? await manager.find(User, { where: { id: In(peopleIds), universityId: actor.universityId, isActive: true }, select: ['id', 'firstName', 'lastName'] }) : [];
    return { canManage: actor.role === UserRole.UNIVERSITY_ADMIN, canCreateForStudents: assignments.some(row => row.duty === 'office' && row.canCreateForStudents), groups: allowed.map(({ id, name, facultyId }) => ({ id, name, facultyId })), faculties: faculties.map(({ id, name }) => ({ id, name })), assignees, assignments, debtSource: await this.reports.sourceStatus(allowed) };
  }
  async candidates(query: RequestQueryDto) {
    const actor = this.access.actor();
    const group = query.groupId ? await this.access.group(this.db.manager, query.groupId) : null;
    if (actor.role !== UserRole.UNIVERSITY_ADMIN) {
      if (!group) throw new ForbiddenException('Выберите подразделение учебного офиса.');
      if (!await this.access.hasDuty(this.db.manager, group, 'office')) throw new ForbiddenException('Нет назначения учебного офиса этой группы.');
    }
    const qb = this.db.getRepository(User).createQueryBuilder('u').select(['u.id', 'u.firstName', 'u.lastName', 'u.role'])
      .where('u.universityId = :uni AND u.isActive = true AND u.role IN (:...roles)', { uni: actor.universityId, roles: group ? [...OFFICE_STAFF_ROLES, UserRole.STUDENT] : OFFICE_STAFF_ROLES });
    if (query.q) qb.andWhere("concat_ws(' ', u.firstName, u.lastName) ILIKE :q", { q: `%${query.q}%` });
    if (group) {
      const [grants, curators, faculty] = await Promise.all([
        this.db.manager.findBy(OfficeAssignment, { universityId: actor.universityId, revokedAt: IsNull() }),
        this.db.manager.findBy(CuratorAssignment, { universityId: actor.universityId, groupId: group.id, revokedAt: IsNull() }),
        this.db.manager.findOneBy(Faculty, { universityId: actor.universityId, id: group.facultyId }),
      ]);
      const staffIds = grants.filter(row => ['office', 'methodologist'].includes(row.duty) && this.access.covers(row, group)).map(row => row.userId);
      const curatorIds = curators.map(row => row.userId);
      qb.andWhere(new Brackets(eligible => {
        eligible.where('false');
        if (staffIds.length) eligible.orWhere('(u.id IN (:...staffIds) AND u.role IN (:...staffRoles))', { staffIds, staffRoles: OFFICE_STAFF_ROLES });
        if (curatorIds.length) eligible.orWhere('u.id IN (:...curatorIds)', { curatorIds });
        if (faculty?.deanUserId) eligible.orWhere('(u.id = :deanId AND u.role = :deanRole)', { deanId: faculty.deanUserId, deanRole: UserRole.FACULTY_DEAN });
      }));
    }
    const [rows, total] = await qb.orderBy('u.lastName', 'ASC').addOrderBy('u.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(rows, total, query);
  }
  async students(query: RequestQueryDto) {
    if (!query.groupId) throw new BadRequestException('Выберите группу.');
    const group = await this.access.group(this.db.manager, query.groupId);
    if (!await this.access.hasDuty(this.db.manager, group, 'office', undefined, true)) throw new ForbiddenException('Не разрешена подача от имени студента этой группы.');
    const qb = this.db.getRepository(User).createQueryBuilder('u').select(['u.id', 'u.firstName', 'u.lastName'])
      .where('u.universityId = :uni AND u.role = :role AND u.isActive = true AND u.groupId IN (:...ids)', { uni: group.universityId, role: UserRole.STUDENT, ids: [group.id, ...(group.externalId ? [group.externalId] : [])] });
    if (query.q) qb.andWhere("concat_ws(' ', u.firstName, u.lastName) ILIKE :q", { q: `%${query.q}%` });
    const [rows, total] = await qb.orderBy('u.lastName', 'ASC').addOrderBy('u.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(rows, total, query);
  }
  async debts(studentId: string) {
    return this.reports.studentDebts(studentId);
  }
  async dispatchLessons(query: DispatcherQueryDto) {
    const group = await this.access.group(this.db.manager, query.groupId);
    if (!await this.access.hasDuty(this.db.manager, group, 'dispatcher')) throw new ForbiddenException('Нет действующего диспетчерского назначения этой группы.');
    const start = new Date(query.startDate), end = new Date(query.endDate);
    if (end < start || end.getTime() - start.getTime() > 31 * 86400000) throw new BadRequestException('Период должен быть от 1 до 32 дней.');
    end.setUTCDate(end.getUTCDate() + 1);
    const [rows, total] = await this.db.getRepository(Lesson).createQueryBuilder('lesson').where('lesson.universityId = :uni AND lesson.groupId = :groupId AND lesson.startDate >= :start AND lesson.startDate < :end', { uni: group.universityId, groupId: group.id, start, end })
      .orderBy('lesson.startDate', 'ASC').addOrderBy('lesson.pairNumber', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(rows.map(({ id, subject, teacherName, startDate, endDate, startTime, endTime, room, building, changeDescription }) => ({ id, subject, teacherName, startDate, endDate, startTime, endTime, room, building, changeDescription })), total, query);
  }
  async assignments() {
    const actor = this.access.admin(), rows = await this.db.manager.find(OfficeAssignment, { where: { universityId: actor.universityId }, order: { createdAt: 'DESC' } });
    const people = rows.length ? await this.db.manager.find(User, { where: { universityId: actor.universityId, id: In([...new Set(rows.map(row => row.userId))]) }, select: ['id', 'firstName', 'lastName'] }) : [];
    return rows.map(row => { const user = people.find(person => person.id === row.userId); return { ...row, userName: user ? `${user.lastName} ${user.firstName}` : 'Недоступный аккаунт' }; });
  }
  async assign(dto: OfficeAssignmentDto) {
    const actor = this.access.admin();
    return this.db.transaction(async manager => {
      await this.lock(manager); await this.access.staff(manager, dto.userId);
      for (const id of dto.groupIds) await this.access.group(manager, id);
      for (const id of dto.facultyIds) if (!await manager.findOneBy(Faculty, { id, universityId: actor.universityId })) throw new BadRequestException('Факультет другого вуза или недоступен.');
      if (dto.canCreateForStudents && dto.duty !== 'office') throw new BadRequestException('Подача от имени студента доступна только учебному офису.');
      const sameScope = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
      const active = await manager.findBy(OfficeAssignment, { universityId: actor.universityId, userId: dto.userId, duty: dto.duty, revokedAt: IsNull() });
      const previous = active.find(row => sameScope(row.groupIds, dto.groupIds) && sameScope(row.facultyIds, dto.facultyIds) && row.canCreateForStudents === !!dto.canCreateForStudents);
      if (previous) return previous;
      const assignment = await manager.save(OfficeAssignment, manager.create(OfficeAssignment, { ...dto, universityId: actor.universityId, assignedBy: actor.id }));
      await this.audit(manager, 'office.assignment.granted', assignment.id, { userId: dto.userId, duty: dto.duty, facultyIds: dto.facultyIds, groupIds: dto.groupIds, canCreateForStudents: !!dto.canCreateForStudents });
      return assignment;
    });
  }
  async revoke(id: string) {
    const actor = this.access.admin();
    return this.db.transaction(async manager => {
      await this.lock(manager);
      const row = await manager.findOneBy(OfficeAssignment, { id, universityId: actor.universityId });
      if (!row) throw new NotFoundException('Назначение недоступно.');
      if (!row.revokedAt) { row.revokedAt = new Date(); row.revokedBy = actor.id; await manager.save(row); await this.audit(manager, 'office.assignment.revoked', id, { userId: row.userId }); }
      return row;
    });
  }
  async routes() { const actor = this.access.admin(); return this.db.manager.findBy(OfficeRoute, { universityId: actor.universityId }); }
  async configureRoute(dto: OfficeRouteDto) {
    const actor = this.access.admin();
    return this.db.transaction(async manager => {
      await this.lock(manager);
      const group = await this.access.group(manager, dto.groupId);
      await this.access.validateRoute(manager, group, dto.type, dto.assigneeIds);
      const existing = await manager.findOneBy(OfficeRoute, { universityId: actor.universityId, groupId: group.id, type: dto.type });
      if ((existing?.version ?? 0) !== dto.version) throw new ConflictException('Маршрут изменён. Обновите страницу.');
      const route = await manager.save(OfficeRoute, manager.create(OfficeRoute, { ...existing, ...dto, universityId: actor.universityId, configuredBy: actor.id, version: dto.version + 1 }));
      await this.audit(manager, 'office.route.configured', route.id, { groupId: group.id, type: dto.type, version: route.version, assigneeIds: route.assigneeIds, dueDays: route.dueDays });
      return route;
    });
  }
  private async studentGroup(manager: EntityManager, studentId: string) {
    const student = await manager.findOneBy(User, { id: studentId, universityId: this.access.actor().universityId, role: UserRole.STUDENT, isActive: true });
    if (!student?.groupId) throw new BadRequestException('Студент или его учебная группа недоступны.');
    const group = await manager.getRepository(Group).createQueryBuilder('g').where('g.universityId = :uni AND (g.id::text = :id OR g.externalId = :id)', { uni: student.universityId, id: student.groupId }).getOne();
    if (!group) throw new BadRequestException('Сначала привяжите студента к существующей группе своего вуза.');
    return group;
  }
  async create(dto: CreateRequestDto) {
    if (dto.title.trim().length < 3 || dto.description.trim().length < 5) throw new BadRequestException('Укажите название и содержание заявления.');
    const actor = this.access.actor();
    return this.db.transaction(async manager => {
      await this.lock(manager);
      const studentId = dto.studentId ?? actor.id, group = await this.studentGroup(manager, studentId);
      if (!(actor.role === UserRole.STUDENT && studentId === actor.id) && !await this.access.hasDuty(manager, group, 'office', actor.id, true)) throw new ForbiddenException('Не разрешена подача от имени этого студента.');
      const payloadHash = hash(dto), previous = await manager.findOneBy(StudentRequest, { universityId: actor.universityId, createdBy: actor.id, createKey: dto.idempotencyKey });
      if (previous) { if (previous.createHash !== payloadHash) throw new ConflictException('Ключ уже использован для другого заявления.'); await this.access.assertRead(manager, previous); return ack(previous); }
      for (const attachmentId of dto.attachmentIds ?? []) {
        const file = await manager.findOneBy(FileAttachment, { id: attachmentId, uploadedBy: studentId, revokedAt: IsNull() });
        const space = file ? await manager.findOneBy(PairSpace, { id: file.pairSpaceId, universityId: actor.universityId }) : null;
        if (!space) throw new BadRequestException('Документ недоступен или не принадлежит студенту в этом вузе.');
      }
      const row = await manager.save(StudentRequest, manager.create(StudentRequest, { universityId: actor.universityId, studentId, groupId: group.id, facultyId: group.facultyId, type: dto.type, title: dto.title.trim(), description: dto.description.trim(), createdBy: actor.id, createKey: dto.idempotencyKey, createHash: payloadHash }));
      for (const attachmentId of dto.attachmentIds ?? []) await manager.save(RequestDocument, manager.create(RequestDocument, { universityId: actor.universityId, requestId: row.id, attachmentId, addedBy: actor.id }));
      await this.audit(manager, 'office.request.created', row.id, { studentId, createdBy: actor.id, type: row.type });
      return ack(row);
    });
  }
  async list(query: RequestQueryDto) {
    const actor = this.access.actor(), manager = this.db.manager;
    const qb = manager.getRepository(StudentRequest).createQueryBuilder('r').where('r.universityId = :uni', { uni: actor.universityId })
      .andWhere("(r.status != 'draft' OR r.studentId = :actor OR r.createdBy = :actor)", { actor: actor.id });
    if (actor.role !== UserRole.UNIVERSITY_ADMIN) {
      const permissions = await this.access.scope(manager);
      const officeGroups = permissions.office;
      const stepGroups: Record<StepDuty, string[]> = { office: permissions.office, methodologist: permissions.methodologist, curator_or_dean: permissions.curator_or_dean, dean: permissions.dean };
      qb.andWhere(new Brackets(scope => {
        scope.where('r.studentId = :actor');
        if (officeGroups.length) scope.orWhere('r.groupId IN (:...officeGroups)', { officeGroups });
        for (const [duty, ids] of Object.entries(stepGroups)) if (ids.length) scope.orWhere(`(r.groupId IN (:...groups_${duty}) AND EXISTS (SELECT 1 FROM request_steps step WHERE step."requestId" = r.id AND step."assigneeId" = :actor AND step.duty = :duty_${duty}))`, { [`groups_${duty}`]: ids, [`duty_${duty}`]: duty });
      }));
    }
    for (const key of ['status', 'type', 'groupId', 'facultyId', 'assignedTo'] as const) if (query[key]) qb.andWhere(`r.${key} = :${key}`, { [key]: query[key] });
    if (query.q) qb.andWhere('r.title ILIKE :q', { q: `%${query.q}%` });
    if (query.overdue) qb.andWhere("r.dueAt < CURRENT_TIMESTAMP AND r.status IN ('submitted','in_review','needs_changes')");
    const [rows, total] = await qb.orderBy('r.createdAt', 'DESC').addOrderBy('r.id', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return toPaginatedResponse(rows.map(({ createHash, createKey, description, ...row }) => ({ ...row, overdue: !!row.dueAt && row.dueAt < new Date() && ['submitted', 'in_review', 'needs_changes'].includes(row.status) })), total, query);
  }
  async get(id: string) {
    const actor = this.access.actor(), manager = this.db.manager;
    const row = await manager.findOneBy(StudentRequest, { id, universityId: actor.universityId });
    if (!row) throw new NotFoundException('Заявление недоступно.');
    await this.access.assertRead(manager, row);
    const steps = await manager.find(RequestStep, { where: { requestId: id, universityId: actor.universityId }, order: { sequence: 'ASC' } });
    const history = await manager.find(RequestDecision, { where: { requestId: id, universityId: actor.universityId }, order: { createdAt: 'ASC', id: 'ASC' } });
    const documents = await manager.find(RequestDocument, { where: { requestId: id, universityId: actor.universityId } });
    const ids = [...new Set([row.studentId, row.createdBy, ...steps.map(step => step.assigneeId), ...history.map(item => item.actorId)])];
    const people = await manager.find(User, { where: { universityId: actor.universityId, id: In(ids) }, select: ['id', 'firstName', 'lastName'] });
    const name = (userId: string) => { const user = people.find(person => person.id === userId); return user ? `${user.lastName} ${user.firstName}` : 'Недоступный аккаунт'; };
    const { createKey, createHash, ...request } = row;
    const group = await this.access.group(manager, row.groupId), office = await this.access.hasDuty(manager, group, 'office');
    const author = row.studentId === actor.id && actor.role === UserRole.STUDENT || row.createdBy === actor.id && await this.access.hasDuty(manager, group, 'office', actor.id, true);
    const availableActions: string[] = [];
    if (row.status === 'draft' && author) availableActions.push('submit');
    if (row.status === 'submitted') { if (office) availableActions.push('accept'); if (author) availableActions.push('withdraw'); }
    if (row.status === 'needs_changes' && author) availableActions.push('revise', 'withdraw');
    const current = steps.find(step => step.state === 'pending');
    if (row.status === 'in_review' && current?.assigneeId === actor.id && row.studentId !== actor.id && await this.access.canPerform(manager, group, current.duty, actor.id)) availableActions.push('approve', 'reject', 'needs_changes');
    if (office && ['submitted', 'in_review', 'needs_changes'].includes(row.status)) availableActions.push('reassign');
    if (office && ['approved', 'rejected', 'withdrawn'].includes(row.status)) availableActions.push('close');
    return { ...request, availableActions, studentName: name(row.studentId), steps: steps.map(step => ({ ...step, assigneeName: name(step.assigneeId) })), history: history.map(({ payloadHash, response, idempotencyKey, ...item }) => ({ ...item, actorName: name(item.actorId) })), documents };
  }
  async command(id: string, dto: RequestCommandDto) {
    const actor = this.access.actor();
    return this.db.transaction(async manager => {
      await this.lock(manager);
      const row = await manager.findOne(StudentRequest, { where: { id, universityId: actor.universityId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException('Заявление недоступно.');
      await this.access.assertRead(manager, row);
      const payloadHash = hash(dto), prior = await manager.findOneBy(RequestDecision, { requestId: id, actorId: actor.id, idempotencyKey: dto.idempotencyKey });
      if (prior) { if (prior.payloadHash !== payloadHash) throw new ConflictException('Ключ уже использован для другой команды.'); return prior.response; }
      if (row.version !== dto.version) throw new ConflictException('Заявление изменилось. Обновите карточку.');
      const group = await this.access.group(manager, row.groupId);
      const author = row.studentId === actor.id && actor.role === UserRole.STUDENT || row.createdBy === actor.id && await this.access.hasDuty(manager, group, 'office', actor.id, true);
      const office = await this.access.hasDuty(manager, group, 'office');
      const steps = await manager.find(RequestStep, { where: { requestId: id }, order: { sequence: 'ASC' } });
      let current = steps.find(step => step.state === 'pending');
      let decisionStepId = current?.id ?? null;
      const fromStatus = row.status;
      let details: JsonObject = {};
      const requireAuthor = () => { if (!author) throw new ForbiddenException('Действие доступно автору заявления.'); };
      const requireOffice = () => { if (!office) throw new ForbiddenException('Нужно действующее назначение учебного офиса этого подразделения.'); };
      const inState = (...states: string[]) => { if (!states.includes(row.status)) throw new ConflictException('Этот переход недоступен в текущем состоянии.'); };
      const requireReason = () => { if (!dto.reason?.trim()) throw new BadRequestException('Укажите основание решения.'); };
      const requireReviewer = async () => {
        if (!current || current.assigneeId !== actor.id || actor.id === row.studentId || !await this.access.canPerform(manager, group, current.duty, actor.id)) throw new ForbiddenException('Решение доступно текущему назначенному согласующему.');
      };
      if (dto.action === 'submit') {
        requireAuthor(); inState('draft');
        const currentGroup = await this.studentGroup(manager, row.studentId);
        if (currentGroup.id !== group.id) throw new ConflictException('Группа студента изменилась. Создайте новое заявление.');
        const route = await manager.findOneBy(OfficeRoute, { universityId: actor.universityId, groupId: group.id, type: row.type });
        const assignees = route?.assigneeIds ?? await this.access.defaultAssignees(manager, group, row.type, row.studentId);
        await this.access.validateRoute(manager, group, row.type, assignees, row.studentId);
        row.workflowVersion = route?.version ?? 1; row.submittedAt = new Date(); row.status = 'submitted';
        const dueDays = route?.dueDays ?? 5;
        for (let sequence = 0; sequence < assignees.length; sequence++) await manager.save(RequestStep, manager.create(RequestStep, { universityId: actor.universityId, requestId: id, sequence, duty: routeDuties(row.type)[sequence], assigneeId: assignees[sequence], dueAt: new Date(Date.now() + dueDays * (sequence + 1) * 86400000) }));
        row.assignedTo = assignees[0]; row.dueAt = new Date(Date.now() + dueDays * 86400000);
      } else if (dto.action === 'accept') {
        requireOffice(); inState('submitted'); row.status = 'in_review';
      } else if (dto.action === 'revise') {
        requireAuthor(); inState('needs_changes'); requireReason();
        if (dto.title && dto.title.trim().length < 3 || dto.description && dto.description.trim().length < 5) throw new BadRequestException('Название или содержание слишком короткое.');
        if (dto.title) row.title = dto.title.trim(); if (dto.description) row.description = dto.description.trim(); row.status = 'submitted';
      } else if (dto.action === 'withdraw') {
        requireAuthor(); inState('submitted', 'needs_changes'); row.status = 'withdrawn'; row.assignedTo = null; row.dueAt = null;
      } else if (dto.action === 'close') {
        requireOffice(); inState('approved', 'rejected', 'withdrawn'); requireReason();
        row.status = 'closed'; row.closedAt = new Date(); row.resultReference = dto.resultReference?.trim() || null;
      } else if (dto.action === 'reassign') {
        requireOffice(); inState('submitted', 'in_review', 'needs_changes'); requireReason();
        const step = steps.find(item => item.sequence === dto.sequence && item.state === 'pending');
        if (!step || !dto.assigneeId || dto.assigneeId === row.studentId || !await this.access.canPerform(manager, group, step.duty, dto.assigneeId)) throw new BadRequestException('Нужен действующий согласующий незавершённого этапа.');
        details = { oldAssigneeId: step.assigneeId, newAssigneeId: dto.assigneeId, sequence: step.sequence };
        decisionStepId = step.id;
        step.assigneeId = dto.assigneeId; await manager.save(step); row.workflowVersion++;
        if (current?.id === step.id) { current = step; row.assignedTo = step.assigneeId; }
      } else {
        inState('in_review'); await requireReviewer(); requireReason();
        if (dto.action === 'needs_changes') row.status = 'needs_changes';
        else if (dto.action === 'approve' || dto.action === 'reject') {
          current!.state = dto.action === 'approve' ? 'approved' : 'rejected'; current!.decidedBy = actor.id; current!.decidedAt = new Date(); current!.reason = dto.reason!.trim(); await manager.save(current!);
          const next = steps.find(step => step.sequence > current!.sequence && step.state === 'pending');
          row.status = dto.action === 'reject' ? 'rejected' : next ? 'in_review' : 'approved';
          row.assignedTo = row.status === 'in_review' ? next!.assigneeId : null; row.dueAt = row.status === 'in_review' ? next!.dueAt : null;
        } else throw new BadRequestException('Неизвестная команда.');
      }
      row.version++; await manager.save(row);
      const response = ack(row);
      await manager.save(RequestDecision, manager.create(RequestDecision, { universityId: actor.universityId, requestId: id, stepId: decisionStepId, actorId: actor.id, action: dto.action, fromStatus, toStatus: row.status, reason: dto.reason?.trim() || '', idempotencyKey: dto.idempotencyKey, payloadHash, response, details }));
      await this.audit(manager, `office.request.${dto.action}`, id, { fromStatus, toStatus: row.status, version: row.version, workflowVersion: row.workflowVersion, ...details });
      return response;
    });
  }
}
