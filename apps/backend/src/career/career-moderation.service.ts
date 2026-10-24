import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { requireUniversityId } from '../common/tenant/require-university';
import { CareerApplication, CareerCompany, CareerMembership, CareerPartnership, CareerTask, CareerTaskComplaint, CareerWork } from './career.entities';
import { CareerService } from './career.service';
import { assessCareerTaskRisk, CAREER_RISK_LABELS, CAREER_RISK_POLICY_VERSION } from './career-risk-policy';
import { CareerComplaintDecisionDto, CareerComplaintDto, CareerModerationPageDto, CareerTaskRevisionDto } from './career-moderation.dto';

@Injectable()
export class CareerModerationService {
  constructor(private readonly db: DataSource, private readonly career: CareerService) {}

  private async task(manager: EntityManager, id: string) {
    const task = await manager.findOne(CareerTask, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!task) throw new NotFoundException('Задача не найдена');
    return task;
  }
  private async companyMember(manager: EntityManager, actor: AuthenticatedUser, companyId: string) {
    const member = await manager.findOne(CareerMembership, { where: { userId: actor.id, companyId, role: In(['company_owner','company_member']), revokedAt: IsNull() }, lock: { mode: 'pessimistic_read' } });
    if (!member) throw new ForbiddenException('Нет действующего назначения в компанию');
  }
  private async moderator(manager: EntityManager, actor: AuthenticatedUser, task: CareerTask) {
    if (requireUniversityId(actor) !== task.universityId) throw new ForbiddenException('Другой вуз');
    await this.career.assertCenterAccess(actor);
    if (![UserRole.CAREER_STAFF,UserRole.CAREER_ADMIN,UserRole.UNIVERSITY_ADMIN].includes(actor.role)) {
      const member = await manager.findOne(CareerMembership, { where: { userId: actor.id, universityId: task.universityId, role: In(['career_staff','career_admin']), revokedAt: IsNull() }, lock: { mode: 'pessimistic_read' } });
      if (!member) throw new ForbiddenException('Назначение карьерного центра отозвано');
    }
    if (await manager.getRepository(CareerMembership).existsBy({ userId: actor.id, companyId: task.companyId, revokedAt: IsNull() })) throw new ForbiddenException('Нельзя модерировать собственную компанию');
  }
  private async partnership(manager: EntityManager, task: CareerTask) {
    if (!await manager.findOne(CareerPartnership, { where: { companyId: task.companyId, universityId: task.universityId, state: 'verified' }, lock: { mode: 'pessimistic_read' } })) throw new ForbiddenException('Партнёрство компании и вуза не подтверждено');
  }
  private before(task: CareerTask): JsonObject { return { state: task.state, moderationStatus: task.moderationStatus, contentVersion: task.moderationContentVersion }; }
  private async audit(manager: EntityManager, actor: AuthenticatedUser, task: CareerTask, action: string, previous: JsonObject, extra: JsonObject = {}) {
    await manager.save(AuditLog, { userId: actor.id, action, entity: 'career_task', entityId: task.id, oldValues: previous,
      newValues: { universityId: task.universityId, state: task.state, moderationStatus: task.moderationStatus, contentVersion: task.moderationContentVersion,
        flags: task.moderationFlags || [], reason: task.moderationReason || '', ...extra } });
  }
  async publish(actor: AuthenticatedUser, id: string) {
    return this.db.transaction(async manager => {
      const task = await this.task(manager, id); await this.companyMember(manager, actor, task.companyId); await this.partnership(manager, task);
      if (task.state !== 'draft') throw new ConflictException('Отправить можно только черновик');
      if (task.moderationStatus === 'rejected' && task.moderationReviewedVersion === task.moderationContentVersion) throw new ConflictException('Исправьте задачу перед повторной подачей');
      if (task.deadline < new Date().toISOString().slice(0,10)) throw new ConflictException('Срок задачи уже истёк');
      const previous = this.before(task); task.moderationFlags = assessCareerTaskRisk(task); task.moderationPolicyVersion = CAREER_RISK_POLICY_VERSION;
      task.state = 'review'; task.moderationStatus = 'pending';
      await manager.save(task); await this.audit(manager, actor, task, 'career.task.submit', previous); return task;
    });
  }
  async decide(actor: AuthenticatedUser, id: string, decision: 'approve' | 'reject', reason = '', expectedVersion?: number) {
    return this.db.transaction(async manager => {
      const task = await this.task(manager, id); await this.moderator(manager, actor, task);
      if (task.state !== 'review' && task.moderationStatus !== 'suspended') throw new ConflictException('Задача не ожидает решения');
      if (expectedVersion !== undefined && expectedVersion !== task.moderationContentVersion) throw new ConflictException('Содержимое изменилось. Обновите задачу');
      const flags = assessCareerTaskRisk(task);
      if (await manager.getRepository(CareerTaskComplaint).existsBy({ taskId: id, universityId: task.universityId, state: 'open' })) flags.push('open_complaints');
      if (expectedVersion === undefined && (flags.length || task.moderationContentVersion > 1)) throw new ConflictException('Используйте экран модерации с актуальной версией и причиной решения');
      if ((decision === 'reject' || flags.length) && reason.trim().length < 10) throw new BadRequestException('Укажите причину решения не короче 10 символов');
      const previous = this.before(task);
      if (decision === 'approve') {
        await this.partnership(manager, task);
        if (flags.includes('invalid_terms')) throw new ConflictException('Сначала исправьте сумму или трудоёмкость');
        if (task.state === 'review') {
          if (task.deadline < new Date().toISOString().slice(0,10)) throw new ConflictException('Срок задачи уже истёк');
          task.state = 'open';
        }
        task.moderationStatus = 'approved';
      } else {
        if (task.state !== 'review' || await manager.getRepository(CareerWork).existsBy({ taskId: id }) || await manager.getRepository(CareerApplication).existsBy({ taskId: id })) throw new ConflictException('Возврат в черновик доступен только без откликов и работ; сохраните ограничение до выяснения условий');
        task.state = 'draft'; task.moderationStatus = 'rejected';
      }
      task.moderationFlags = flags; task.moderationPolicyVersion = CAREER_RISK_POLICY_VERSION; task.moderationReason = reason.trim();
      task.moderationReviewedVersion = task.moderationContentVersion; task.moderationDecidedBy = actor.id; task.moderationDecidedAt = new Date();
      await manager.save(task); await this.audit(manager, actor, task, `career.task.${decision}`, previous); return task;
    });
  }
  async revise(actor: AuthenticatedUser, id: string, dto: CareerTaskRevisionDto) {
    return this.db.transaction(async manager => {
      const task = await this.task(manager, id); await this.companyMember(manager, actor, task.companyId);
      if (dto.expectedVersion !== task.moderationContentVersion) throw new ConflictException('Содержимое изменилось. Обновите задачу перед редактированием');
      if (task.state !== 'draft' || await manager.getRepository(CareerApplication).existsBy({ taskId: id }) || await manager.getRepository(CareerWork).existsBy({ taskId: id })) throw new ConflictException('Изменять можно только черновик без откликов и работ');
      if (dto.title.trim().length < 5 || dto.description.trim().length < 20 || dto.criteria.trim().length < 10 || dto.profiled && !dto.skill.trim()) throw new BadRequestException('Проверьте описание, критерии и направление');
      if (!Number.isFinite(Date.parse(dto.deadline)) || new Date(dto.deadline).toISOString().slice(0,10) !== dto.deadline || dto.deadline < new Date().toISOString().slice(0,10)) throw new BadRequestException('Нужна существующая будущая дата');
      const { expectedVersion, ...input } = dto; void expectedVersion;
      const values = { ...input, title: dto.title.trim(), description: dto.description.trim(), criteria: dto.criteria.trim(), skill: dto.skill.trim().toLowerCase(), requirements: dto.requirements?.trim() ?? task.requirements, level: dto.level || task.level };
      if (!Object.entries(values).some(([key,value]) => task[key] !== value)) throw new BadRequestException('Измените хотя бы одно поле');
      const previous = this.before(task); Object.assign(task, values); task.moderationContentVersion++;
      task.moderationFlags = assessCareerTaskRisk(task); task.moderationPolicyVersion = CAREER_RISK_POLICY_VERSION;
      await manager.save(task); await this.audit(manager, actor, task, 'career.task.revise', previous); return task;
    });
  }
  async tasks(actor: AuthenticatedUser, page: CareerModerationPageDto) {
    const universityId = await this.career.assertCenterAccess(actor);
    const [items,total] = await this.db.getRepository(CareerTask).createQueryBuilder('task').where('task.universityId=:universityId',{universityId})
      .andWhere('(task.state=:review OR task.moderationStatus=:suspended)',{review:'review',suspended:'suspended'})
      .orderBy('task.updatedAt','ASC').addOrderBy('task.id','ASC').skip(page.offset).take(page.limit).getManyAndCount();
    return {items,total,offset:page.offset,limit:page.limit,hasMore:page.offset+items.length<total,policy:{version:CAREER_RISK_POLICY_VERSION,labels:CAREER_RISK_LABELS}};
  }
  async complain(actor: AuthenticatedUser, id: string, dto: CareerComplaintDto) {
    if (actor.role !== UserRole.STUDENT) throw new ForbiddenException('Жалобу отправляет студент');
    const universityId = requireUniversityId(actor);
    if (dto.details.trim().length < 10) throw new BadRequestException('Опишите жалобу не короче 10 символов');
    try { return await this.db.transaction(async manager => {
      const task = await this.task(manager, id);
      if (task.universityId !== universityId || task.state !== 'open' && !await manager.getRepository(CareerApplication).existsBy({ taskId: id, studentId: actor.id })) throw new ForbiddenException('Задача недоступна студенту');
      const taskSnapshot = {title:task.title,description:task.description,criteria:task.criteria,requirements:task.requirements,rewardKopecks:task.rewardKopecks,hours:task.hours,deadline:task.deadline,profiled:task.profiled,skill:task.skill,contentVersion:task.moderationContentVersion};
      const complaint = await manager.save(CareerTaskComplaint, { universityId, taskId: id, studentId: actor.id, category: dto.category, details: dto.details.trim(),taskSnapshot });
      await this.audit(manager, actor, task, 'career.complaint.create', {}, { complaintId: complaint.id, category: complaint.category });
      return complaint;
    }); } catch (error) {
      if ((error as { driverError?: {code?:string} }).driverError?.code === '23505') throw new ConflictException('Открытая жалоба на эту задачу уже есть');
      throw error;
    }
  }
  async complaints(actor: AuthenticatedUser, page: CareerModerationPageDto & {taskId?:string}, own = false) {
    const universityId = own ? requireUniversityId(actor) : await this.career.assertCenterAccess(actor);
    if (own && actor.role !== UserRole.STUDENT) throw new ForbiddenException('Список доступен студенту');
    const where = own ? { studentId: actor.id, ...(page.taskId ? {taskId:page.taskId} : {}) } : { universityId, state: 'open' };
    const [items,total] = await this.db.getRepository(CareerTaskComplaint).findAndCount({where,order:{createdAt:'ASC',id:'ASC'},skip:page.offset,take:page.limit});
    const tasks = !own && items.length ? await this.db.getRepository(CareerTask).find({where:{id:In(items.map(item=>item.taskId)),universityId},select:{id:true,title:true,description:true,criteria:true,rewardKopecks:true,hours:true,companyId:true}}) : [];
    const companies = tasks.length ? await this.db.getRepository(CareerCompany).find({where:{id:In([...new Set(tasks.map(task=>task.companyId))])},select:{id:true,name:true}}) : [];
    const rows = own ? items : items.map(item=>{const task=tasks.find(row=>row.id===item.taskId);return {...item,task:task?{...task,companyName:companies.find(company=>company.id===task.companyId)?.name||''}:null};});
    return {items:rows,total,offset:page.offset,limit:page.limit,hasMore:page.offset+items.length<total};
  }
  async resolve(actor: AuthenticatedUser, id: string, dto: CareerComplaintDecisionDto) {
    if (dto.reason.trim().length < 10) throw new BadRequestException('Укажите причину решения не короче 10 символов');
    // Read only the scoped task ID first; all mutation locks take task before complaint.
    const initial = await this.db.getRepository(CareerTaskComplaint).findOneBy({id});
    if (!initial) throw new NotFoundException('Жалоба не найдена');
    return this.db.transaction(async manager => {
      const task = await this.task(manager, initial.taskId); await this.moderator(manager, actor, task);
      const complaint = await manager.findOne(CareerTaskComplaint,{where:{id,taskId:task.id,universityId:task.universityId},lock:{mode:'pessimistic_write'}});
      if (!complaint) throw new NotFoundException('Жалоба не найдена');
      if (complaint.state !== 'open') throw new ConflictException('Жалоба уже рассмотрена');
      const previous = this.before(task);
      if (dto.decision === 'uphold') {
        task.moderationStatus = 'suspended'; task.moderationReason = dto.reason.trim();
        if (task.state === 'open') task.state = 'review';
        task.moderationDecidedBy = actor.id; task.moderationDecidedAt = new Date(); await manager.save(task);
      }
      complaint.state = dto.decision === 'uphold' ? 'resolved' : 'dismissed'; complaint.resolution = dto.reason.trim(); complaint.resolvedBy = actor.id; complaint.resolvedAt = new Date();
      await manager.save(complaint); await this.audit(manager, actor, task, `career.complaint.${dto.decision}`, previous, {complaintId:id,resolution:complaint.resolution}); return complaint;
    });
  }
}
