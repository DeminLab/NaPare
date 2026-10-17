import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { assertCareerResultUrl, assertCareerTransition } from '../career/career.service';
import { CareerApplication, CareerCompany, CareerNotice, CareerProfile, CareerAdmission, CareerTask, CareerWork } from '../career/career.entities';
import { PlatformService } from '../platform/platform.service';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformCareerApplicationDecisionDto, PlatformCareerOperationPatchDto, PlatformCareerOperationQueryDto, PlatformCareerWorkDecisionDto } from './platform-career-operations.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };
type ApplicationSummary = { id: string; taskId: string; taskTitle: string; companyName: string; universityId: string; universityName: string; studentId: string; studentName: string; studentEmail: string; messagePreview: string; state: string; profiled: boolean; skill: string; deadline: string; createdAt: Date; updatedAt: Date };
type ApplicationDetail = ApplicationSummary & { message: string };
type WorkSummary = { id: string; taskId: string; taskTitle: string; companyName: string; universityId: string; universityName: string; studentId: string; studentName: string; studentEmail: string; state: string; submissionPreview: string; resultUrl: string; decisionReason: string; skill: string; deadline: string; createdAt: Date; updatedAt: Date };
type WorkDetail = WorkSummary & { submission: string };

@Injectable()
export class PlatformCareerOperationsService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async applications(query: PlatformCareerOperationQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const qb = this.applicationQuery();
    this.applyFilters(qb, query);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('application.createdAt', 'DESC').addOrderBy('application.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<ApplicationSummary>();
    await this.auditRead('platform.career_application.search', 'personal_data.career_application', 'search', access.actorId, {
      recordIds: rows.map(row => row.id), universityIds: [...new Set(rows.map(row => row.universityId))],
      ...(query.universityId ? { universityId: query.universityId } : {}), state: query.state ?? 'any', queryEntered: Boolean(query.q?.trim()),
      page: query.page, limit: query.limit, resultCount: rows.length, total,
    }, context);
    return toPaginatedResponse(rows, total, query);
  }

  async application(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.applicationQuery(true).where('application.id = :id', { id }).getRawOne<ApplicationDetail>();
    if (!row) throw new NotFoundException('Отклик не найден.');
    await this.auditRead('platform.career_application.viewed', 'personal_data.career_application', id, access.actorId, { targetUserId: row.studentId, universityId: row.universityId, taskId: row.taskId, result: 'viewed' }, context);
    return row;
  }

  async works(query: PlatformCareerOperationQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const qb = this.workQuery();
    this.applyFilters(qb, query);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('work.updatedAt', 'DESC').addOrderBy('work.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<WorkSummary>();
    await this.auditRead('platform.career_work.search', 'personal_data.career_work', 'search', access.actorId, {
      recordIds: rows.map(row => row.id), universityIds: [...new Set(rows.map(row => row.universityId))],
      ...(query.universityId ? { universityId: query.universityId } : {}), state: query.state ?? 'any', queryEntered: Boolean(query.q?.trim()),
      page: query.page, limit: query.limit, resultCount: rows.length, total,
    }, context);
    return toPaginatedResponse(rows, total, query);
  }

  async work(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.workQuery(true).where('work.id = :id', { id }).getRawOne<WorkDetail>();
    if (!row) throw new NotFoundException('Работа не найдена.');
    await this.auditRead('platform.career_work.viewed', 'personal_data.career_work', id, access.actorId, { targetUserId: row.studentId, universityId: row.universityId, taskId: row.taskId, result: 'viewed' }, context);
    return row;
  }

  async patchApplication(id: string, dto: PlatformCareerOperationPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    if (dto.message === undefined || dto.submission !== undefined || dto.resultUrl !== undefined) throw new BadRequestException('Укажите только исправленный текст отклика.');
    const message = dto.message.trim();
    if (message.length < 10) throw new BadRequestException('Текст отклика должен содержать не менее 10 символов.');
    return this.db.transaction(async manager => {
      const row = await manager.findOne(CareerApplication, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException('Отклик не найден.');
      const task = await manager.findOne(CareerTask, { where: { id: row.taskId }, lock: { mode: 'pessimistic_read' } });
      const student = await manager.findOne(User, { where: { id: row.studentId }, select: ['id'] });
      if (!task || !student || !await manager.getRepository(University).existsBy({ id: task.universityId })) throw new BadRequestException('Отклик не связан с существующим пользователем и университетом задачи.');
      if (row.message === message) throw new ConflictException('Новый текст совпадает с текущим.');
      const oldValues: JsonObject = { message: row.message, state: row.state };
      row.message = message;
      const updated = await manager.save(CareerApplication, row);
      await this.auditMutation(manager, access.actorId, 'career_application', id, row.studentId, task.universityId, oldValues, { message: updated.message, state: updated.state, adminReason: dto.reason.trim(), result: 'updated' }, context);
      return { id, message: updated.message, state: updated.state, updatedAt: updated.updatedAt };
    });
  }

  async decideApplication(id: string, dto: PlatformCareerApplicationDecisionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const application = await manager.findOne(CareerApplication, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!application) throw new NotFoundException('Отклик не найден.');
      const task = await manager.findOne(CareerTask, { where: { id: application.taskId }, lock: { mode: 'pessimistic_write' } });
      if (!task) throw new NotFoundException('Задача не найдена.');
      const applicant = await manager.findOne(User, { where: { id: application.studentId }, select: ['id'] });
      if (!applicant || !await manager.getRepository(University).existsBy({ id: task.universityId })) throw new BadRequestException('Отклик не связан с существующим пользователем и университетом задачи.');
      if (dto.decision === 'not_selected') {
        assertCareerTransition(application.state, ['pending']);
        if (task.state !== 'open') throw new ConflictException('Отклик можно отклонить после закрытия задачи только через обращение владельцу.');
        const oldValues: JsonObject = { state: application.state };
        application.state = 'not_selected';
        const updated = await manager.save(CareerApplication, application);
        await manager.save(CareerNotice, manager.create(CareerNotice, { userId: applicant.id, title: 'Отклик закрыт', body: `${task.title}. ${dto.reason.trim()}`, isRead: false }));
        await this.auditMutation(manager, access.actorId, 'career_application', id, applicant.id, task.universityId, oldValues, { state: updated.state, adminReason: dto.reason.trim(), result: 'not_selected' }, context);
        return { id, state: updated.state };
      }
      const student = await manager.findOne(User, { where: { id: application.studentId, role: UserRole.STUDENT, universityId: task.universityId }, select: ['id', 'universityId', 'isActive'] });
      if (!student) throw new ConflictException('Выбрать можно только студента этого университета.');
      assertCareerTransition(task.state, ['open']);
      assertCareerTransition(application.state, ['pending']);
      if (!student.isActive) throw new ConflictException('Нельзя назначить неактивного студента исполнителем.');
      if (task.deadline < new Date().toISOString().slice(0, 10)) throw new ConflictException('Срок задачи уже истёк.');
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`career-work:${student.id}`]);
      if (await manager.getRepository(CareerWork).countBy({ studentId: student.id, state: In(['in_progress', 'revision', 'submitted']) }) >= 3) throw new ConflictException('У студента уже три активные работы.');
      if (!await manager.getRepository(CareerProfile).existsBy({ studentId: student.id, universityId: task.universityId, verification: 'verified' })) throw new ConflictException('Профиль студента больше не подтверждён для этого университета.');
      if (task.profiled && !await manager.getRepository(CareerAdmission).existsBy({ studentId: student.id, universityId: task.universityId, skill: task.skill, state: 'approved' })) throw new ConflictException('У студента нет действующего допуска к направлению задачи.');
      if (await manager.getRepository(CareerWork).existsBy({ taskId: task.id })) throw new ConflictException('Для задачи уже создана работа.');
      const applications = await manager.getRepository(CareerApplication).find({ where: { taskId: task.id, state: 'pending' }, lock: { mode: 'pessimistic_write' } });
      const oldStates = applications.map(candidate => ({ id: candidate.id, studentId: candidate.studentId, state: candidate.state }));
      application.state = 'selected';
      task.state = 'assigned';
      for (const candidate of applications) {
        candidate.state = candidate.id === application.id ? 'selected' : 'not_selected';
        await manager.save(CareerApplication, candidate);
      }
      await manager.save(CareerTask, task);
      const work = await manager.save(CareerWork, manager.create(CareerWork, { taskId: task.id, studentId: student.id, state: 'in_progress' }));
      await manager.save(CareerNotice, manager.create(CareerNotice, { userId: student.id, title: 'Вы выбраны исполнителем', body: task.title, isRead: false }));
      for (const other of applications) if (other.id !== id) await manager.save(CareerNotice, manager.create(CareerNotice, { userId: other.studentId, title: 'Отклик закрыт', body: `${task.title}. Выбран другой кандидат.`, isRead: false }));
      await this.auditMutation(manager, access.actorId, 'career_task', task.id, student.id, task.universityId, { state: 'open' }, { state: task.state, workId: work.id, selectedStudentId: student.id, adminReason: dto.reason.trim(), result: 'assigned' }, context);
      await this.auditMutation(manager, access.actorId, 'career_work', work.id, student.id, task.universityId, {}, { taskId: task.id, state: work.state, result: 'created' }, context);
      for (const previous of oldStates) await this.auditMutation(manager, access.actorId, 'career_application', previous.id, previous.studentId, task.universityId,
        { state: previous.state }, { state: previous.id === id ? 'selected' : 'not_selected', taskState: task.state, ...(previous.id === id ? { workId: work.id, adminReason: dto.reason.trim() } : { adminReason: 'Задачу назначили другому кандидату' }), result: previous.id === id ? 'selected' : 'not_selected' }, context);
      return { id, state: application.state, workId: work.id };
    });
  }

  async patchWork(id: string, dto: PlatformCareerOperationPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    if (dto.message !== undefined || (dto.submission === undefined && dto.resultUrl === undefined)) throw new BadRequestException('Укажите исправленный результат работы или HTTPS-ссылку.');
    if (dto.resultUrl !== undefined) assertCareerResultUrl(dto.resultUrl);
    return this.db.transaction(async manager => {
      const work = await manager.findOne(CareerWork, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!work) throw new NotFoundException('Работа не найдена.');
      const task = await manager.findOne(CareerTask, { where: { id: work.taskId }, lock: { mode: 'pessimistic_read' } });
      const student = await manager.findOne(User, { where: { id: work.studentId }, select: ['id'] });
      if (!task || !student || !await manager.getRepository(University).existsBy({ id: task.universityId })) throw new BadRequestException('Работа не связана с существующим пользователем и университетом задачи.');
      const changes = { ...(dto.submission !== undefined ? { submission: dto.submission.trim() } : {}), ...(dto.resultUrl !== undefined ? { resultUrl: dto.resultUrl.trim() } : {}) };
      if (changes.submission !== undefined && !changes.submission) throw new BadRequestException('Результат не может быть пустым.');
      if (!Object.entries(changes).some(([key, value]) => (work as unknown as Record<string, unknown>)[key] !== value)) throw new ConflictException('Новые значения совпадают с текущими.');
      const oldValues: JsonObject = { ...(changes.submission !== undefined ? { submission: work.submission } : {}), ...(changes.resultUrl !== undefined ? { resultUrl: work.resultUrl } : {}) };
      Object.assign(work, changes);
      const updated = await manager.save(CareerWork, work);
      await this.auditMutation(manager, access.actorId, 'career_work', id, student.id, task.universityId, oldValues, { ...changes, state: updated.state, adminReason: dto.reason.trim(), result: 'updated' }, context);
      return { id, submission: updated.submission, resultUrl: updated.resultUrl, state: updated.state, updatedAt: updated.updatedAt };
    });
  }

  async decideWork(id: string, dto: PlatformCareerWorkDecisionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const work = await manager.findOne(CareerWork, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!work) throw new NotFoundException('Работа не найдена.');
      const task = await manager.findOne(CareerTask, { where: { id: work.taskId }, lock: { mode: 'pessimistic_write' } });
      const student = await manager.findOne(User, { where: { id: work.studentId }, select: ['id'] });
      if (!task || !student || !await manager.getRepository(University).existsBy({ id: task.universityId })) throw new BadRequestException('Работа не связана с пользователем и действующим университетом задачи.');
      assertCareerTransition(work.state, ['submitted']);
      const oldValues: JsonObject = { state: work.state, decisionReason: work.decisionReason };
      work.state = dto.decision;
      work.decisionReason = dto.reason.trim();
      task.state = dto.decision;
      const updated = await manager.save(CareerWork, work);
      await manager.save(CareerTask, task);
      await manager.save(CareerNotice, manager.create(CareerNotice, { userId: student.id, title: dto.decision === 'accepted' ? 'Работа принята' : 'Запрошена доработка', body: `${task.title}. ${dto.reason.trim()}`, isRead: false }));
      await this.auditMutation(manager, access.actorId, 'career_task', task.id, student.id, task.universityId, { state: 'submitted' }, { state: task.state, workId: id, adminReason: dto.reason.trim(), result: dto.decision }, context);
      await this.auditMutation(manager, access.actorId, 'career_work', id, student.id, task.universityId, oldValues, { state: updated.state, decisionReason: updated.decisionReason, taskState: task.state, adminReason: dto.reason.trim(), paymentConfirmed: false, result: dto.decision }, context);
      return { id, state: updated.state, decisionReason: updated.decisionReason };
    });
  }

  private applicationQuery(includeMessage = false): SelectQueryBuilder<CareerApplication> {
    const qb = this.db.getRepository(CareerApplication).createQueryBuilder('application')
      .innerJoin(CareerTask, 'task', 'task.id = application.taskId')
      .innerJoin(University, 'university', 'university.id = task.universityId')
      .innerJoin(CareerCompany, 'company', 'company.id = task.companyId')
      .leftJoin(User, 'student', 'student.id = application.studentId')
      .select('application.id', 'id').addSelect('application.taskId', 'taskId').addSelect('task.title', 'taskTitle')
      .addSelect('company.name', 'companyName').addSelect('task.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('application.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('LEFT(application.message, 180)', 'messagePreview')
      .addSelect('application.state', 'state').addSelect('task.profiled', 'profiled').addSelect('task.skill', 'skill')
      .addSelect('task.deadline', 'deadline').addSelect('application.createdAt', 'createdAt').addSelect('application.updatedAt', 'updatedAt');
    if (includeMessage) qb.addSelect('application.message', 'message');
    return qb;
  }

  private workQuery(includeSubmission = false): SelectQueryBuilder<CareerWork> {
    const qb = this.db.getRepository(CareerWork).createQueryBuilder('work')
      .innerJoin(CareerTask, 'task', 'task.id = work.taskId')
      .innerJoin(University, 'university', 'university.id = task.universityId')
      .innerJoin(CareerCompany, 'company', 'company.id = task.companyId')
      .leftJoin(User, 'student', 'student.id = work.studentId')
      .select('work.id', 'id').addSelect('work.taskId', 'taskId').addSelect('task.title', 'taskTitle')
      .addSelect('company.name', 'companyName').addSelect('task.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('work.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('work.state', 'state').addSelect('LEFT(work.submission, 180)', 'submissionPreview')
      .addSelect('work.resultUrl', 'resultUrl').addSelect('work.decisionReason', 'decisionReason')
      .addSelect('task.skill', 'skill').addSelect('task.deadline', 'deadline').addSelect('work.createdAt', 'createdAt').addSelect('work.updatedAt', 'updatedAt');
    if (includeSubmission) qb.addSelect('work.submission', 'submission');
    return qb;
  }

  private applyFilters(qb: SelectQueryBuilder<CareerApplication | CareerWork>, query: PlatformCareerOperationQueryDto): void {
    if (query.universityId) qb.andWhere('task.universityId = :universityId', { universityId: query.universityId });
    if (query.state) qb.andWhere(`${qb.alias}.state = :state`, { state: query.state });
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      const contentField = qb.alias === 'application' ? 'application.message' : 'work.submission';
      qb.andWhere(`(${qb.alias}.id::text ILIKE :q ESCAPE E'\\\\' OR ${qb.alias}.studentId::text ILIKE :q ESCAPE E'\\\\' OR ${contentField} ILIKE :q ESCAPE E'\\\\' OR student.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', student.firstName, student.lastName) ILIKE :q ESCAPE E'\\\\' OR task.title ILIKE :q ESCAPE E'\\\\')`, { q: pattern });
    }
  }

  private async auditRead(action: string, entity: string, entityId: string, actorId: string, values: JsonObject, context: RequestAuditContext): Promise<void> {
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: actorId, action, entity, entityId, newValues: values, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
  }

  private async auditMutation(manager: EntityManager, actorId: string, entityType: 'career_application' | 'career_work' | 'career_task', id: string, studentId: string, universityId: string, oldValues: JsonObject, newValues: JsonObject, context: RequestAuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, { userId: actorId, action: `platform.${entityType}.${newValues.result}`, entity: `personal_data.${entityType}`, entityId: id, oldValues, newValues: { ...newValues, targetUserId: studentId, universityId }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
  }

  private assertReason(reason: string): void { if (reason.trim().length < 3) throw new BadRequestException('Укажите причину изменения (не менее 3 символов).'); }
}
