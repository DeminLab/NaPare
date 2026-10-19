import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { PlatformService } from '../platform/platform.service';
import { PlatformQueryDto } from '../platform/platform.dto';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { CareerAdmission, CareerApplication, CareerAvailability, CareerCompany, CareerMembership, CareerNotice, CareerPartnership, CareerPortfolio, CareerProfile, CareerReview, CareerTask, CareerTest, CareerTestAttempt, CareerWork } from '../career/career.entities';
import { validateAvailability } from '../career/career-planning.service';
import {
  PlatformCareerAdmissionPatchDto,
  PlatformCareerAdmissionQueryDto,
  PlatformCareerCompanyPatchDto,
  PlatformCareerCompanyQueryDto,
  PlatformCareerMembershipQueryDto,
  PlatformCareerDecisionDto,
  PlatformCareerPartnershipDecisionDto,
  PlatformCareerPartnershipQueryDto,
  PlatformCareerTaskPatchDto,
  PlatformCareerTaskQueryDto,
  PlatformCareerProfilePatchDto,
  PlatformCareerProfileQueryDto,
  PlatformCareerReasonDto,
  PlatformCareerTransferOwnerDto,
  PlatformCareerTestPatchDto,
  PlatformCareerTestQueryDto,
  PlatformCareerNoticePatchDto,
  PlatformCareerNoticeQueryDto,
  PlatformCareerPortfolioPatchDto,
  PlatformCareerPortfolioQueryDto,
  PlatformCareerReviewPatchDto,
  PlatformCareerReviewQueryDto,
  PlatformCareerAvailabilityPatchDto,
  PlatformCareerAvailabilityQueryDto,
} from './platform-career.dto';

type ProfileRow = { id: string; studentId: string; studentName: string; studentEmail: string; studentUniversityId: string | null; universityId: string; universityName: string; headline: string; about: string; skills: string[]; verification: string; createdAt: Date; updatedAt: Date };
type AdmissionRow = { id: string; studentId: string; studentName: string; studentEmail: string; studentUniversityId: string | null; universityId: string; universityName: string; skill: string; evidence: string; state: string; reason: string; basis: string; createdAt: Date; updatedAt: Date };
type RequestAuditContext = { ip?: string; userAgent?: string };

@Injectable()
export class PlatformCareerService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async companies(query: PlatformCareerCompanyQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertGlobalCareerAccess(access);
    const qb = this.db.getRepository(CareerCompany).createQueryBuilder('company')
      .select('company.id', 'id').addSelect('company.name', 'name').addSelect('company.createdBy', 'createdBy')
      .addSelect('company.createdAt', 'createdAt').addSelect('company.updatedAt', 'updatedAt')
      .addSelect('(SELECT COUNT(*) FROM career_partnership partnership WHERE partnership."companyId" = company.id)', 'partnershipCount');
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['company.id::text', 'company.name', 'company.description', 'company.createdBy::text']);
    if (query.partnershipState) qb.andWhere('EXISTS (SELECT 1 FROM career_partnership p WHERE p."companyId" = company.id AND p.state = :partnershipState)', { partnershipState: query.partnershipState });
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('company.updatedAt', 'DESC').addOrderBy('company.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.auditCatalogRead('career_company', 'search', access.actorId, rows.map(row => String(row.id)), query, total, context);
    return toPaginatedResponse(rows.map(row => ({ id: row.id, name: row.name, createdBy: row.createdBy, partnershipCount: Number(row.partnershipCount), createdAt: row.createdAt, updatedAt: row.updatedAt })), total, query);
  }

  async memberships(query: PlatformCareerMembershipQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    if (!access.owner && access.universityIds !== null && query.companyId) throw new ForbiddenException('Доступ к company memberships доступен только владельцу или глобальному разрешению.');
    const qb = this.db.getRepository(CareerMembership).createQueryBuilder('membership')
      .innerJoin(User, 'user', 'user.id = membership.userId')
      .leftJoin(CareerCompany, 'company', 'company.id = membership.companyId')
      .leftJoin(University, 'university', 'university.id = membership.universityId')
      .select('membership.id', 'id').addSelect('membership.userId', 'userId')
      .addSelect("concat_ws(' ', user.firstName, user.lastName)", 'userName').addSelect('user.email', 'email')
      .addSelect('membership.role', 'role').addSelect('membership.companyId', 'companyId').addSelect('company.name', 'companyName')
      .addSelect('membership.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('membership.createdAt', 'createdAt').addSelect('membership.revokedAt', 'revokedAt').addSelect('membership.revokedBy', 'revokedBy');
    if (query.universityId) qb.andWhere('membership.universityId = :universityId', { universityId: query.universityId });
    if (!access.owner && access.universityIds !== null) {
      qb.andWhere('membership.companyId IS NULL');
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('membership.universityId IN (:...careerAllowedUniversityIds)', { careerAllowedUniversityIds: access.universityIds })
        .andWhere('user.universityId = membership.universityId');
    }
    if (query.status === 'active') qb.andWhere('membership.revokedAt IS NULL');
    if (query.status === 'revoked') qb.andWhere('membership.revokedAt IS NOT NULL');
    if (query.companyId) qb.andWhere('membership.companyId = :companyId', { companyId: query.companyId });
    if (query.role) qb.andWhere('membership.role = :role', { role: query.role });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['membership.id::text', 'membership.userId::text', 'user.email', 'user.firstName', 'user.lastName', 'membership.companyId::text', 'company.name', 'membership.universityId::text', 'university.name', 'membership.role']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('membership.revokedAt', 'ASC', 'NULLS FIRST').addOrderBy('membership.createdAt', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_membership.search', entity: 'personal_data.career_membership', entityId: 'search', newValues: { recordIds: rows.map(row => String(row.id)), ...(query.universityId ? { universityId: query.universityId } : {}), ...(query.status ? { status: query.status } : {}), queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return toPaginatedResponse(rows, total, query);
  }

  async revokeMembership(id: string, dto: PlatformCareerReasonDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const membership = await manager.findOne(CareerMembership, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!membership) throw new NotFoundException('Назначение не найдено.');
      if (membership.companyId) this.assertGlobalCareerAccess(access);
      else {
        this.platform.assertUniversityScope(access, membership.universityId);
        if (!access.owner && access.universityIds !== null) {
          const memberUser = await manager.getRepository(User).findOne({ where: { id: membership.userId }, select: ['id', 'universityId'] });
          if (!memberUser || memberUser.universityId !== membership.universityId) throw new BadRequestException('Назначение связано с пользователем другого университета.');
        }
      }
      if (membership.revokedAt) throw new ConflictException('Назначение уже отозвано.');
      if (membership.companyId && membership.role === 'company_owner') {
        await manager.findOne(CareerCompany, { where: { id: membership.companyId }, lock: { mode: 'pessimistic_write' } });
        const ownerCount = await manager.getRepository(CareerMembership).createQueryBuilder('membership').where('membership."companyId" = :companyId AND membership.role = :role AND membership."revokedAt" IS NULL', { companyId: membership.companyId, role: 'company_owner' }).getCount();
        if (ownerCount <= 1) throw new ConflictException('Нельзя отозвать доступ последнего владельца компании. Сначала назначьте другого владельца.');
      }
      const oldValues: JsonObject = { role: membership.role, companyId: membership.companyId, universityId: membership.universityId, revokedAt: null };
      const revokedAt = new Date();
      membership.revokedAt = revokedAt;
      membership.revokedBy = access.actorId;
      const updated = await manager.save(CareerMembership, membership);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_membership.revoked', entity: 'personal_data.career_membership', entityId: id, oldValues, newValues: { role: updated.role, companyId: updated.companyId, universityId: updated.universityId, revokedAt: revokedAt.toISOString(), revokedBy: access.actorId, targetUserId: updated.userId, adminReason: dto.reason.trim(), result: 'revoked' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, revokedAt, revokedBy: access.actorId };
    });
  }

  async transferCompanyOwner(id: string, dto: PlatformCareerTransferOwnerDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertGlobalCareerAccess(access);
    this.assertReason(dto.reason);
    if (id === dto.targetMembershipId) throw new BadRequestException('Выберите другого участника компании.');
    return this.db.transaction(async manager => {
      const current = await manager.findOne(CareerMembership, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!current || current.role !== 'company_owner' || !current.companyId || current.revokedAt) throw new ConflictException('Владение доступно только действующему владельцу компании.');
      await manager.findOne(CareerCompany, { where: { id: current.companyId }, lock: { mode: 'pessimistic_write' } });
      const target = await manager.findOne(CareerMembership, { where: { id: dto.targetMembershipId }, lock: { mode: 'pessimistic_write' } });
      if (!target || target.companyId !== current.companyId || target.revokedAt || target.role !== 'company_member') throw new BadRequestException('Новый владелец должен быть действующим участником этой компании.');
      const user = await manager.findOne(User, { where: { id: target.userId, isActive: true }, select: ['id', 'role'] });
      if (!user || [UserRole.STUDENT, UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(user.role)) throw new BadRequestException('Аккаунт не подходит для управления компанией.');
      const oldCurrent: JsonObject = { role: current.role, revokedAt: current.revokedAt, companyId: current.companyId };
      const oldTarget: JsonObject = { role: target.role, revokedAt: target.revokedAt, companyId: target.companyId };
      const revokedAt = new Date();
      current.revokedAt = revokedAt;
      current.revokedBy = access.actorId;
      target.role = 'company_owner';
      const [updatedCurrent, updatedTarget] = await manager.save(CareerMembership, [current, target]);
      const common = { companyId: current.companyId, adminReason: dto.reason.trim() };
      await manager.save(AuditLog, [
        manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_membership.owner_transferred', entity: 'personal_data.career_membership', entityId: current.id, oldValues: oldCurrent, newValues: { ...common, role: updatedCurrent.role, revokedAt: revokedAt.toISOString(), revokedBy: access.actorId, targetUserId: updatedCurrent.userId, transferredToMembershipId: updatedTarget.id, result: 'owner_transferred' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }),
        manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_membership.owner_received', entity: 'personal_data.career_membership', entityId: target.id, oldValues: oldTarget, newValues: { ...common, role: updatedTarget.role, targetUserId: updatedTarget.userId, transferredFromMembershipId: current.id, result: 'owner_received' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }),
      ]);
      return { from: { id: updatedCurrent.id, revokedAt }, to: { id: updatedTarget.id, role: updatedTarget.role } };
    });
  }

  async tests(query: PlatformCareerTestQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerTest).createQueryBuilder('test')
      .innerJoin(University, 'university', 'university.id = test.universityId')
      .select('test.id', 'id').addSelect('test.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('test.title', 'title').addSelect('test.skill', 'skill').addSelect('test.passingPercent', 'passingPercent')
      .addSelect('jsonb_array_length(test.questions)', 'questionCount')
      .addSelect('(SELECT COUNT(*) FROM career_test_attempt attempt WHERE attempt."testId" = test.id)', 'attemptCount')
      .addSelect('test.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('test.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'test.universityId');
    if (!access.owner && access.universityIds !== null) qb.andWhere('student.universityId = test.universityId');
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['test.id::text', 'test.title', 'test.skill', 'test.universityId::text', 'university.name']);
    if (query.outcome === 'passed') qb.andWhere('EXISTS (SELECT 1 FROM career_test_attempt attempt WHERE attempt."testId" = test.id AND attempt.passed = true)');
    if (query.outcome === 'failed') qb.andWhere('EXISTS (SELECT 1 FROM career_test_attempt attempt WHERE attempt."testId" = test.id AND attempt.passed = false)');
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('test.updatedAt', 'DESC').addOrderBy('test.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_test.search', entity: 'personal_data.career_test', entityId: 'search', newValues: { recordIds: rows.map(row => String(row.id)), ...(query.universityId ? { universityId: query.universityId } : {}), ...(query.outcome ? { outcome: query.outcome } : {}), queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return toPaginatedResponse(rows.map(row => ({ ...row, passingPercent: Number(row.passingPercent), questionCount: Number(row.questionCount), attemptCount: Number(row.attemptCount) })), total, query);
  }

  async test(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const test = await this.db.getRepository(CareerTest).findOneBy({ id });
    if (!test) throw new NotFoundException('Карьерный тест не найден.');
    this.platform.assertUniversityScope(access, test.universityId);
    const university = await this.db.getRepository(University).findOne({ where: { id: test.universityId }, select: { id: true, name: true } });
    const attemptCount = await this.db.getRepository(CareerTestAttempt).countBy({ testId: id });
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_test.viewed', entity: 'personal_data.career_test', entityId: id, newValues: { universityId: test.universityId, result: 'viewed', correctAnswersIncluded: true }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return { id: test.id, universityId: test.universityId, universityName: university?.name ?? null, title: test.title, skill: test.skill, passingPercent: test.passingPercent, questions: test.questions, attemptCount, canEditQuestions: attemptCount === 0, createdAt: test.createdAt, updatedAt: test.updatedAt };
  }

  async patchTest(id: string, dto: PlatformCareerTestPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    if (dto.title === undefined && dto.passingPercent === undefined && dto.questions === undefined) throw new BadRequestException('Укажите поля теста для изменения.');
    return this.db.transaction(async manager => {
      const test = await manager.findOne(CareerTest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!test) throw new NotFoundException('Карьерный тест не найден.');
      this.platform.assertUniversityScope(access, test.universityId);
      const attemptCount = await manager.getRepository(CareerTestAttempt).countBy({ testId: id });
      if (dto.questions !== undefined && attemptCount > 0) throw new ConflictException('Вопросы теста нельзя менять после появления попыток: результаты сохраняют исходный смысл.');
      if (dto.questions?.some(question => question.answer >= question.options.length || new Set(question.options.map(option => option.trim())).size !== question.options.length || question.options.some(option => !option.trim()))) throw new BadRequestException('Укажите существующий правильный вариант для каждого вопроса.');
      const fields = ['title', 'passingPercent', 'questions'] as const;
      const oldValues = this.snapshot(test, fields);
      if (dto.title !== undefined) test.title = dto.title.trim();
      if (dto.passingPercent !== undefined) test.passingPercent = dto.passingPercent;
      if (dto.questions !== undefined) test.questions = dto.questions.map(question => ({ prompt: question.prompt.trim(), options: question.options.map(option => option.trim()), answer: question.answer }));
      if (!test.title) throw new BadRequestException('Название теста не может быть пустым.');
      if (JSON.stringify(oldValues) === JSON.stringify(this.snapshot(test, fields))) throw new ConflictException('Новые значения совпадают с текущими.');
      const updated = await manager.save(CareerTest, test);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_test.updated', entity: 'personal_data.career_test', entityId: id, oldValues, newValues: { ...this.snapshot(updated, fields), universityId: updated.universityId, skill: updated.skill, attemptCount, adminReason: dto.reason.trim(), result: 'updated' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, title: updated.title, passingPercent: updated.passingPercent, updatedAt: updated.updatedAt };
    });
  }

  async testAttempts(query: PlatformCareerTestQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerTestAttempt).createQueryBuilder('attempt')
      .innerJoin(CareerTest, 'test', 'test.id = attempt.testId')
      .innerJoin(University, 'university', 'university.id = test.universityId')
      .innerJoin(User, 'student', 'student.id = attempt.studentId')
      .select('attempt.id', 'id').addSelect('attempt.testId', 'testId').addSelect('test.title', 'testTitle')
      .addSelect('test.skill', 'skill').addSelect('test.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('attempt.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('attempt.score', 'score').addSelect('attempt.passed', 'passed').addSelect('attempt.createdAt', 'createdAt');
    if (query.universityId) qb.andWhere('test.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'test.universityId');
    if (query.outcome === 'passed') qb.andWhere('attempt.passed = true');
    if (query.outcome === 'failed') qb.andWhere('attempt.passed = false');
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['attempt.id::text', 'attempt.studentId::text', 'student.email', 'student.firstName', 'student.lastName', 'test.title', 'test.skill', 'test.id::text', 'test.universityId::text', 'university.name']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('attempt.createdAt', 'DESC').addOrderBy('attempt.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_test_attempt.search', entity: 'personal_data.career_test_attempt', entityId: 'search', newValues: { recordIds: rows.map(row => String(row.id)), targetUserIds: [...new Set(rows.map(row => String(row.studentId)))], universityIds: [...new Set(rows.map(row => String(row.universityId)))], ...(query.universityId ? { universityId: query.universityId } : {}), ...(query.outcome ? { outcome: query.outcome } : {}), queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return toPaginatedResponse(rows, total, query);
  }

  async portfolios(query: PlatformCareerPortfolioQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerPortfolio).createQueryBuilder('portfolio')
      .innerJoin(CareerWork, 'work', 'work.id = portfolio.workId')
      .innerJoin(CareerTask, 'task', 'task.id = work.taskId')
      .innerJoin(CareerCompany, 'company', 'company.id = task.companyId')
      .innerJoin(University, 'university', 'university.id = task.universityId')
      .innerJoin(User, 'student', 'student.id = portfolio.studentId')
      .leftJoin(CareerReview, 'review', 'review.workId = portfolio.workId')
      .select('portfolio.id', 'id').addSelect('portfolio.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName').addSelect('student.email', 'studentEmail')
      .addSelect('task.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('task.title', 'taskTitle').addSelect('company.name', 'companyName')
      .addSelect('portfolio.published', 'published').addSelect('LEFT(portfolio.caseText, 220)', 'casePreview')
      .addSelect('review.publishAllowed', 'reviewPublishAllowed').addSelect('portfolio.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('task.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'task.universityId');
    if (!access.owner && access.universityIds !== null) qb.andWhere('student.universityId = task.universityId');
    if (query.visibility === 'published') qb.andWhere('portfolio.published = true');
    if (query.visibility === 'private') qb.andWhere('portfolio.published = false');
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['portfolio.id::text', 'portfolio.studentId::text', 'student.email', 'student.firstName', 'student.lastName', 'task.title', 'company.name', 'portfolio.caseText']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('portfolio.updatedAt', 'DESC').addOrderBy('portfolio.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_portfolio.search', entity: 'personal_data.career_portfolio', entityId: 'search', newValues: { recordIds: rows.map(row => String(row.id)), targetUserIds: [...new Set(rows.map(row => String(row.studentId)))], universityIds: [...new Set(rows.map(row => String(row.universityId)))], ...(query.universityId ? { universityId: query.universityId } : {}), ...(query.visibility ? { visibility: query.visibility } : {}), queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return toPaginatedResponse(rows, total, query);
  }

  async portfolio(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.db.getRepository(CareerPortfolio).createQueryBuilder('portfolio')
      .innerJoin(CareerWork, 'work', 'work.id = portfolio.workId').innerJoin(CareerTask, 'task', 'task.id = work.taskId')
      .innerJoin(CareerCompany, 'company', 'company.id = task.companyId').innerJoin(University, 'university', 'university.id = task.universityId')
      .innerJoin(User, 'student', 'student.id = portfolio.studentId').leftJoin(CareerReview, 'review', 'review.workId = portfolio.workId')
      .select('portfolio.id', 'id').addSelect('portfolio.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('student.universityId', 'studentUniversityId').addSelect('task.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('task.id', 'taskId').addSelect('task.title', 'taskTitle').addSelect('company.name', 'companyName')
      .addSelect('portfolio.caseText', 'caseText').addSelect('portfolio.published', 'published').addSelect('work.submission', 'acceptedResult')
      .addSelect('work.resultUrl', 'resultUrl').addSelect('review.id', 'reviewId').addSelect('review.body', 'reviewBody')
      .addSelect('review.rating', 'reviewRating').addSelect('review.publishAllowed', 'reviewPublishAllowed')
      .addSelect('portfolio.createdAt', 'createdAt').addSelect('portfolio.updatedAt', 'updatedAt')
      .where('portfolio.id = :id', { id }).getRawOne<Record<string, unknown>>();
    if (!row) throw new NotFoundException('Кейс портфолио не найден.');
    this.platform.assertUniversityScope(access, String(row.universityId));
    if (row.studentUniversityId !== row.universityId) throw new BadRequestException('Кейс портфолио связан с пользователем другого университета.');
    const { studentUniversityId: _studentUniversityId, ...visibleRow } = row;
    const auditValues: JsonObject = { targetUserId: String(row.studentId), universityId: String(row.universityId), reviewId: row.reviewId ? String(row.reviewId) : null, result: 'viewed' };
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_portfolio.viewed', entity: 'personal_data.career_portfolio', entityId: id, newValues: auditValues, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return visibleRow;
  }

  async patchPortfolio(id: string, dto: PlatformCareerPortfolioPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    if (dto.caseText === undefined && dto.hide !== true) throw new BadRequestException('Укажите текст кейса или запросите его скрытие.');
    return this.db.transaction(async manager => {
      const item = await manager.findOne(CareerPortfolio, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!item) throw new NotFoundException('Кейс портфолио не найден.');
      const scopeRow = await manager.createQueryBuilder(CareerWork, 'work').innerJoin(CareerTask, 'task', 'task.id = work.taskId')
        .select('task.universityId', 'universityId').addSelect('work.studentId', 'studentId').where('work.id = :workId', { workId: item.workId }).getRawOne<{ universityId: string; studentId: string }>();
      if (!scopeRow || scopeRow.studentId !== item.studentId) throw new BadRequestException('Кейс не связан с пользователем работы и существующей задачей.');
      this.platform.assertUniversityScope(access, scopeRow.universityId);
      const portfolioUser = await manager.getRepository(User).findOne({ where: { id: item.studentId }, select: ['id', 'universityId'] });
      if (!portfolioUser || portfolioUser.universityId !== scopeRow.universityId) throw new BadRequestException('Кейс портфолио связан с пользователем другого университета.');
      const oldValues: JsonObject = { caseText: item.caseText, published: item.published };
      const wasPublished = item.published;
      if (dto.caseText !== undefined) {
        const caseText = dto.caseText.trim();
        if (caseText === item.caseText && dto.hide !== true) throw new ConflictException('Текст кейса не изменился.');
        item.caseText = caseText;
        item.published = false;
      }
      if (dto.hide === true) {
        if (!wasPublished && dto.caseText === undefined) throw new ConflictException('Кейс уже скрыт.');
        item.published = false;
      }
      if (item.caseText === oldValues.caseText && item.published === oldValues.published) throw new ConflictException('Новые значения совпадают с текущими.');
      const updated = await manager.save(CareerPortfolio, item);
      const contextRow = await manager.createQueryBuilder(CareerWork, 'work').innerJoin(CareerTask, 'task', 'task.id = work.taskId').select('task.universityId', 'universityId').where('work.id = :workId', { workId: item.workId }).getRawOne<{ universityId: string }>();
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_portfolio.updated', entity: 'personal_data.career_portfolio', entityId: id, oldValues, newValues: { caseText: updated.caseText, published: updated.published, targetUserId: updated.studentId, universityId: contextRow?.universityId ?? null, adminReason: dto.reason.trim(), result: dto.hide === true ? 'hidden' : 'updated' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, caseText: updated.caseText, published: updated.published, updatedAt: updated.updatedAt };
    });
  }

  async reviews(query: PlatformCareerReviewQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.reviewQuery();
    if (query.universityId) qb.andWhere('task.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'task.universityId');
    if (!access.owner && access.universityIds !== null) qb.andWhere('student.universityId = task.universityId');
    if (query.consent === 'allowed') qb.andWhere('review.publishAllowed = true');
    if (query.consent === 'withheld') qb.andWhere('review.publishAllowed = false');
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['review.id::text', 'review.workId::text', 'work.studentId::text', 'student.email', 'student.firstName', 'student.lastName', 'task.title', 'company.name', 'review.body']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('review.updatedAt', 'DESC').addOrderBy('review.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_review.search', entity: 'personal_data.career_review', entityId: 'search', newValues: { recordIds: rows.map(row => String(row.id)), targetUserIds: [...new Set(rows.map(row => String(row.studentId)))], universityIds: [...new Set(rows.map(row => String(row.universityId)))], ...(query.universityId ? { universityId: query.universityId } : {}), ...(query.consent ? { consent: query.consent } : {}), queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return toPaginatedResponse(rows, total, query);
  }

  async review(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.reviewQuery(true).where('review.id = :id', { id }).getRawOne<Record<string, unknown>>();
    if (!row) throw new NotFoundException('Отзыв не найден.');
    this.platform.assertUniversityScope(access, String(row.universityId));
    if (row.studentUniversityId !== row.universityId) throw new BadRequestException('Отзыв связан с пользователем другого университета.');
    const { studentUniversityId: _studentUniversityId, ...visibleRow } = row;
    const auditValues: JsonObject = { targetUserId: String(row.studentId), universityId: String(row.universityId), result: 'viewed' };
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_review.viewed', entity: 'personal_data.career_review', entityId: id, newValues: auditValues, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return visibleRow;
  }

  async patchReview(id: string, dto: PlatformCareerReviewPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    if (dto.rating === undefined && dto.body === undefined) throw new BadRequestException('Укажите текст или оценку отзыва для исправления.');
    return this.db.transaction(async manager => {
      const review = await manager.findOne(CareerReview, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!review) throw new NotFoundException('Отзыв не найден.');
      const work = await manager.findOne(CareerWork, { where: { id: review.workId }, lock: { mode: 'pessimistic_read' } });
      const task = work ? await manager.findOne(CareerTask, { where: { id: work.taskId }, lock: { mode: 'pessimistic_read' } }) : null;
      if (!work || !task) throw new BadRequestException('Отзыв не связан с существующей работой и задачей.');
      this.platform.assertUniversityScope(access, task.universityId);
      const reviewUser = await manager.getRepository(User).findOne({ where: { id: work.studentId }, select: ['id', 'universityId'] });
      if (!reviewUser || reviewUser.universityId !== task.universityId) throw new BadRequestException('Отзыв связан с пользователем другого университета.');
      const oldValues: JsonObject = { rating: review.rating, body: review.body, publishAllowed: review.publishAllowed };
      if (dto.rating !== undefined) review.rating = dto.rating;
      if (dto.body !== undefined) review.body = dto.body.trim();
      if (review.rating === oldValues.rating && review.body === oldValues.body) throw new ConflictException('Новые значения совпадают с текущими.');
      review.publishAllowed = false;
      const updated = await manager.save(CareerReview, review);
      const portfolio = await manager.findOne(CareerPortfolio, { where: { workId: work.id }, lock: { mode: 'pessimistic_write' } });
      const portfolioHidden = Boolean(portfolio?.published);
      if (portfolioHidden && portfolio) {
        portfolio.published = false;
        const hiddenPortfolio = await manager.save(CareerPortfolio, portfolio);
        await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_portfolio.hidden_by_review_edit', entity: 'personal_data.career_portfolio', entityId: portfolio.id, oldValues: { published: true }, newValues: { published: hiddenPortfolio.published, targetUserId: work.studentId, universityId: task.universityId, relatedReviewId: review.id, adminReason: dto.reason.trim(), result: 'hidden' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      }
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_review.updated', entity: 'personal_data.career_review', entityId: id, oldValues, newValues: { rating: updated.rating, body: updated.body, publishAllowed: updated.publishAllowed, portfolioHidden, targetUserId: work.studentId, universityId: task.universityId, adminReason: dto.reason.trim(), result: 'updated' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, rating: updated.rating, body: updated.body, publishAllowed: updated.publishAllowed, updatedAt: updated.updatedAt };
    });
  }

  async notices(query: PlatformCareerNoticeQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerNotice).createQueryBuilder('notice').innerJoin(User, 'user', 'user.id = notice.userId').leftJoin(University, 'university', 'university.id = user.universityId')
      .select('notice.id', 'id').addSelect('notice.userId', 'userId').addSelect("concat_ws(' ', user.firstName, user.lastName)", 'userName').addSelect('user.email', 'email')
      .addSelect('user.universityId', 'universityId').addSelect('university.name', 'universityName').addSelect('notice.title', 'title')
      .addSelect('LEFT(notice.body, 220)', 'bodyPreview').addSelect('notice.isRead', 'isRead').addSelect('notice.createdAt', 'createdAt').addSelect('notice.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('user.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'user.universityId');
    if (!access.owner && access.universityIds !== null) qb.andWhere('user.universityId IS NOT NULL');
    if (query.readState === 'read') qb.andWhere('notice.isRead = true');
    if (query.readState === 'unread') qb.andWhere('notice.isRead = false');
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['notice.id::text', 'notice.userId::text', 'user.email', 'user.firstName', 'user.lastName', 'notice.title', 'notice.body']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('notice.createdAt', 'DESC').addOrderBy('notice.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_notice.search', entity: 'personal_data.career_notice', entityId: 'search', newValues: { recordIds: rows.map(row => String(row.id)), targetUserIds: [...new Set(rows.map(row => String(row.userId)))], ...(query.universityId ? { universityId: query.universityId } : {}), ...(query.readState ? { readState: query.readState } : {}), queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return toPaginatedResponse(rows, total, query);
  }

  async notice(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.db.getRepository(CareerNotice).createQueryBuilder('notice').innerJoin(User, 'user', 'user.id = notice.userId').leftJoin(University, 'university', 'university.id = user.universityId')
      .select('notice.id', 'id').addSelect('notice.userId', 'userId').addSelect("concat_ws(' ', user.firstName, user.lastName)", 'userName').addSelect('user.email', 'email')
      .addSelect('user.universityId', 'universityId').addSelect('university.name', 'universityName').addSelect('notice.title', 'title').addSelect('notice.body', 'body')
      .addSelect('notice.isRead', 'isRead').addSelect('notice.createdAt', 'createdAt').addSelect('notice.updatedAt', 'updatedAt').where('notice.id = :id', { id }).getRawOne<Record<string, unknown>>();
    if (!row) throw new NotFoundException('Карьерное уведомление не найдено.');
    this.platform.assertUniversityScope(access, row.universityId ? String(row.universityId) : null);
    const auditValues: JsonObject = { targetUserId: String(row.userId), universityId: row.universityId ? String(row.universityId) : null, result: 'viewed' };
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_notice.viewed', entity: 'personal_data.career_notice', entityId: id, newValues: auditValues, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return row;
  }

  async patchNotice(id: string, dto: PlatformCareerNoticePatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    if (dto.title === undefined && dto.body === undefined && dto.isRead === undefined) throw new BadRequestException('Укажите поля уведомления для изменения.');
    return this.db.transaction(async manager => {
      const notice = await manager.findOne(CareerNotice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!notice) throw new NotFoundException('Карьерное уведомление не найдено.');
      const user = await manager.findOne(User, { where: { id: notice.userId }, select: ['id', 'universityId'] });
      if (!user) throw new BadRequestException('Уведомление не связано с существующим пользователем.');
      this.platform.assertUniversityScope(access, user.universityId);
      const oldValues: JsonObject = { title: notice.title, body: notice.body, isRead: notice.isRead };
      if (dto.title !== undefined) notice.title = dto.title.trim();
      if (dto.body !== undefined) notice.body = dto.body.trim();
      if (dto.isRead !== undefined) notice.isRead = dto.isRead;
      if (!notice.title || JSON.stringify(oldValues) === JSON.stringify({ title: notice.title, body: notice.body, isRead: notice.isRead })) throw new ConflictException('Новые значения совпадают с текущими или заголовок пуст.');
      const updated = await manager.save(CareerNotice, notice);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_notice.updated', entity: 'personal_data.career_notice', entityId: id, oldValues, newValues: { title: updated.title, body: updated.body, isRead: updated.isRead, targetUserId: user.id, universityId: user.universityId, adminReason: dto.reason.trim(), result: 'updated' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, title: updated.title, body: updated.body, isRead: updated.isRead, updatedAt: updated.updatedAt };
    });
  }

  async availabilities(query: PlatformCareerAvailabilityQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerAvailability).createQueryBuilder('availability')
      .innerJoin(User, 'student', 'student.id = availability.studentId')
      .innerJoin(University, 'university', 'university.id = availability.universityId')
      .select('availability.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('student.role', 'role')
      .addSelect('availability.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('availability.weeklyHours', 'weeklyHours').addSelect('availability.timeZone', 'timeZone')
      .addSelect('jsonb_array_length(availability.windows)', 'windowCount').addSelect('jsonb_array_length(availability."blockedDates")', 'blockedDateCount')
      .addSelect('availability.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('availability.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'availability.universityId');
    if (!access.owner && access.universityIds !== null) qb.andWhere('student.universityId = availability.universityId');
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['availability.studentId::text', 'student.email', 'student.firstName', 'student.lastName', 'student.role', 'availability.universityId::text', 'university.name']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('availability.updatedAt', 'DESC').addOrderBy('availability.studentId', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_availability.search', entity: 'personal_data.career_availability', entityId: 'search', newValues: { recordIds: rows.map(row => String(row.studentId)), targetUserIds: rows.map(row => String(row.studentId)), universityIds: [...new Set(rows.map(row => String(row.universityId)))], ...(query.universityId ? { universityId: query.universityId } : {}), queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return toPaginatedResponse(rows.map(row => ({ ...row, weeklyHours: Number(row.weeklyHours), windowCount: Number(row.windowCount), blockedDateCount: Number(row.blockedDateCount) })), total, query);
  }

  async availability(studentId: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.db.getRepository(CareerAvailability).createQueryBuilder('availability')
      .innerJoin(User, 'student', 'student.id = availability.studentId')
      .innerJoin(University, 'university', 'university.id = availability.universityId')
      .select('availability.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('student.role', 'role')
      .addSelect('availability.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('availability.weeklyHours', 'weeklyHours').addSelect('availability.timeZone', 'timeZone')
      .addSelect('availability.windows', 'windows').addSelect('availability."blockedDates"', 'blockedDates')
      .addSelect('student.universityId', 'studentUniversityId').addSelect('availability.updatedAt', 'updatedAt').where('availability.studentId = :studentId', { studentId }).getRawOne<Record<string, unknown>>();
    if (!row) throw new NotFoundException('Настройки планирования не найдены.');
    this.platform.assertUniversityScope(access, String(row.universityId));
    if (row.studentUniversityId !== row.universityId) throw new BadRequestException('Настройки связаны с пользователем другого университета.');
    const { studentUniversityId: _studentUniversityId, ...visibleRow } = row;
    const auditValues: JsonObject = { targetUserId: String(row.studentId), universityId: String(row.universityId), result: 'viewed' };
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: access.actorId, action: 'platform.career_availability.viewed', entity: 'personal_data.career_availability', entityId: studentId, newValues: auditValues, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
    return visibleRow;
  }

  async patchAvailability(studentId: string, dto: PlatformCareerAvailabilityPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    validateAvailability(dto);
    return this.db.transaction(async manager => {
      const availability = await manager.findOne(CareerAvailability, { where: { studentId }, lock: { mode: 'pessimistic_write' } });
      if (!availability) throw new NotFoundException('Настройки планирования не найдены.');
      const [user, university] = await Promise.all([
        manager.getRepository(User).findOne({ where: { id: studentId }, select: ['id', 'role', 'universityId'] }),
        manager.getRepository(University).findOneBy({ id: availability.universityId }),
      ]);
      if (!user || user.universityId !== availability.universityId || !university) throw new BadRequestException('Настройки не связаны с пользователем этого университета.');
      this.platform.assertUniversityScope(access, availability.universityId);
      const fields = ['weeklyHours', 'timeZone', 'windows', 'blockedDates'] as const;
      const oldValues = this.snapshot(availability, fields);
      availability.weeklyHours = dto.weeklyHours;
      availability.timeZone = dto.timeZone.trim();
      availability.windows = dto.windows.map(window => ({ ...window }));
      availability.blockedDates = dto.blockedDates.map(range => ({ ...range }));
      if (JSON.stringify(oldValues) === JSON.stringify(this.snapshot(availability, fields))) throw new ConflictException('Новые значения совпадают с текущими.');
      const updated = await manager.save(CareerAvailability, availability);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_availability.updated', entity: 'personal_data.career_availability', entityId: studentId, oldValues, newValues: { ...this.snapshot(updated, fields), targetUserId: studentId, universityId: availability.universityId, currentRole: user.role, adminReason: dto.reason.trim(), result: 'updated' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { studentId, ...this.snapshot(updated, fields), updatedAt: updated.updatedAt };
    });
  }

  async company(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertGlobalCareerAccess(access);
    const company = await this.db.getRepository(CareerCompany).createQueryBuilder('company')
      .select('company.id', 'id').addSelect('company.name', 'name').addSelect('company.description', 'description')
      .addSelect('company.createdBy', 'createdBy').addSelect('company.createdAt', 'createdAt').addSelect('company.updatedAt', 'updatedAt')
      .where('company.id = :id', { id }).getRawOne<Record<string, unknown>>();
    if (!company) throw new NotFoundException('Компания не найдена.');
    const partnerships = await this.db.getRepository(CareerPartnership).createQueryBuilder('partnership')
      .innerJoin(University, 'university', 'university.id = partnership.universityId')
      .select('partnership.id', 'id').addSelect('partnership.universityId', 'universityId')
      .addSelect('university.name', 'universityName').addSelect('partnership.state', 'state')
      .addSelect('partnership.createdAt', 'createdAt').addSelect('partnership.updatedAt', 'updatedAt')
      .where('partnership.companyId = :id', { id }).orderBy('partnership.createdAt', 'DESC').getRawMany();
    await this.auditCatalogRead('career_company', 'viewed', access.actorId, [id], undefined, undefined, context);
    return { ...company, partnerships };
  }

  async patchCompany(id: string, dto: PlatformCareerCompanyPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertGlobalCareerAccess(access);
    this.assertReason(dto.reason);
    if (dto.name === undefined && dto.description === undefined) throw new BadRequestException('Укажите название или описание для исправления.');
    return this.db.transaction(async manager => {
      const company = await manager.findOne(CareerCompany, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!company) throw new NotFoundException('Компания не найдена.');
      const oldValues: JsonObject = { name: company.name, description: company.description };
      if (dto.name !== undefined) { const name = dto.name.trim(); if (name.length < 2) throw new BadRequestException('Название должно содержать не менее двух символов.'); company.name = name; }
      if (dto.description !== undefined) company.description = dto.description.trim();
      if (company.name === oldValues.name && company.description === oldValues.description) throw new ConflictException('Новые данные совпадают с текущими.');
      const updated = await manager.save(CareerCompany, company);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_company.updated', entity: 'personal_data.career_company', entityId: id, oldValues, newValues: { name: updated.name, description: updated.description, createdBy: updated.createdBy, adminReason: dto.reason.trim(), result: 'updated' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, name: updated.name, description: updated.description, createdBy: updated.createdBy, updatedAt: updated.updatedAt };
    });
  }

  async partnerships(query: PlatformCareerPartnershipQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerPartnership).createQueryBuilder('partnership')
      .innerJoin(CareerCompany, 'company', 'company.id = partnership.companyId')
      .innerJoin(University, 'university', 'university.id = partnership.universityId')
      .select('partnership.id', 'id').addSelect('partnership.companyId', 'companyId').addSelect('company.name', 'companyName')
      .addSelect('partnership.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('partnership.state', 'state').addSelect('partnership.createdAt', 'createdAt').addSelect('partnership.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('partnership.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'partnership.universityId');
    if (query.state) qb.andWhere('partnership.state = :state', { state: query.state });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['partnership.id::text', 'partnership.companyId::text', 'partnership.universityId::text', 'company.name', 'university.name']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('partnership.updatedAt', 'DESC').addOrderBy('partnership.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.auditCatalogRead('career_partnership', 'search', access.actorId, rows.map(row => String(row.id)), query, total, context);
    return toPaginatedResponse(rows, total, query);
  }

  async partnership(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.partnershipQuery().where('partnership.id = :id', { id }).getRawOne<Record<string, unknown>>();
    if (!row) throw new NotFoundException('Партнёрство не найдено.');
    this.platform.assertUniversityScope(access, String(row.universityId));
    await this.auditCatalogRead('career_partnership', 'viewed', access.actorId, [id], undefined, undefined, context, String(row.universityId));
    return row;
  }

  async decidePartnership(id: string, dto: PlatformCareerPartnershipDecisionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const partnership = await manager.findOne(CareerPartnership, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!partnership) throw new NotFoundException('Партнёрство не найдено.');
      this.platform.assertUniversityScope(access, partnership.universityId);
      if (partnership.state !== 'pending') throw new ConflictException('Решение доступно только для заявки, ожидающей проверки.');
      const [company, university] = await Promise.all([
        manager.getRepository(CareerCompany).findOneBy({ id: partnership.companyId }),
        manager.getRepository(University).findOneBy({ id: partnership.universityId }),
      ]);
      if (!company || !university) throw new BadRequestException('Партнёрство не связано с существующей компанией и университетом.');
      if (company.createdBy === access.actorId || await manager.getRepository(CareerMembership).createQueryBuilder('membership').where('membership."userId" = :actorId AND membership."companyId" = :companyId AND membership."revokedAt" IS NULL', { actorId: access.actorId, companyId: company.id }).getExists()) throw new ForbiddenException('Создатель и действующий участник компании не могут проверять её партнёрство.');
      const oldState = partnership.state;
      partnership.state = dto.decision;
      const updated = await manager.save(CareerPartnership, partnership);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: `platform.career_partnership.${dto.decision}`, entity: 'personal_data.career_partnership', entityId: id, oldValues: { state: oldState, companyId: company.id, universityId: university.id }, newValues: { state: updated.state, companyId: company.id, universityId: university.id, adminReason: dto.reason.trim(), result: dto.decision }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, state: updated.state, updatedAt: updated.updatedAt };
    });
  }

  async tasks(query: PlatformCareerTaskQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.taskQuery();
    if (query.universityId) qb.andWhere('task.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'task.universityId');
    if (query.state) qb.andWhere('task.state = :state', { state: query.state });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['task.id::text', 'task.title', 'task.description', 'task.criteria', 'task.skill', 'company.name', 'university.name']);
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('task.updatedAt', 'DESC').addOrderBy('task.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany<Record<string, unknown>>();
    await this.auditCatalogRead('career_task', 'search', access.actorId, rows.map(row => String(row.id)), query, total, context);
    return toPaginatedResponse(rows, total, query);
  }

  async task(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const row = await this.taskQuery(true).where('task.id = :id', { id }).getRawOne<Record<string, unknown>>();
    if (!row) throw new NotFoundException('Карьерная задача не найдена.');
    this.platform.assertUniversityScope(access, String(row.universityId));
    const [applicationCount, workCount] = await Promise.all([
      this.db.getRepository(CareerApplication).countBy({ taskId: id }),
      this.db.getRepository(CareerWork).countBy({ taskId: id }),
    ]);
    await this.auditCatalogRead('career_task', 'viewed', access.actorId, [id], undefined, undefined, context, String(row.universityId));
    return { ...row, canEdit: row.state === 'draft' && applicationCount === 0 && workCount === 0 };
  }

  async patchTask(id: string, dto: PlatformCareerTaskPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    const changes = ['title', 'description', 'criteria', 'rewardKopecks', 'hours', 'deadline', 'profiled', 'skill', 'level', 'requirements'] as const;
    if (!changes.some(field => dto[field] !== undefined)) throw new BadRequestException('Укажите хотя бы одно поле задачи для изменения.');
    return this.db.transaction(async manager => {
      const task = await manager.findOne(CareerTask, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!task) throw new NotFoundException('Карьерная задача не найдена.');
      this.platform.assertUniversityScope(access, task.universityId);
      if (task.state !== 'draft') throw new ConflictException('Редактировать можно только черновик карьерной задачи.');
      if (await manager.getRepository(CareerApplication).existsBy({ taskId: id }) || await manager.getRepository(CareerWork).existsBy({ taskId: id })) throw new ConflictException('Задачу нельзя исправить: к ней уже привязаны отклики или работы.');
      const [company, university, partnership] = await Promise.all([
        manager.getRepository(CareerCompany).findOneBy({ id: task.companyId }),
        manager.getRepository(University).findOneBy({ id: task.universityId }),
        manager.getRepository(CareerPartnership).findOneBy({ companyId: task.companyId, universityId: task.universityId }),
      ]);
      if (!company || !university || partnership?.state !== 'verified') throw new BadRequestException('Задача не связана с действующей компанией, университетом и подтверждённым партнёрством.');
      const oldValues = this.snapshot(task, changes);
      if (dto.title !== undefined) task.title = dto.title.trim();
      if (dto.description !== undefined) task.description = dto.description.trim();
      if (dto.criteria !== undefined) task.criteria = dto.criteria.trim();
      if (dto.rewardKopecks !== undefined) task.rewardKopecks = dto.rewardKopecks;
      if (dto.hours !== undefined) task.hours = dto.hours;
      if (dto.deadline !== undefined) task.deadline = dto.deadline;
      if (dto.profiled !== undefined) task.profiled = dto.profiled;
      if (dto.skill !== undefined) task.skill = dto.skill.trim().toLowerCase();
      if (dto.level !== undefined) task.level = dto.level;
      if (dto.requirements !== undefined) task.requirements = dto.requirements.trim();
      const today = new Date().toISOString().slice(0, 10);
      const deadlineTime = Date.parse(`${task.deadline}T00:00:00.000Z`);
      if (!task.title || task.title.length < 5 || task.title.length > 180 || task.description.length < 20 || task.description.length > 10000 || task.criteria.length < 10 || task.criteria.length > 4000 || task.rewardKopecks < 100 || task.rewardKopecks > 100000000 || task.hours < 1 || task.hours > 500 || !Number.isFinite(deadlineTime) || new Date(deadlineTime).toISOString().slice(0, 10) !== task.deadline || task.deadline < today || task.profiled && !task.skill.trim() || !['starter', 'standard', 'advanced'].includes(task.level)) throw new BadRequestException('Проверьте название, описание, критерии, оплату, часы, дату и профильные требования задачи.');
      const updated = await manager.save(CareerTask, task);
      await manager.save(AuditLog, manager.create(AuditLog, { userId: access.actorId, action: 'platform.career_task.updated', entity: 'personal_data.career_task', entityId: id, oldValues, newValues: { ...this.snapshot(updated, changes), companyId: updated.companyId, universityId: updated.universityId, adminReason: dto.reason.trim(), result: 'updated' }, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
      return { id, ...this.snapshot(updated, changes), companyId: updated.companyId, universityId: updated.universityId, updatedAt: updated.updatedAt };
    });
  }

  async profiles(query: PlatformCareerProfileQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerProfile).createQueryBuilder('profile')
      .leftJoin(User, 'student', 'student.id = profile.studentId')
      .innerJoin(University, 'university', 'university.id = profile.universityId')
      .select('profile.id', 'id').addSelect('profile.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('profile.universityId', 'universityId')
      .addSelect('university.name', 'universityName').addSelect('profile.headline', 'headline')
      .addSelect('profile.skills', 'skills')
      .addSelect('profile.verification', 'verification').addSelect('profile.createdAt', 'createdAt')
      .addSelect('profile.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('profile.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'profile.universityId');
    if (!access.owner && access.universityIds !== null) qb.andWhere('student.universityId = profile.universityId');
    if (query.verification) qb.andWhere('profile.verification = :verification', { verification: query.verification });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['profile.id::text', 'profile.studentId::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'profile.headline', 'profile.about', 'profile.skills::text']);
    const [data, total] = await this.paginate<CareerProfile, ProfileRow>(qb, query.page, query.limit, 'profile.updatedAt', 'profile.id');
    await this.auditRead('career_profile', access.actorId, data, query, total, context);
    return toPaginatedResponse(data, total, query);
  }

  async admissions(query: PlatformCareerAdmissionQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    this.assertCareerQueryUniversity(access, query.universityId);
    const qb = this.db.getRepository(CareerAdmission).createQueryBuilder('admission')
      .leftJoin(User, 'student', 'student.id = admission.studentId')
      .innerJoin(University, 'university', 'university.id = admission.universityId')
      .select('admission.id', 'id').addSelect('admission.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('admission.universityId', 'universityId')
      .addSelect('university.name', 'universityName').addSelect('admission.skill', 'skill')
      .addSelect('admission.state', 'state').addSelect('admission.basis', 'basis')
      .addSelect('admission.createdAt', 'createdAt').addSelect('admission.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('admission.universityId = :universityId', { universityId: query.universityId });
    this.applyCareerUniversityScope(qb, access, 'admission.universityId');
    if (!access.owner && access.universityIds !== null) qb.andWhere('student.universityId = admission.universityId');
    if (query.state) qb.andWhere('admission.state = :state', { state: query.state });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['admission.id::text', 'admission.studentId::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'admission.skill', 'admission.evidence', 'admission.reason']);
    const [data, total] = await this.paginate<CareerAdmission, AdmissionRow>(qb, query.page, query.limit, 'admission.updatedAt', 'admission.id');
    await this.auditRead('career_admission', access.actorId, data, query, total, context);
    return toPaginatedResponse(data, total, query);
  }

  async profile(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const profile = await this.db.getRepository(CareerProfile).createQueryBuilder('profile')
      .leftJoin(User, 'student', 'student.id = profile.studentId')
      .innerJoin(University, 'university', 'university.id = profile.universityId')
      .select('profile.id', 'id').addSelect('profile.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName').addSelect('student.email', 'studentEmail')
      .addSelect('student.universityId', 'studentUniversityId')
      .addSelect('profile.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('profile.headline', 'headline').addSelect('profile.about', 'about').addSelect('profile.skills', 'skills')
      .addSelect('profile.verification', 'verification').addSelect('profile.createdAt', 'createdAt').addSelect('profile.updatedAt', 'updatedAt')
      .where('profile.id = :id', { id }).getRawOne<ProfileRow>();
    if (!profile) throw new NotFoundException('Карьерный профиль не найден.');
    this.platform.assertUniversityScope(access, profile.universityId);
    if (profile.studentUniversityId !== profile.universityId) throw new BadRequestException('Карьерный профиль связан с пользователем другого университета.');
    const { studentUniversityId: _studentUniversityId, ...visibleProfile } = profile;
    await this.auditDetailRead('career_profile', access.actorId, profile.id, profile.studentId, profile.universityId, context);
    return visibleProfile;
  }

  async admission(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const admission = await this.db.getRepository(CareerAdmission).createQueryBuilder('admission')
      .leftJoin(User, 'student', 'student.id = admission.studentId')
      .innerJoin(University, 'university', 'university.id = admission.universityId')
      .select('admission.id', 'id').addSelect('admission.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName').addSelect('student.email', 'studentEmail')
      .addSelect('student.universityId', 'studentUniversityId').addSelect('admission.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('admission.skill', 'skill').addSelect('admission.evidence', 'evidence').addSelect('admission.state', 'state')
      .addSelect('admission.reason', 'reason').addSelect('admission.basis', 'basis')
      .addSelect('admission.createdAt', 'createdAt').addSelect('admission.updatedAt', 'updatedAt')
      .where('admission.id = :id', { id }).getRawOne<AdmissionRow>();
    if (!admission) throw new NotFoundException('Заявка на допуск не найдена.');
    this.platform.assertUniversityScope(access, admission.universityId);
    if (admission.studentUniversityId !== admission.universityId) throw new BadRequestException('Заявка связана с пользователем другого университета.');
    const { studentUniversityId: _studentUniversityId, ...visibleAdmission } = admission;
    await this.auditDetailRead('career_admission', access.actorId, admission.id, admission.studentId, admission.universityId, context);
    return visibleAdmission;
  }

  async patchProfile(id: string, dto: PlatformCareerProfilePatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    const patch = this.pick(dto, ['headline', 'about', 'skills'] as const);
    if (!Object.keys(patch).length) throw new BadRequestException('Укажите поля профиля для исправления.');
    if (patch.headline !== undefined) patch.headline = String(patch.headline).trim();
    if (patch.about !== undefined) patch.about = String(patch.about).trim();
    if (patch.skills !== undefined) {
      const skills = (patch.skills as string[]).map(skill => skill.trim().normalize('NFKC')).filter(Boolean);
      if (skills.length > 20 || new Set(skills.map(skill => skill.toLocaleLowerCase('ru-RU'))).size !== skills.length) throw new BadRequestException('Направления должны быть непустыми и не повторяться.');
      patch.skills = skills;
    }
    if (patch.headline !== undefined && !patch.headline) throw new BadRequestException('Заголовок профиля не может быть пустым.');
    return this.db.transaction(async manager => {
      const profile = await manager.findOne(CareerProfile, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!profile) throw new NotFoundException('Карьерный профиль не найден.');
      this.platform.assertUniversityScope(access, profile.universityId);
      await this.assertStudent(manager, profile.studentId, profile.universityId);
      const oldValues = this.snapshot(profile, Object.keys(patch));
      const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) => JSON.stringify((profile as unknown as Record<string, unknown>)[key]) !== JSON.stringify(value)));
      if (!Object.keys(changes).length) throw new BadRequestException('Новые значения совпадают с текущими.');
      Object.assign(profile, changes, { verification: 'pending' });
      const updated = await manager.save(CareerProfile, profile);
      await this.audit(manager, access.actorId, 'career_profile', id, { ...oldValues, ...this.snapshot(profile, ['verification']) }, { ...this.snapshot(updated, [...Object.keys(changes), 'verification']), adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  async decideProfile(id: string, dto: PlatformCareerDecisionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const profile = await manager.findOne(CareerProfile, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!profile) throw new NotFoundException('Карьерный профиль не найден.');
      this.platform.assertUniversityScope(access, profile.universityId);
      await this.assertStudent(manager, profile.studentId, profile.universityId);
      const verification = dto.decision === 'approved' ? 'verified' : 'rejected';
      if (profile.verification === verification) throw new ConflictException('Профиль уже имеет это решение.');
      const oldValues = this.snapshot(profile, ['verification']);
      profile.verification = verification;
      const updated = await manager.save(CareerProfile, profile);
      await this.audit(manager, access.actorId, 'career_profile', id, oldValues, { verification, decision: dto.decision, adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  async patchAdmission(id: string, dto: PlatformCareerAdmissionPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    const patch = this.pick(dto, ['skill', 'evidence'] as const);
    if (!Object.keys(patch).length) throw new BadRequestException('Укажите поля заявки для исправления.');
    if (patch.skill !== undefined) patch.skill = String(patch.skill).trim().toLocaleLowerCase('ru-RU');
    if (patch.evidence !== undefined) patch.evidence = String(patch.evidence).trim();
    if (patch.skill !== undefined && !patch.skill) throw new BadRequestException('Направление не может быть пустым.');
    if (patch.evidence !== undefined && !patch.evidence) throw new BadRequestException('Обоснование не может быть пустым.');
    return this.db.transaction(async manager => {
      const admission = await manager.findOne(CareerAdmission, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!admission) throw new NotFoundException('Заявка на допуск не найдена.');
      this.platform.assertUniversityScope(access, admission.universityId);
      await this.assertStudent(manager, admission.studentId, admission.universityId);
      if (patch.skill !== undefined && patch.skill !== admission.skill && await manager.getRepository(CareerAdmission).existsBy({ studentId: admission.studentId, skill: String(patch.skill) })) throw new ConflictException('У студента уже есть заявка по этому направлению.');
      const oldValues = { ...this.snapshot(admission, Object.keys(patch)), ...this.snapshot(admission, ['state', 'basis', 'reason']) };
      const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) => (admission as unknown as Record<string, unknown>)[key] !== value));
      if (!Object.keys(changes).length) throw new BadRequestException('Новые значения совпадают с текущими.');
      Object.assign(admission, changes, { state: 'pending', basis: 'unspecified', reason: '' });
      const updated = await manager.save(CareerAdmission, admission);
      await this.audit(manager, access.actorId, 'career_admission', id, oldValues, { ...this.snapshot(updated, [...Object.keys(changes), 'state', 'basis', 'reason']), adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  async decideAdmission(id: string, dto: PlatformCareerDecisionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const admission = await manager.findOne(CareerAdmission, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!admission) throw new NotFoundException('Заявка на допуск не найдена.');
      this.platform.assertUniversityScope(access, admission.universityId);
      await this.assertStudent(manager, admission.studentId, admission.universityId);
      const state = dto.decision;
      if (admission.state === state && admission.reason === dto.reason.trim()) throw new ConflictException('Заявка уже сохранена с таким решением и причиной.');
      const oldValues = this.snapshot(admission, ['state', 'basis', 'reason']);
      admission.state = state;
      admission.basis = state === 'approved' ? 'center' : 'unspecified';
      admission.reason = dto.reason.trim();
      const updated = await manager.save(CareerAdmission, admission);
      await this.audit(manager, access.actorId, 'career_admission', id, oldValues, { state, basis: updated.basis, reason: updated.reason, adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  private async assertStudent(manager: EntityManager, studentId: string, universityId: string): Promise<void> {
    const user = await manager.findOne(User, { where: { id: studentId }, select: ['id', 'universityId'] });
    if (!user || user.universityId !== universityId || !await manager.getRepository(University).existsBy({ id: universityId })) throw new BadRequestException('Карьерная запись не связана с пользователем этого университета.');
  }

  private assertGlobalCareerAccess(access: Awaited<ReturnType<PlatformService['access']>>): void {
    if (!access.owner && access.universityIds !== null) throw new ForbiddenException('Управление компаниями и company memberships доступно только владельцу или глобальному разрешению.');
  }

  private assertCareerQueryUniversity(access: Awaited<ReturnType<PlatformService['access']>>, universityId?: string): void {
    if (universityId) this.platform.assertUniversityScope(access, universityId);
  }

  private applyCareerUniversityScope<T extends CareerProfile | CareerAdmission | CareerAvailability | CareerPartnership | CareerPortfolio | CareerReview | CareerNotice | CareerTask | CareerTest | CareerTestAttempt>(qb: SelectQueryBuilder<T>, access: Awaited<ReturnType<PlatformService['access']>>, universityColumn: string): void {
    if (access.owner || access.universityIds === null) return;
    if (!access.universityIds.length) qb.andWhere('1 = 0');
    else qb.andWhere(`${universityColumn} IN (:...careerAllowedUniversityIds)`, { careerAllowedUniversityIds: access.universityIds });
  }

  private applySearch<T extends CareerProfile | CareerAdmission | CareerAvailability | CareerCompany | CareerMembership | CareerPartnership | CareerPortfolio | CareerReview | CareerNotice | CareerTask | CareerTest | CareerTestAttempt>(qb: SelectQueryBuilder<T>, query: string, fields: string[]): void {
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    qb.andWhere(`(${fields.map(field => `${field} ILIKE :q ESCAPE E'\\\\'`).join(' OR ')})`, { q: pattern });
  }

  private async paginate<T extends CareerProfile | CareerAdmission, R>(qb: SelectQueryBuilder<T>, page: number, limit: number, orderField: string, idField: string): Promise<[R[], number]> {
    const total = await qb.clone().getCount();
    const data = await qb.orderBy(orderField, 'DESC').addOrderBy(idField, 'DESC').skip((page - 1) * limit).take(limit).getRawMany<R>();
    return [data, total];
  }

  private pick<T extends string>(source: object, fields: readonly T[]): Partial<Record<T, unknown>> {
    const values = source as Record<string, unknown>;
    return Object.fromEntries(fields.filter(field => values[field] !== undefined).map(field => [field, values[field]])) as Partial<Record<T, unknown>>;
  }

  private snapshot<T extends object>(record: T, fields: readonly string[]): JsonObject {
    const source = record as Record<string, unknown>;
    return Object.fromEntries(fields.map(field => [field, source[field] ?? null])) as JsonObject;
  }

  private assertReason(reason: string): void {
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину изменения (не менее 3 символов).');
  }

  private async auditRead<T extends { id: string; universityId: string }>(entity: string, actorId: string, rows: T[], query: PlatformCareerProfileQueryDto | PlatformCareerAdmissionQueryDto, total: number, context: RequestAuditContext): Promise<void> {
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({
      userId: actorId,
      action: `platform.${entity}.search`,
      entity: `personal_data.${entity}`,
      entityId: 'search',
      newValues: {
        recordIds: rows.map(row => row.id),
        universityIds: [...new Set(rows.map(row => row.universityId))],
        ...(query.universityId ? { universityId: query.universityId } : {}),
        page: query.page,
        limit: query.limit,
        resultCount: rows.length,
        total,
      },
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private async auditDetailRead(entity: string, actorId: string, id: string, targetUserId: string, universityId: string, context: RequestAuditContext): Promise<void> {
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({
      userId: actorId,
      action: `platform.${entity}.viewed`,
      entity: `personal_data.${entity}`,
      entityId: id,
      newValues: { targetUserId, universityId, result: 'viewed' },
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private async auditCatalogRead(entity: 'career_company' | 'career_partnership' | 'career_task', operation: 'search' | 'viewed', actorId: string, recordIds: string[], query: PlatformQueryDto | undefined, total: number | undefined, context: RequestAuditContext, universityId?: string): Promise<void> {
    const values: JsonObject = operation === 'search'
      ? { recordIds, ...(query?.universityId ? { universityId: query.universityId } : {}), ...(universityId ? { universityId } : {}), ...(query && 'state' in query && query.state ? { state: String(query.state) } : {}), ...(query && 'partnershipState' in query && query.partnershipState ? { partnershipState: String(query.partnershipState) } : {}), queryEntered: Boolean(query?.q?.trim()), page: query?.page ?? 1, limit: query?.limit ?? 20, resultCount: recordIds.length, total: total ?? 0 }
      : { recordIds, ...(universityId ? { universityId } : {}), result: 'viewed' };
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({ userId: actorId, action: `platform.${entity}.${operation}`, entity: `personal_data.${entity}`, entityId: operation === 'search' ? 'search' : recordIds[0], newValues: values, ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}) }));
  }

  private taskQuery(includeDetails = false): SelectQueryBuilder<CareerTask> {
    const qb = this.db.getRepository(CareerTask).createQueryBuilder('task')
      .innerJoin(CareerCompany, 'company', 'company.id = task.companyId')
      .innerJoin(University, 'university', 'university.id = task.universityId')
      .select('task.id', 'id').addSelect('task.companyId', 'companyId').addSelect('company.name', 'companyName')
      .addSelect('task.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('task.title', 'title').addSelect('task.state', 'state').addSelect('task.rewardKopecks', 'rewardKopecks')
      .addSelect('task.hours', 'hours').addSelect('task.deadline', 'deadline').addSelect('task.profiled', 'profiled')
      .addSelect('task.skill', 'skill').addSelect('task.level', 'level').addSelect('task.updatedAt', 'updatedAt');
    if (includeDetails) qb.addSelect('task.description', 'description').addSelect('task.criteria', 'criteria').addSelect('task.requirements', 'requirements');
    else qb.addSelect('LEFT(task.description, 220)', 'descriptionPreview').addSelect('LEFT(task.criteria, 180)', 'criteriaPreview');
    return qb;
  }

  private partnershipQuery(): SelectQueryBuilder<CareerPartnership> {
    return this.db.getRepository(CareerPartnership).createQueryBuilder('partnership')
      .innerJoin(CareerCompany, 'company', 'company.id = partnership.companyId')
      .innerJoin(University, 'university', 'university.id = partnership.universityId')
      .select('partnership.id', 'id').addSelect('partnership.companyId', 'companyId').addSelect('company.name', 'companyName')
      .addSelect('partnership.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('partnership.state', 'state').addSelect('partnership.createdAt', 'createdAt').addSelect('partnership.updatedAt', 'updatedAt');
  }

  private reviewQuery(includeDetails = false): SelectQueryBuilder<CareerReview> {
    const qb = this.db.getRepository(CareerReview).createQueryBuilder('review')
      .innerJoin(CareerWork, 'work', 'work.id = review.workId')
      .innerJoin(CareerTask, 'task', 'task.id = work.taskId')
      .innerJoin(CareerCompany, 'company', 'company.id = task.companyId')
      .innerJoin(University, 'university', 'university.id = task.universityId')
      .innerJoin(User, 'student', 'student.id = work.studentId')
      .leftJoin(CareerPortfolio, 'portfolio', 'portfolio.workId = work.id')
      .select('review.id', 'id').addSelect('review.workId', 'workId').addSelect('work.id', 'careerWorkId')
      .addSelect('work.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('task.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('task.title', 'taskTitle').addSelect('company.name', 'companyName').addSelect('review.rating', 'rating')
      .addSelect('LEFT(review.body, 220)', 'bodyPreview').addSelect('review.publishAllowed', 'publishAllowed')
      .addSelect('portfolio.id', 'portfolioId').addSelect('portfolio.published', 'portfolioPublished')
      .addSelect('review.createdAt', 'createdAt').addSelect('review.updatedAt', 'updatedAt');
    if (includeDetails) qb.addSelect('review.body', 'body').addSelect('student.universityId', 'studentUniversityId');
    return qb;
  }

  private async audit(manager: EntityManager, actorId: string, entity: string, id: string, oldValues: JsonObject, newValues: JsonObject, targetUserId: string, universityId: string, context: RequestAuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId,
      action: `platform.${entity}.${newValues.result === 'created' ? 'created' : newValues.result === 'deleted' ? 'deleted' : 'updated'}`,
      entity: `personal_data.${entity}`,
      entityId: id,
      oldValues,
      newValues: { ...newValues, targetUserId, universityId },
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }
}
