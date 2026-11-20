import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, LessThan, MoreThan } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/interfaces/user-role';
import { PaginationQueryDto, toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { TenantContext } from '../common/tenant/tenant-context';
import { requireOrganizationId } from '../common/tenant/require-university';
import { ScheduleService } from '../schedule/schedule.service';
import { User } from '../users/entities/user.entity';
import { CareerCompany, CareerMembership, CareerPartnership, CareerProfile } from './career.entities';
import { CareerService } from './career.service';
import { CareerVacancy, CareerVacancyApplication } from './vacancies.entity';
import { CreateVacancyDto, ProposeInterviewDto, RespondInterviewDto, ReviewVacancyDto, VacancyQuery } from './vacancies.dto';

const DAY = 86400000;

@Injectable()
export class VacanciesService {
  constructor(
    private readonly db: DataSource,
    private readonly career: CareerService,
    private readonly schedule: ScheduleService,
    private readonly tenant: TenantContext,
  ) {}

  private student(actor: AuthenticatedUser): string {
    if (actor.role !== UserRole.STUDENT) throw new ForbiddenException('Действие доступно студенту');
    return requireOrganizationId(actor);
  }

  private async companyIds(actor: AuthenticatedUser): Promise<string[]> {
    if (actor.role === UserRole.STUDENT) throw new ForbiddenException('Нужны права работодателя');
    const memberships = await this.db.getRepository(CareerMembership).findBy({
      userId: actor.id, revokedAt: IsNull(), role: In(['company_owner', 'company_member']),
    });
    return memberships.flatMap(member => member.companyId ? [member.companyId] : []);
  }

  private async vacancy(id: string, manager = this.db.manager, lock = false) {
    const row = await manager.getRepository(CareerVacancy).findOne({
      where: { id }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('Вакансия не найдена');
    return row;
  }

  private async employerVacancy(actor: AuthenticatedUser, id: string) {
    const vacancy = await this.vacancy(id);
    if (!(await this.companyIds(actor)).includes(vacancy.companyId)) throw new NotFoundException('Вакансия не найдена');
    return vacancy;
  }

  async list(actor: AuthenticatedUser, mode: string | undefined, pagination: VacancyQuery) {
    const workspace = mode || (actor.role === UserRole.STUDENT ? 'student' : 'employer');
    const vacancies = this.db.getRepository(CareerVacancy).createQueryBuilder('vacancy');
    if (workspace === 'student') {
      const organizationId = this.student(actor);
      const applications = vacancies.subQuery().select('1').from(CareerVacancyApplication, 'application')
        .where('application.vacancyId = vacancy.id AND application.studentId = :studentId').getQuery();
      vacancies.where(`vacancy.organizationId = :organizationId AND (vacancy.status = 'open' OR EXISTS ${applications})`, { organizationId, studentId: actor.id });
    } else if (workspace === 'center') {
      const organizationId = await this.career.assertCenterAccess(actor);
      vacancies.where('vacancy.organizationId = :organizationId', { organizationId });
      vacancies.addOrderBy("CASE WHEN vacancy.status = 'pending' THEN 0 ELSE 1 END", 'ASC');
    } else if (workspace === 'employer') {
      const companies = await this.companyIds(actor);
      if (!companies.length) return toPaginatedResponse([], 0, pagination);
      vacancies.where('vacancy.companyId IN (:...companies)', { companies });
    } else {
      throw new BadRequestException('Неизвестный кабинет');
    }
    const [items, total] = await vacancies.addOrderBy('vacancy.createdAt', 'DESC').addOrderBy('vacancy.id', 'DESC')
      .offset((pagination.page - 1) * pagination.limit).limit(pagination.limit).getManyAndCount();
    const companies = items.length ? await this.db.getRepository(CareerCompany).findBy({ id: In(items.map(item => item.companyId)) }) : [];
    const applications = workspace === 'student' && items.length ? await this.db.getRepository(CareerVacancyApplication).findBy({
      studentId: actor.id, vacancyId: In(items.map(item => item.id)),
    }) : [];
    return toPaginatedResponse(items.map(item => ({
      ...item,
      reviewReason: workspace === 'student' ? undefined : item.reviewReason,
      companyName: companies.find(company => company.id === item.companyId)?.name ?? 'Работодатель',
      application: applications.find(application => application.vacancyId === item.id) ?? null,
    })), total, pagination);
  }

  async create(actor: AuthenticatedUser, input: CreateVacancyDto) {
    if (!(await this.companyIds(actor)).includes(input.companyId)) throw new ForbiddenException('Нет доступа к компании');
    const partnership = await this.career.checkPartnershipEligibility(actor, input.companyId, input.organizationId);
    if (!partnership.eligible) throw new ForbiddenException('Нужно подтверждённое партнёрство с вузом');
    return this.db.getRepository(CareerVacancy).save({ ...input, status: 'pending' });
  }

  async review(actor: AuthenticatedUser, id: string, input: ReviewVacancyDto) {
    const organizationId = await this.career.assertCenterAccess(actor);
    if (input.decision === 'rejected' && !input.reason) throw new BadRequestException('Укажите причину отклонения');
    return this.tenant.runWithDatabaseAccess({ relation: { table: 'career_vacancy', column: 'id', value: id, write: true } },
      () => this.db.transaction(async manager => {
        const vacancy = await this.vacancy(id, manager, true);
        if (vacancy.organizationId !== organizationId) throw new NotFoundException('Вакансия не найдена');
        if (vacancy.status !== 'pending') throw new ConflictException('Решение по вакансии уже принято');
        if (input.decision === 'open' && !await manager.getRepository(CareerPartnership).existsBy({
          organizationId, companyId: vacancy.companyId, state: 'verified',
        })) throw new ConflictException('Партнёрство с вузом больше не подтверждено');
        return manager.getRepository(CareerVacancy).save({ ...vacancy, status: input.decision, reviewReason: input.reason });
      }));
  }

  async close(actor: AuthenticatedUser, id: string) {
    await this.employerVacancy(actor, id);
    const repository = this.db.getRepository(CareerVacancy);
    await repository.update({ id, status: In(['open', 'pending']) }, { status: 'closed' });
    return this.employerVacancy(actor, id);
  }

  async apply(actor: AuthenticatedUser, id: string) {
    const organizationId = this.student(actor);
    return this.db.transaction(async manager => {
      const vacancy = await this.vacancy(id, manager);
      if (vacancy.organizationId !== organizationId || vacancy.status !== 'open') throw new NotFoundException('Открытая вакансия не найдена');
      const repository = manager.getRepository(CareerVacancyApplication);
      const existing = await repository.findOneBy({ vacancyId: id, studentId: actor.id });
      if (existing) return existing;
      const profile = await manager.getRepository(CareerProfile).findOneBy({ studentId: actor.id, organizationId });
      if (!profile) throw new ConflictException('Заполните профессиональный профиль перед откликом');
      const user = await manager.getRepository(User).findOneByOrFail({ id: actor.id, organizationId });
      await repository.createQueryBuilder().insert().values({
        vacancyId: id, organizationId, companyId: vacancy.companyId, studentId: actor.id,
        resume: { name: [user.firstName, user.lastName].filter(Boolean).join(' '), headline: profile.headline, about: profile.about, skills: profile.skills },
      }).orIgnore().execute();
      return repository.findOneByOrFail({ vacancyId: id, studentId: actor.id });
    });
  }

  async applications(actor: AuthenticatedUser, vacancyId: string, pagination: PaginationQueryDto) {
    await this.employerVacancy(actor, vacancyId);
    const [items, total] = await this.db.getRepository(CareerVacancyApplication).findAndCount({
      where: { vacancyId }, order: { createdAt: 'DESC', id: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit, take: pagination.limit,
    });
    return toPaginatedResponse(items, total, pagination);
  }

  async propose(actor: AuthenticatedUser, vacancyId: string, id: string, input: ProposeInterviewDto) {
    await this.employerVacancy(actor, vacancyId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const duration = endsAt.getTime() - startsAt.getTime();
    if (startsAt.getTime() <= Date.now() || !(duration > 0 && duration <= 8 * 3600000)) {
      throw new BadRequestException('Укажите будущий интервал продолжительностью до 8 часов');
    }
    const repository = this.db.getRepository(CareerVacancyApplication);
    const result = await repository.update({ id, vacancyId, status: In(['submitted', 'declined']) }, {
      startsAt, endsAt, meetingDetails: input.meetingDetails, status: 'proposed',
    });
    if (!result.affected) {
      if (!await repository.existsBy({ id, vacancyId })) throw new NotFoundException('Отклик не найден');
      throw new ConflictException('Дождитесь ответа на текущее предложение');
    }
    return repository.findOneByOrFail({ id, vacancyId });
  }

  async respond(actor: AuthenticatedUser, id: string, input: RespondInterviewDto) {
    const organizationId = this.student(actor);
    return this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`career-interviews:${actor.id}`]);
      const repository = manager.getRepository(CareerVacancyApplication);
      const application = await repository.findOne({
        where: { id, studentId: actor.id, organizationId }, lock: { mode: 'pessimistic_write' },
      });
      if (!application) throw new NotFoundException('Отклик не найден');
      if (application.updatedAt.getTime() !== Date.parse(input.updatedAt) || application.status !== 'proposed' ||
          !application.startsAt || !application.endsAt) throw new ConflictException('Предложение изменилось. Обновите страницу.');
      if (input.decision === 'confirmed') {
        if (application.startsAt.getTime() <= Date.now()) throw new ConflictException('Предложенное время уже прошло');
        await this.checkSchedule(actor, organizationId, application.startsAt, application.endsAt);
        const overlap = await repository.existsBy({
          studentId: actor.id, status: 'confirmed', startsAt: LessThan(application.endsAt), endsAt: MoreThan(application.startsAt),
        });
        if (overlap) throw new ConflictException('На это время уже подтверждено другое собеседование');
      }
      application.status = input.decision;
      return repository.save(application);
    });
  }

  private async checkSchedule(actor: AuthenticatedUser, organizationId: string, start: Date, end: Date) {
    if (!actor.groupId) throw new ServiceUnavailableException('Не удалось определить учебную группу для проверки расписания');
    const from = new Date(start.getTime() - DAY).toISOString();
    const pagination = new PaginationQueryDto();
    pagination.limit = 100;
    let totalPages = 1;
    for (; pagination.page <= totalPages; pagination.page += 1) {
      const page = await this.schedule.findForStudentDateRange(
        organizationId, actor.groupId, from, end.toISOString(), pagination, 'Asia/Omsk',
      ).catch(() => { throw new ServiceUnavailableException('Расписание временно недоступно. Повторите проверку позже.'); });
      totalPages = page.meta.totalPages;
      if (totalPages > 10) throw new ServiceUnavailableException('Не удалось проверить весь интервал расписания');
      const conflict = page.data.some(lesson => !(lesson.isChanged && /отмен/i.test(lesson.changeDescription ?? '')) &&
        new Date(lesson.startDate) < end && new Date(lesson.endDate) > start);
      if (conflict) throw new ConflictException('В это время есть занятие. Отклоните предложение, чтобы работодатель выбрал другое время.');
    }
  }
}
