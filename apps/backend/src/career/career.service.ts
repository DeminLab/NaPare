import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, MoreThanOrEqual, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuthService } from '../auth/auth.service';
import { requireUniversityId } from '../common/tenant/require-university';
import { CareerNotice, CareerTest, CareerTestAttempt, CareerCompany, CareerMembership, CareerPartnership, CareerProfile, CareerAdmission, CareerTask, CareerApplication, CareerWork, CareerReview, CareerPortfolio } from './career.entities';
import { CareerTestDto, CareerAttemptDto, EmployerRegistrationDto, CareerCompanyDto, CareerProfileDto, CareerTaskDto, CareerMessageDto, CareerSubmissionDto, CareerDecisionDto, CareerReviewDto, CareerMembershipDto, CareerAdmissionDto } from './career.dto';

type Actor = AuthenticatedUser;
type CareerTaskListQuery = {offset?: string; limit?: string; q?: string; category?: string; state?: string};
type CareerWorkflowQuery = {kind?: string; offset?: string; limit?: string; q?: string; state?: string};
type CareerCenterReviewQuery = {kind?: string; offset?: string; limit?: string; q?: string; state?: string};
type CareerPartnershipQuery = {offset?: string; limit?: string; q?: string; state?: string};
type CareerTestListQuery = {offset?: string; limit?: string; q?: string};
type CareerNoticeListQuery = {offset?: string; limit?: string};
type CareerLookupQuery = {offset?: string; limit?: string; q?: string};
type CareerStudentAdmissionQuery = {offset?: string; limit?: string; q?: string; state?: string};
type CareerPortfolioListQuery = {offset?: string; limit?: string};
const centerRoles = [UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN, UserRole.UNIVERSITY_ADMIN];

export function assertCareerTransition(current: string, allowed: string[]): void {
  if (!allowed.includes(current)) throw new ConflictException('Статус изменился. Обновите страницу.');
}
export function assertCareerResultUrl(value: string): void {
  if (!value.trim()) return;
  try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
  catch { throw new BadRequestException('Укажите HTTPS-ссылку на результат без логина и пароля.'); }
}

@Injectable()
export class CareerService {
  constructor(private readonly db: DataSource, private readonly auth: AuthService) {}
  private repo<T extends object>(entity: new () => T, manager = this.db.manager) { return manager.getRepository(entity); }
  private async university(id: string) { if (!await this.repo(University).existsBy({id})) throw new NotFoundException('Вуз не найден'); }
  private async center(actor: Actor, universityId: string, administrator = false): Promise<void> {
    if (!universityId || actor.universityId !== universityId) throw new ForbiddenException('Другой вуз');
    const primary = administrator ? [UserRole.CAREER_ADMIN, UserRole.UNIVERSITY_ADMIN] : centerRoles;
    if (primary.includes(actor.role)) return;
    const roles = administrator ? ['career_admin'] : ['career_admin','career_staff'];
    if (!await this.repo(CareerMembership).existsBy({userId:actor.id,universityId,role:In(roles),revokedAt:IsNull()})) throw new ForbiddenException('Нужны права карьерного центра');
  }
  private async company(actor: Actor, companyId: string, owner = false, manager = this.db.manager): Promise<void> {
    if (!await this.repo(CareerMembership,manager).existsBy({userId:actor.id,companyId,role:In(owner?['company_owner']:['company_owner','company_member']),revokedAt:IsNull()})) throw new ForbiddenException('Нет доступа к компании');
  }
  private student(actor: Actor) { if (actor.role !== UserRole.STUDENT) throw new ForbiddenException('Действие доступно студенту'); return requireUniversityId(actor); }
  private async task(id: string, manager = this.db.manager, lock = false) {
    const task = await this.repo(CareerTask,manager).findOne({where:{id},...(lock?{lock:{mode:'pessimistic_write' as const}}:{})});
    if (!task) throw new NotFoundException('Задача не найдена'); return task;
  }
  private async work(id: string, manager: EntityManager) {
    const work = await this.repo(CareerWork,manager).findOne({where:{id},lock:{mode:'pessimistic_write'}});
    if (!work) throw new NotFoundException('Работа не найдена'); return work;
  }
  async register(dto: EmployerRegistrationDto) {
    if(Buffer.byteLength(dto.password,'utf8')>72)throw new BadRequestException('Пароль слишком длинный. Используйте более короткую парольную фразу.');
    const email = dto.email.trim().toLowerCase();
    if (await this.repo(User).createQueryBuilder('u').where('LOWER(u.email) = :email',{email}).getExists()) throw new ConflictException('Аккаунт с такой почтой уже существует. Войдите в него.');
    try { await this.repo(User).save(this.repo(User).create({email,passwordHash:await bcrypt.hash(dto.password,12),firstName:dto.firstName.trim(),lastName:dto.lastName.trim(),role:UserRole.EMPLOYER,universityId:null})); }
    catch (error) { if ((error as {driverError?:{code?:string}}).driverError?.code === '23505') throw new ConflictException('Аккаунт уже существует'); throw error; }
    return this.auth.portalLogin({email,password:dto.password});
  }
  async overview(actor: Actor, requestedMode?: string) {
    const memberships = await this.repo(CareerMembership).find({where:{userId:actor.id,revokedAt:IsNull()}});
    const isCenter = Boolean(actor.universityId && (centerRoles.includes(actor.role) || memberships.some(m=>m.universityId===actor.universityId)));
    const companyIds = memberships.filter(m=>m.companyId).map(m=>m.companyId!);
    const availableModes = actor.role===UserRole.STUDENT ? ['student'] : [...(isCenter?['center']:[]),...([UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(actor.role)?[]:['employer'])];
    if(requestedMode&&!availableModes.includes(requestedMode))throw new ForbiddenException('Этот кабинет вам недоступен');
    const mode=requestedMode || availableModes[0] || 'unavailable';
    const ownedCompanies = companyIds.length ? await this.repo(CareerCompany).find({where:{id:In(companyIds)}}) : [];
    const partnerships = mode==='center' ? await this.repo(CareerPartnership).find({where:{universityId:requireUniversityId(actor)},take:100}) : companyIds.length ? await this.repo(CareerPartnership).find({where:{companyId:In(companyIds)},take:100}) : [];
    const partnerCompanies = mode==='center' && partnerships.length ? await this.repo(CareerCompany).find({where:{id:In(partnerships.map(p=>p.companyId))}}) : [];
    const companies=ownedCompanies;
    const profile = actor.role===UserRole.STUDENT ? await this.repo(CareerProfile).findOneBy({studentId:actor.id}) : null;
    const profiles = mode==='center' ? await this.repo(CareerProfile).find({where:{universityId:requireUniversityId(actor)},take:100}) : [];
    const admissions = mode==='center' ? await this.repo(CareerAdmission).find({where:{universityId:requireUniversityId(actor)},take:100}) : actor.role===UserRole.STUDENT ? await this.repo(CareerAdmission).find({where:{studentId:actor.id},take:100}) : [];
    const myApplications = actor.role===UserRole.STUDENT ? await this.repo(CareerApplication).find({where:{studentId:actor.id},take:100}) : [];
    const myWorks = actor.role===UserRole.STUDENT ? await this.repo(CareerWork).find({where:{studentId:actor.id},take:100}) : [];
    const tasks = mode==='center' ? await this.repo(CareerTask).find({where:{universityId:requireUniversityId(actor)},order:{createdAt:'DESC'},take:100}) : mode==='employer' && companyIds.length ? await this.repo(CareerTask).find({where:{companyId:In(companyIds)},order:{createdAt:'DESC'},take:100}) : mode==='student' ? await this.repo(CareerTask).find({where:[{universityId:requireUniversityId(actor),state:'open'},...(myApplications.length? [{id:In(myApplications.map(a=>a.taskId)),universityId:requireUniversityId(actor)}]:[])],order:{createdAt:'DESC'},take:100}) : [];
    const taskIds=tasks.map(t=>t.id);
    const works = mode==='student' ? myWorks : taskIds.length ? await this.repo(CareerWork).find({where:{taskId:In(taskIds)},take:100}) : [];
    const applications = mode==='student' ? myApplications : taskIds.length ? await this.repo(CareerApplication).find({where:{taskId:In(taskIds)},take:100}) : [];
    // Employers receive only the professional profile of actual applicants, never university records.
    const candidateProfiles = mode==='employer' && applications.length ? await this.repo(CareerProfile).find({where:{studentId:In(applications.map(a=>a.studentId))}}) : [];
    const candidateNames=candidateProfiles.length?await this.repo(User).find({where:{id:In(candidateProfiles.map(p=>p.studentId))},select:{id:true,firstName:true,lastName:true}}):[];
    const candidateAdmissions=mode==='employer'&&candidateProfiles.length?await this.repo(CareerAdmission).find({where:{studentId:In(candidateProfiles.map(p=>p.studentId)),universityId:In([...new Set(tasks.map(t=>t.universityId))]),state:'approved'}}):[];
    const candidates=candidateProfiles.map(profile=>({...profile,approvedSkills:candidateAdmissions.filter(a=>a.studentId===profile.studentId&&applications.some(app=>app.studentId===profile.studentId&&tasks.some(task=>task.id===app.taskId&&task.universityId===a.universityId&&task.profiled&&task.skill===a.skill))).map(a=>({skill:a.skill,basis:a.basis})),name: candidateNames.find(u=>u.id===profile.studentId)?`${candidateNames.find(u=>u.id===profile.studentId)!.firstName} ${candidateNames.find(u=>u.id===profile.studentId)!.lastName}`:''}));
    const contacts=mode==='center'&&partnerCompanies.length?await this.repo(User).find({where:{id:In(partnerCompanies.map(c=>c.createdBy))},select:{id:true,firstName:true,lastName:true,email:true}}):[];
    const relevantCompanies = [...companies,...partnerCompanies.map(company=>({...company,contact:contacts.find(u=>u.id===company.createdBy)?{name:`${contacts.find(u=>u.id===company.createdBy)!.firstName} ${contacts.find(u=>u.id===company.createdBy)!.lastName}`,email:contacts.find(u=>u.id===company.createdBy)!.email}:null}))];
    if (mode==='student' && tasks.length) relevantCompanies.push(...await this.repo(CareerCompany).find({where:{id:In(tasks.map(t=>t.companyId))}}));
    const workIds=works.map(w=>w.id);
    const reviews = workIds.length ? await this.repo(CareerReview).find({where:{workId:In(workIds)}}) : [];
    const portfolio = mode==='student' ? await this.repo(CareerPortfolio).find({where:{studentId:actor.id},take:100}) : [];
    const ownUniversity=actor.universityId ? await this.repo(University).findOneBy({id:actor.universityId}) : null;
    const universities=mode==='employer' ? await this.repo(University).find({select:{id:true,name:true,city:true},take:100}) : ownUniversity ? [{id:ownUniversity.id,name:ownUniversity.name,city:ownUniversity.city}] : [];
    const staff = mode==='center' ? await this.repo(User).find({where:{universityId:requireUniversityId(actor)},select:{id:true,firstName:true,lastName:true,role:true},take:100}) : [];
    const notices=await this.repo(CareerNotice).find({where:{userId:actor.id},order:{createdAt:'DESC'},take:100});
    return {availableModes,notices,actor:{id:actor.id,role:actor.role},mode,payment:{configured:false,provider:null,country:'RU'},limit:100,companies:relevantCompanies,partnerships,memberships,profile,profiles,admissions,tasks,applications,candidates,works,reviews,portfolio,universities,staff};
  }
  async listTasks(actor: Actor, requestedMode: string | undefined, query: CareerTaskListQuery) {
    const offset = query.offset === undefined ? 0 : Number(query.offset);
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new BadRequestException('Некорректное смещение списка задач');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Размер страницы должен быть от 1 до 50');
    const category = query.category || 'all';
    if (!['all','profiled','other'].includes(category)) throw new BadRequestException('Некорректное направление задач');
    const taskState = query.state || 'all';
    if (!['all','draft','review','open','assigned','accepted'].includes(taskState)) throw new BadRequestException('Некорректное состояние задач');

    const memberships = await this.repo(CareerMembership).find({where:{userId:actor.id,revokedAt:IsNull()}});
    const isCenter = Boolean(actor.universityId && (centerRoles.includes(actor.role) || memberships.some(m=>m.universityId===actor.universityId)));
    const availableModes = actor.role===UserRole.STUDENT ? ['student'] : [...(isCenter?['center']:[]),...([UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(actor.role)?[]:['employer'])];
    if (requestedMode && !availableModes.includes(requestedMode)) throw new ForbiddenException('Этот кабинет вам недоступен');
    const mode = requestedMode || availableModes[0] || 'unavailable';
    const repository = this.repo(CareerTask);
    const builder = repository.createQueryBuilder('task');
    let applicationTaskIds: string[] = [];

    if (mode === 'student') {
      const universityId = this.student(actor);
      const applications = await this.repo(CareerApplication).find({where:{studentId:actor.id},select:{taskId:true}});
      applicationTaskIds = applications.map(application=>application.taskId);
      builder.where('task.universityId = :universityId',{universityId});
      if (applicationTaskIds.length) builder.andWhere('(task.state = :openState OR task.id IN (:...applicationTaskIds))',{openState:'open',applicationTaskIds});
      else builder.andWhere('task.state = :openState',{openState:'open'});
    } else if (mode === 'center') {
      const universityId = requireUniversityId(actor);
      await this.center(actor,universityId);
      builder.where('task.universityId = :universityId',{universityId});
    } else if (mode === 'employer') {
      const companyIds = memberships.filter(m=>m.companyId&&['company_owner','company_member'].includes(m.role)).map(m=>m.companyId!);
      if (companyIds.length) builder.where('task.companyId IN (:...companyIds)',{companyIds});
      else builder.where('1 = 0');
    } else {
      builder.where('1 = 0');
    }

    if (mode !== 'student' && taskState !== 'all') builder.andWhere('task.state = :taskState',{taskState});
    if (category !== 'all') builder.andWhere('task.profiled = :profiled',{profiled:category==='profiled'});
    const search = query.q?.trim().slice(0,160).toLocaleLowerCase('ru-RU');
    if (search) {
      builder.andWhere('(LOWER(task.title) LIKE :taskSearch OR LOWER(task.description) LIKE :taskSearch OR LOWER(task.skill) LIKE :taskSearch)',{taskSearch:`%${search}%`});
    }
    builder.orderBy('task.createdAt','DESC').addOrderBy('task.id','DESC').skip(offset).take(limit);
    const [items,total] = await builder.getManyAndCount();
    const itemIds = new Set(items.map(item=>item.id));
    const appliedTaskIds = applicationTaskIds.filter(id=>itemIds.has(id));
    const companies = items.length ? await this.repo(CareerCompany).find({where:{id:In([...new Set(items.map(item=>item.companyId))])},select:{id:true,name:true}}) : [];
    return {items,companies,appliedTaskIds,total,offset,limit,hasMore:offset+items.length<total};
  }
  async listWorkflows(actor: Actor, requestedMode: string | undefined, query: CareerWorkflowQuery) {
    const kind = query.kind;
    if (kind !== 'applications' && kind !== 'works') throw new BadRequestException('Укажите тип списка: отклики или работы');
    const offset = query.offset === undefined ? 0 : Number(query.offset);
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new BadRequestException('Некорректное смещение списка');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Размер страницы должен быть от 1 до 50');
    const state = query.state || 'all';
    const validStates = kind==='applications' ? ['all','pending','selected','not_selected'] : ['all','active','in_progress','submitted','revision','accepted'];
    if (!validStates.includes(state)) throw new BadRequestException('Некорректное состояние списка');

    const memberships = await this.repo(CareerMembership).find({where:{userId:actor.id,revokedAt:IsNull()}});
    const isCenter = Boolean(actor.universityId && (centerRoles.includes(actor.role) || memberships.some(m=>m.universityId===actor.universityId)));
    const availableModes = actor.role===UserRole.STUDENT ? ['student'] : [...(isCenter?['center']:[]),...([UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(actor.role)?[]:['employer'])];
    if (requestedMode && !availableModes.includes(requestedMode)) throw new ForbiddenException('Этот кабинет вам недоступен');
    const mode = requestedMode || availableModes[0] || 'unavailable';
    if (mode==='center' || mode==='unavailable') throw new ForbiddenException('Этот список недоступен в выбранном кабинете');

    const alias = kind==='applications' ? 'application' : 'work';
    const builder = (kind==='applications' ? this.repo(CareerApplication).createQueryBuilder(alias) : this.repo(CareerWork).createQueryBuilder(alias)) as unknown as SelectQueryBuilder<CareerApplication|CareerWork>;
    builder.innerJoin(CareerTask,'task',`task.id = ${alias}.taskId`);
    if (mode==='student') {
      const universityId = this.student(actor);
      builder.where(`${alias}.studentId = :studentId`,{studentId:actor.id}).andWhere('task.universityId = :universityId',{universityId});
    } else {
      const companyIds = memberships.filter(m=>m.companyId&&['company_owner','company_member'].includes(m.role)).map(m=>m.companyId!);
      if (companyIds.length) builder.where('task.companyId IN (:...companyIds)',{companyIds});
      else builder.where('1 = 0');
      if (kind==='applications') builder.leftJoin(User,'applicant','applicant.id = application.studentId').leftJoin(CareerProfile,'applicantProfile','applicantProfile.studentId = application.studentId');
    }
    if (state==='active') builder.andWhere(`${alias}.state <> :acceptedState`,{acceptedState:'accepted'});
    else if (state!=='all') builder.andWhere(`${alias}.state = :workflowState`,{workflowState:state});
    const search = query.q?.trim().slice(0,160).toLocaleLowerCase('ru-RU');
    if (search) {
      const match = kind==='applications'&&mode==='employer'
        ? '(LOWER(task.title) LIKE :workflowSearch OR LOWER(task.skill) LIKE :workflowSearch OR LOWER(applicant.firstName) LIKE :workflowSearch OR LOWER(applicant.lastName) LIKE :workflowSearch OR LOWER(applicantProfile.headline) LIKE :workflowSearch)'
        : '(LOWER(task.title) LIKE :workflowSearch OR LOWER(task.skill) LIKE :workflowSearch)';
      builder.andWhere(match,{workflowSearch:`%${search}%`});
    }
    builder.orderBy(`${alias}.createdAt`,'DESC').addOrderBy(`${alias}.id`,'DESC').skip(offset).take(limit);
    const [records,total] = await builder.getManyAndCount();
    const taskIds = [...new Set(records.map(record=>record.taskId))];
    const tasks = taskIds.length ? await this.repo(CareerTask).find({where:{id:In(taskIds)}}) : [];
    const companyIds = [...new Set(tasks.map(task=>task.companyId))];
    const companies = companyIds.length ? await this.repo(CareerCompany).find({where:{id:In(companyIds)},select:{id:true,name:true}}) : [];

    let candidates = new Map<string,{studentId:string;name:string;headline:string;skills:string[];approvedSkills:{skill:string;basis:string}[]}>();
    if (kind==='applications'&&mode==='employer'&&records.length) {
      const studentIds = [...new Set(records.map(record=>record.studentId))];
      const [profiles,users,admissions] = await Promise.all([
        this.repo(CareerProfile).find({where:{studentId:In(studentIds)},select:{studentId:true,headline:true,skills:true}}),
        this.repo(User).find({where:{id:In(studentIds),role:UserRole.STUDENT,isActive:true},select:{id:true,firstName:true,lastName:true}}),
        this.repo(CareerAdmission).find({where:{studentId:In(studentIds),universityId:In([...new Set(tasks.map(task=>task.universityId))]),state:'approved'},select:{studentId:true,universityId:true,skill:true,basis:true}}),
      ]);
      candidates = new Map(profiles.filter(profile=>users.some(user=>user.id===profile.studentId)).map(profile=>{
        const user=users.find(item=>item.id===profile.studentId)!;
        const approvedSkills=[...new Set(tasks.filter(task=>task.profiled&&records.some(record=>record.studentId===profile.studentId&&record.taskId===task.id)).map(task=>task.skill))].flatMap(skill=>{
          const admission=admissions.find(item=>item.studentId===profile.studentId&&item.skill===skill&&tasks.some(task=>task.skill===skill&&task.universityId===item.universityId&&task.profiled&&records.some(record=>record.studentId===profile.studentId&&record.taskId===task.id)));
          return admission?[{skill,basis:admission.basis}]:[];
        });
        return [profile.studentId,{studentId:profile.studentId,name:`${user.firstName} ${user.lastName}`,headline:profile.headline,skills:profile.skills,approvedSkills}];
      }));
    }
    const reviews = kind==='works'&&records.length ? await this.repo(CareerReview).find({where:{workId:In(records.map(record=>record.id))}}) : [];
    const items = records.map(record=>({
      ...record,
      task:tasks.find(task=>task.id===record.taskId)||null,
      company:companies.find(company=>company.id===tasks.find(task=>task.id===record.taskId)?.companyId)?.name||'Работодатель',
      ...(kind==='applications'&&mode==='employer'?{candidate:candidates.get(record.studentId)||null}:{}),
      ...(kind==='works'?{review:reviews.find(review=>review.workId===record.id)||null}:{}),
    }));
    return {items,total,offset,limit,hasMore:offset+items.length<total};
  }
  async listCenterReviews(actor: Actor, query: CareerCenterReviewQuery) {
    const universityId=requireUniversityId(actor);
    await this.center(actor,universityId);
    const kind=query.kind;
    if(kind!=='profiles'&&kind!=='admissions')throw new BadRequestException('Укажите тип очереди: профили или допуски');
    const offset=query.offset===undefined?0:Number(query.offset);
    const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение списка');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы должен быть от 1 до 50');
    const state=query.state||'pending';
    const validStates=kind==='profiles'?['all','pending','verified','rejected']:['all','pending','approved','rejected'];
    if(!validStates.includes(state))throw new BadRequestException('Некорректное состояние очереди');
    const alias=kind==='profiles'?'profile':'admission';
    const builder=(kind==='profiles'?this.repo(CareerProfile).createQueryBuilder(alias):this.repo(CareerAdmission).createQueryBuilder(alias)) as unknown as SelectQueryBuilder<CareerProfile|CareerAdmission>;
    builder.innerJoin(User,'student',`student.id = ${alias}.studentId`)
      .where(`${alias}.universityId = :universityId`,{universityId})
      .andWhere('student.universityId = :universityId',{universityId})
      .andWhere('student.role = :studentRole',{studentRole:UserRole.STUDENT})
      .andWhere('student.isActive = true');
    if(state!=='all')builder.andWhere(`${alias}.${kind==='profiles'?'verification':'state'} = :reviewState`,{reviewState:state});
    const search=query.q?.trim().slice(0,160).toLocaleLowerCase('ru-RU');
    if(search){
      const searchExpression=kind==='profiles'
        ? '(LOWER(profile.headline) LIKE :reviewSearch OR LOWER(student.firstName) LIKE :reviewSearch OR LOWER(student.lastName) LIKE :reviewSearch OR LOWER(CAST(profile.skills AS text)) LIKE :reviewSearch)'
        : '(LOWER(admission.skill) LIKE :reviewSearch OR LOWER(admission.evidence) LIKE :reviewSearch OR LOWER(student.firstName) LIKE :reviewSearch OR LOWER(student.lastName) LIKE :reviewSearch)';
      builder.andWhere(searchExpression,{reviewSearch:`%${search}%`});
    }
    builder.orderBy(`${alias}.createdAt`,'DESC').addOrderBy(`${alias}.id`,'DESC').skip(offset).take(limit);
    const [records,total]=await builder.getManyAndCount();
    const studentIds=[...new Set(records.map(record=>record.studentId))];
    const students=studentIds.length?await this.repo(User).find({where:{id:In(studentIds),universityId,role:UserRole.STUDENT,isActive:true},select:{id:true,firstName:true,lastName:true}}):[];
    const items=records.map(record=>({...record,studentName:students.find(student=>student.id===record.studentId)?`${students.find(student=>student.id===record.studentId)!.firstName} ${students.find(student=>student.id===record.studentId)!.lastName}`:'Студент'}));
    return {items,total,offset,limit,hasMore:offset+items.length<total};
  }
  async listPartnerships(actor:Actor,requestedMode:string|undefined,query:CareerPartnershipQuery) {
    const offset=query.offset===undefined?0:Number(query.offset);const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение списка партнёрств');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы должен быть от 1 до 50');
    const state=query.state||'pending';if(!['all','pending','verified','rejected'].includes(state))throw new BadRequestException('Некорректное состояние партнёрства');
    const mode=requestedMode||(centerRoles.includes(actor.role)?'center':'employer');
    if(mode!=='center'&&mode!=='employer')throw new BadRequestException('Некорректный кабинет партнёрств');
    let universityId:string|undefined;let scopedCompanyIds:string[]=[];
    if(mode==='center'){
      universityId=requireUniversityId(actor);
      await this.center(actor,universityId);
    }else{
      const memberships=await this.repo(CareerMembership).find({where:{userId:actor.id,revokedAt:IsNull()}});
      scopedCompanyIds=memberships.filter(membership=>membership.companyId&&['company_owner','company_member'].includes(membership.role)).map(membership=>membership.companyId!);
    }
    const builder=this.repo(CareerPartnership).createQueryBuilder('partnership')
      .innerJoin(CareerCompany,'company','company.id = partnership.companyId')
      .innerJoin(University,'university','university.id = partnership.universityId');
    if(mode==='center'){
      builder.where('partnership.universityId = :universityId',{universityId});
    }else{
      if(scopedCompanyIds.length)builder.where('partnership.companyId IN (:...companyIds)',{companyIds:scopedCompanyIds});else builder.where('1 = 0');
    }
    if(state!=='all')builder.andWhere('partnership.state = :partnershipState',{partnershipState:state});
    const search=query.q?.trim().slice(0,160).toLocaleLowerCase('ru-RU');
    if(search)builder.andWhere('(LOWER(company.name) LIKE :partnershipSearch OR LOWER(university.name) LIKE :partnershipSearch)',{partnershipSearch:`%${search}%`});
    builder.orderBy('partnership.createdAt','DESC').addOrderBy('partnership.id','DESC').skip(offset).take(limit);
    const [items,total]=await builder.getManyAndCount();
    const companyIds=[...new Set(items.map(item=>item.companyId))];const universityIds=[...new Set(items.map(item=>item.universityId))];
    const [companies,universities]=await Promise.all([
      companyIds.length?this.repo(CareerCompany).find({where:{id:In(companyIds)},select:{id:true,name:true}}):Promise.resolve([] as CareerCompany[]),
      universityIds.length?this.repo(University).find({where:{id:In(universityIds)},select:{id:true,name:true}}):Promise.resolve([] as University[]),
    ]);
    return {items:items.map(item=>({...item,companyName:companies.find(company=>company.id===item.companyId)?.name||'Компания',universityName:universities.find(university=>university.id===item.universityId)?.name||'Вуз'})),total,offset,limit,hasMore:offset+items.length<total};
  }
  async checkPartnershipEligibility(actor:Actor,companyId:string,universityId:string) {
    await this.company(actor,companyId);
    await this.university(universityId);
    const partnership=await this.repo(CareerPartnership).findOneBy({companyId,universityId});
    return {companyId,universityId,eligible:partnership?.state==='verified',state:partnership?.state||'missing'};
  }
  async saveProfile(actor:Actor,dto:CareerProfileDto) {
    const universityId=this.student(actor);
    const existing=await this.repo(CareerProfile).findOneBy({studentId:actor.id});
    if (!dto.headline.trim()) throw new BadRequestException('Заполните профессиональный профиль');
    return this.repo(CareerProfile).save({...existing,...dto,headline:dto.headline.trim(),skills:[...new Set(dto.skills.map(s=>s.trim()).filter(Boolean))],studentId:actor.id,universityId,verification:'pending'});
  }
  async verifyProfile(actor:Actor,id:string,dto:CareerDecisionDto) {
    const profile=await this.repo(CareerProfile).findOneBy({id}); if(!profile) throw new NotFoundException();
    await this.center(actor,profile.universityId); if(!['approved','rejected'].includes(dto.decision)) throw new BadRequestException();
    profile.verification=dto.decision==='approved'?'verified':'rejected'; return this.repo(CareerProfile).save(profile);
  }
  async requestAdmission(actor:Actor,dto:CareerAdmissionDto) {
    const universityId=this.student(actor);const skill=dto.skill.trim().toLowerCase();
    if (!skill) throw new BadRequestException('Укажите направление');
    const old=await this.repo(CareerAdmission).findOneBy({studentId:actor.id,skill});
    return this.repo(CareerAdmission).save({...old,studentId:actor.id,universityId,skill,evidence:dto.evidence.trim(),state:'pending',reason:'',basis:'unspecified'});
  }
  async decideAdmission(actor:Actor,id:string,dto:CareerDecisionDto) {
    const admission=await this.repo(CareerAdmission).findOneBy({id}); if(!admission) throw new NotFoundException();
    await this.center(actor,admission.universityId);if(!['approved','rejected'].includes(dto.decision)||!dto.reason.trim()) throw new BadRequestException('Укажите решение и основание');
    admission.state=dto.decision;admission.basis=dto.decision==='approved'?'center':'unspecified';admission.reason=dto.reason;return this.repo(CareerAdmission).save(admission);
  }
  async createCompany(actor:Actor,dto:CareerCompanyDto) {
    if ([UserRole.STUDENT,UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(actor.role)) throw new ForbiddenException('Нужен рабочий аккаунт работодателя');await this.university(dto.universityId);
    if (!dto.name.trim()) throw new BadRequestException('Укажите компанию');
    return this.db.transaction(async m=>{const company=await this.repo(CareerCompany,m).save(this.repo(CareerCompany,m).create({name:dto.name.trim(),description:dto.description,createdBy:actor.id}));await this.repo(CareerMembership,m).save({userId:actor.id,companyId:company.id,universityId:null,role:'company_owner'});await this.repo(CareerPartnership,m).save({companyId:company.id,universityId:dto.universityId,state:'pending'});return company;});
  }
  async addPartnership(actor:Actor,companyId:string,universityId:string) {await this.company(actor,companyId,true);await this.university(universityId);if(await this.repo(CareerPartnership).existsBy({companyId,universityId})) throw new ConflictException('Заявка уже существует');return this.repo(CareerPartnership).save({companyId,universityId,state:'pending'});}
  async verifyPartnership(actor:Actor,id:string,dto:CareerDecisionDto) {
    const item=await this.repo(CareerPartnership).findOneBy({id});if(!item) throw new NotFoundException();await this.center(actor,item.universityId);if(await this.repo(CareerMembership).existsBy({userId:actor.id,companyId:item.companyId,revokedAt:IsNull()}))throw new ForbiddenException('Нельзя подтверждать собственную компанию');
    if(!['approved','rejected'].includes(dto.decision)) throw new BadRequestException();item.state=dto.decision==='approved'?'verified':'rejected';return this.repo(CareerPartnership).save(item);
  }
  async addMembership(actor:Actor,dto:CareerMembershipDto) {
    if(dto.companyId){await this.company(actor,dto.companyId,true);if(dto.identityConfirmed!==true)throw new BadRequestException('Подтвердите, что проверили аккаунт сотрудника');}else{await this.center(actor,requireUniversityId(actor),true);}
    if(Boolean(dto.userId)===Boolean(dto.email))throw new BadRequestException('Укажите сотрудника');const user=dto.userId?await this.repo(User).findOneBy({id:dto.userId,isActive:true}):await this.repo(User).createQueryBuilder('u').where('LOWER(u.email) = :email AND u.isActive = true',{email:dto.email!.trim().toLowerCase()}).getOne();if(!user) throw new NotFoundException('Аккаунт не найден');
    if(dto.companyId){await this.company(actor,dto.companyId,true);if(dto.role!=='company_member'||[UserRole.STUDENT,UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(user.role)) throw new BadRequestException('Нужен рабочий аккаунт сотрудника');const old=await this.repo(CareerMembership).findOneBy({userId:user.id,companyId:dto.companyId});if(old?.revokedAt===null)throw new ConflictException('Сотрудник уже имеет доступ к компании');return this.repo(CareerMembership).save({...old,userId:user.id,companyId:dto.companyId,universityId:null,role:dto.role,revokedAt:null,revokedBy:null});}
    const universityId=requireUniversityId(actor);await this.center(actor,universityId,true);
    if(user.universityId!==universityId||[UserRole.STUDENT,UserRole.EMPLOYER,UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(user.role)||!['career_staff','career_admin'].includes(dto.role)||dto.role==='career_admin'&&actor.role!==UserRole.UNIVERSITY_ADMIN) throw new ForbiddenException('Недоступное назначение');
    const old=await this.repo(CareerMembership).findOneBy({userId:user.id,universityId});return this.repo(CareerMembership).save({...old,userId:user.id,companyId:null,universityId,role:dto.role,revokedAt:null,revokedBy:null});
  }
  async createTask(actor:Actor,dto:CareerTaskDto) {
    await this.company(actor,dto.companyId);await this.university(dto.universityId);
    if(!await this.repo(CareerPartnership).existsBy({companyId:dto.companyId,universityId:dto.universityId,state:'verified'})) throw new ForbiddenException('Сначала карьерный центр должен подтвердить компанию');
    if(dto.title.trim().length<5||dto.description.trim().length<20||dto.criteria.trim().length<10)throw new BadRequestException('Опишите задачу и критерии приёмки');
    if(dto.profiled&&!dto.skill.trim()) throw new BadRequestException('Для профильной задачи требуется направление');
    if(!Number.isFinite(Date.parse(dto.deadline))||new Date(dto.deadline).toISOString().slice(0,10)!==dto.deadline||dto.deadline<new Date().toISOString().slice(0,10)) throw new BadRequestException('Нужна существующая будущая дата');
    return this.repo(CareerTask).save({...dto,title:dto.title.trim(),skill:dto.skill.trim().toLowerCase(),level:dto.level||'standard',requirements:dto.requirements?.trim()||'',state:'draft'});
  }
  async publishTask(actor:Actor,id:string,approve=false) {
    return this.db.transaction(async m=>{const task=await this.task(id,m,true);if(approve){await this.center(actor,task.universityId);if(await this.repo(CareerMembership,m).existsBy({userId:actor.id,companyId:task.companyId,revokedAt:IsNull()}))throw new ForbiddenException('Нельзя модерировать собственную задачу');assertCareerTransition(task.state,['review']);task.state='open';}else{await this.company(actor,task.companyId,false,m);assertCareerTransition(task.state,['draft']);task.state='review';}return this.repo(CareerTask,m).save(task);});
  }
  async apply(actor:Actor,id:string,dto:CareerMessageDto) {
    const universityId=this.student(actor);const task=await this.task(id);if(task.universityId!==universityId) throw new ForbiddenException('Задача другого вуза');assertCareerTransition(task.state,['open']);
    if(task.deadline<new Date().toISOString().slice(0,10)) throw new ConflictException('Срок задачи истёк');
    if(!await this.repo(CareerProfile).existsBy({studentId:actor.id,verification:'verified'})) throw new ForbiddenException('Подтвердите профессиональный профиль в карьерном центре');
    if(task.profiled&&!await this.repo(CareerAdmission).existsBy({studentId:actor.id,skill:task.skill,state:'approved'})) throw new ForbiddenException('Нет допуска к этому направлению');
    if(await this.repo(CareerWork).countBy({studentId:actor.id,state:In(['in_progress','revision','submitted'])})>=3) throw new ConflictException('Сначала завершите текущие задачи');
    if(await this.repo(CareerApplication).existsBy({taskId:id,studentId:actor.id})) throw new ConflictException('Отклик уже отправлен');try{return await this.repo(CareerApplication).save({taskId:id,studentId:actor.id,message:dto.message,state:'pending'});}catch(error){if((error as {driverError?:{code?:string}}).driverError?.code==='23505')throw new ConflictException('Отклик уже отправлен');throw error;}
  }
  async select(actor:Actor,id:string) {
    return this.db.transaction(async m=>{const application=await this.repo(CareerApplication,m).findOneBy({id});if(!application) throw new NotFoundException();const task=await this.task(application.taskId,m,true);await this.company(actor,task.companyId,false,m);if(task.deadline<new Date().toISOString().slice(0,10))throw new ConflictException('Срок задачи уже истёк');assertCareerTransition(task.state,['open']);assertCareerTransition(application.state,['pending']);
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`career-work:${application.studentId}`]);if(await this.repo(CareerWork,m).countBy({studentId:application.studentId,state:In(['in_progress','revision','submitted'])})>=3)throw new ConflictException('У студента уже три активные работы');const candidate=await this.repo(User,m).findOneBy({id:application.studentId,role:UserRole.STUDENT,isActive:true,universityId:task.universityId});if(!candidate||!await this.repo(CareerProfile,m).existsBy({studentId:candidate.id,verification:'verified'})||task.profiled&&!await this.repo(CareerAdmission,m).existsBy({studentId:candidate.id,skill:task.skill,state:'approved'}))throw new ForbiddenException('Допуск кандидата изменился');task.state='assigned';await this.repo(CareerApplication,m).update({taskId:task.id,state:'pending'},{state:'not_selected'});application.state='selected';await this.repo(CareerTask,m).save(task);await this.repo(CareerApplication,m).save(application);await this.notify(m,application.studentId,'Вы выбраны исполнителем',task.title);return this.repo(CareerWork,m).save({taskId:task.id,studentId:application.studentId,state:'in_progress'});});
  }
  async submit(actor:Actor,id:string,dto:CareerSubmissionDto) {
    this.student(actor);assertCareerResultUrl(dto.resultUrl);
    return this.db.transaction(async m=>{const work=await this.work(id,m);if(work.studentId!==actor.id) throw new ForbiddenException();assertCareerTransition(work.state,['in_progress','revision']);work.state='submitted';work.submission=dto.submission;work.resultUrl=dto.resultUrl.trim();await this.repo(CareerTask,m).update(work.taskId,{state:'submitted'});const task=await this.task(work.taskId,m);await this.notifyCompany(m,task.companyId,'Работа поступила на приёмку',task.title);return this.repo(CareerWork,m).save(work);});
  }
  async decideWork(actor:Actor,id:string,dto:CareerDecisionDto) {
    if(!['accepted','revision'].includes(dto.decision)||dto.decision==='revision'&&!dto.reason.trim()) throw new BadRequestException('Укажите решение и причину доработки');
    return this.db.transaction(async m=>{const work=await this.work(id,m);const task=await this.task(work.taskId,m);await this.company(actor,task.companyId,false,m);assertCareerTransition(work.state,['submitted']);work.state=dto.decision;work.decisionReason=dto.reason;await this.repo(CareerTask,m).update(task.id,{state:dto.decision});await this.notify(m,work.studentId,dto.decision==='accepted'?'Работа принята':'Запрошена доработка',`${task.title}. ${dto.reason}`);return this.repo(CareerWork,m).save(work);});
  }
  async review(actor:Actor,id:string,dto:CareerReviewDto) {
    return this.db.transaction(async m=>{const work=await this.work(id,m);const task=await this.task(work.taskId,m);await this.company(actor,task.companyId,false,m);assertCareerTransition(work.state,['accepted']);if(await this.repo(CareerReview,m).existsBy({workId:id})) throw new ConflictException('Отзыв уже сохранён');const review=await this.repo(CareerReview,m).save({...dto,workId:id,authorId:actor.id});await this.repo(CareerPortfolio,m).save({workId:id,studentId:work.studentId,published:false});await this.notify(m,work.studentId,'Новый отзыв и кейс портфолио',task.title);return review;});
  }
  async assertCompanyAccess(actor:Actor,id:string) { await this.company(actor,id); }
  async portfolioSource(actor:Actor,id:string) {
    this.student(actor);
    const item=await this.repo(CareerPortfolio).findOneBy({id,studentId:actor.id});if(!item)throw new NotFoundException();
    const work=await this.repo(CareerWork).findOneBy({id:item.workId,studentId:actor.id,state:'accepted'});
    const review=await this.repo(CareerReview).findOneBy({workId:item.workId});if(!work||!review)throw new ConflictException('Нужна принятая работа с отзывом');
    const task=await this.task(work.taskId);
    return {title:task.title,criteria:task.criteria,result:work.submission,review:review.body};
  }
  async saveCaseText(actor:Actor,id:string,caseText:string) {
    await this.portfolioSource(actor,id);
    const item=await this.repo(CareerPortfolio).findOneBy({id,studentId:actor.id});if(!item)throw new NotFoundException();
    await this.repo(CareerPortfolio).update({id,studentId:actor.id},{caseText:caseText.trim(),published:false});return this.repo(CareerPortfolio).findOneBy({id,studentId:actor.id});
  }
  async publishPortfolio(actor:Actor,id:string,published:boolean) {
    this.student(actor);const item=await this.repo(CareerPortfolio).findOneBy({id,studentId:actor.id});if(!item) throw new NotFoundException();const review=await this.repo(CareerReview).findOneBy({workId:item.workId});if(published&&!review?.publishAllowed) throw new ForbiddenException('Работодатель не разрешил публикацию результата');await this.repo(CareerPortfolio).update({id,studentId:actor.id},{published});return this.repo(CareerPortfolio).findOneBy({id,studentId:actor.id});
  }
  async publicPortfolio(studentId: string) {
    const items=await this.repo(CareerPortfolio).find({where:{studentId,published:true},take:100});
    const student=await this.repo(User).findOneBy({id:studentId,isActive:true,role:UserRole.STUDENT});
    if(!student||!items.length) throw new NotFoundException('Публичное портфолио не найдено');
    const result: Array<{id:string;title:string;skill:string;company:string|undefined;result:string;resultUrl:string;review:string;rating:number;paymentConfirmed:boolean;caseText:string}> = [];
    for(const item of items){const review=await this.repo(CareerReview).findOneBy({workId:item.workId,publishAllowed:true});const work=await this.repo(CareerWork).findOneBy({id:item.workId,studentId,state:'accepted'});if(!review||!work)continue;const task=await this.task(work.taskId);const company=await this.repo(CareerCompany).findOneBy({id:task.companyId});result.push({id:item.id,title:task.title,skill:task.skill,company:company?.name,result:work.submission,resultUrl:work.resultUrl,review:review.body,rating:review.rating,paymentConfirmed:false,caseText:item.caseText});}
    return {name:`${student.firstName} ${student.lastName}`,cases:result};
  }

  async listStudentAdmissions(actor:Actor,query:CareerStudentAdmissionQuery) {
    const universityId=this.student(actor);
    const offset=query.offset===undefined?0:Number(query.offset);const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение списка допусков');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы допусков должен быть от 1 до 50');
    const state=query.state||'all';if(!['all','pending','approved','rejected'].includes(state))throw new BadRequestException('Некорректный статус допуска');
    const repository=this.repo(CareerAdmission);
    const builder=repository.createQueryBuilder('admission').where('admission.studentId = :studentId AND admission.universityId = :universityId',{studentId:actor.id,universityId});
    if(state!=='all')builder.andWhere('admission.state = :state',{state});
    const search=query.q?.trim().slice(0,160).toLocaleLowerCase('ru-RU');
    if(search)builder.andWhere('(LOWER(admission.skill) LIKE :search OR LOWER(admission.evidence) LIKE :search)',{search:`%${search}%`});
    builder.orderBy('admission.createdAt','DESC').addOrderBy('admission.id','DESC').skip(offset).take(limit);
    const [items,total]=await builder.getManyAndCount();
    const approved=await repository.find({where:{studentId:actor.id,universityId,state:'approved'},select:{skill:true}});
    const approvedSkills=[...new Set(approved.map(item=>item.skill))].sort((a,b)=>a.localeCompare(b,'ru-RU'));
    return {items:items.map(({id,skill,evidence,state,reason,createdAt})=>({id,skill,evidence,state,reason,createdAt})),approvedSkills,total,offset,limit,hasMore:offset+items.length<total};
  }

  async listStudentPortfolio(actor:Actor,query:CareerPortfolioListQuery) {
    this.student(actor);
    const offset=query.offset===undefined?0:Number(query.offset);const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение портфолио');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы портфолио должен быть от 1 до 50');
    const portfolioRepo=this.repo(CareerPortfolio);
    const [portfolios,total]=await portfolioRepo.createQueryBuilder('portfolio')
      .innerJoin(CareerWork,'work','work.id = portfolio.workId AND work.studentId = :studentId AND work.state = :accepted',{studentId:actor.id,accepted:'accepted'})
      .innerJoin(CareerTask,'task','task.id = work.taskId')
      .innerJoin(CareerReview,'review','review.workId = work.id')
      .where('portfolio.studentId = :studentId',{studentId:actor.id})
      .orderBy('portfolio.createdAt','DESC').addOrderBy('portfolio.id','DESC').skip(offset).take(limit).getManyAndCount();
    const workIds=portfolios.map(item=>item.workId);
    const works=workIds.length?await this.repo(CareerWork).find({where:{id:In(workIds),studentId:actor.id,state:'accepted'}}):[];
    const taskIds=[...new Set(works.map(work=>work.taskId))];
    const tasks=taskIds.length?await this.repo(CareerTask).find({where:{id:In(taskIds)},select:{id:true,title:true,skill:true,companyId:true}}):[];
    const companyIds=[...new Set(tasks.map(task=>task.companyId))];
    const companies=companyIds.length?await this.repo(CareerCompany).find({where:{id:In(companyIds)},select:{id:true,name:true}}):[];
    const reviews=workIds.length?await this.repo(CareerReview).find({where:{workId:In(workIds)}}):[];
    const items=portfolios.flatMap(portfolio=>{
      const work=works.find(item=>item.id===portfolio.workId);if(!work)return [];
      const task=tasks.find(item=>item.id===work.taskId);if(!task)return [];
      const company=companies.find(item=>item.id===task.companyId);
      return [{portfolio,work,task:{id:task.id,title:task.title,skill:task.skill,company:company?{id:company.id,name:company.name}:null},review:reviews.find(item=>item.workId===work.id)||null}];
    });
    const acceptedWorks=await this.repo(CareerWork).countBy({studentId:actor.id,state:'accepted'});
    const reviewAggregate=await this.repo(CareerReview).createQueryBuilder('review')
      .innerJoin(CareerWork,'work','work.id = review.workId AND work.studentId = :studentId AND work.state = :accepted',{studentId:actor.id,accepted:'accepted'})
      .select('COUNT(review.id)','reviewCount').addSelect('AVG(review.rating)','averageRating').getRawOne<{reviewCount:string|number;averageRating:string|number|null}>();
    const reviewCount=Number(reviewAggregate?.reviewCount||0);
    return {items,total,offset,limit,hasMore:offset+portfolios.length<total,stats:{acceptedWorks,reviewCount,averageRating:reviewCount?Number(reviewAggregate?.averageRating):null}};
  }

  async publicPortfolioCases(studentId:string,query:CareerPortfolioListQuery) {
    const offset=query.offset===undefined?0:Number(query.offset);const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение портфолио');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы портфолио должен быть от 1 до 50');
    const student=await this.repo(User).findOne({where:{id:studentId,isActive:true,role:UserRole.STUDENT},select:{id:true,firstName:true,lastName:true}});
    if(!student)throw new NotFoundException('Публичное портфолио не найдено');
    const createBuilder=()=>this.repo(CareerPortfolio).createQueryBuilder('portfolio')
      .innerJoin(CareerWork,'work','work.id = portfolio.workId AND work.studentId = portfolio.studentId AND work.state = :accepted',{accepted:'accepted'})
      .innerJoin(CareerTask,'task','task.id = work.taskId')
      .innerJoin(CareerCompany,'company','company.id = task.companyId')
      .innerJoin(CareerReview,'review','review.workId = work.id AND review.publishAllowed = :publishAllowed',{publishAllowed:true})
      .where('portfolio.studentId = :studentId AND portfolio.published = :published',{studentId,published:true});
    const builder=createBuilder();
    builder.select([
      'portfolio.id AS portfolio_id','portfolio.caseText AS portfolio_case_text','portfolio.createdAt AS portfolio_created_at',
      'work.id AS work_id','work.submission AS work_submission','work.resultUrl AS work_result_url',
      'task.id AS task_id','task.title AS task_title','task.skill AS task_skill',
      'company.id AS company_id','company.name AS company_name',
      'review.id AS review_id','review.body AS review_body','review.rating AS review_rating',
    ]).orderBy('portfolio.createdAt','DESC').addOrderBy('portfolio.id','DESC').skip(offset).take(limit);
    const [rows,total]=await Promise.all([builder.getRawMany<Record<string,any>>(),createBuilder().getCount()]);
    if(total===0)throw new NotFoundException('Публичное портфолио не найдено');
    const cases=rows.map(row=>({
      portfolio:{id:row.portfolio_id,caseText:row.portfolio_case_text,createdAt:row.portfolio_created_at},
      work:{id:row.work_id,submission:row.work_submission,resultUrl:row.work_result_url},
      task:{id:row.task_id,title:row.task_title,skill:row.task_skill,company:{id:row.company_id,name:row.company_name}},
      review:{id:row.review_id,body:row.review_body,rating:Number(row.review_rating)},
    }));
    return {name:`${student.firstName} ${student.lastName}`,cases,total,offset,limit,hasMore:offset+cases.length<total};
  }

  async tests(actor:Actor, query?:CareerTestListQuery) {
    if(actor.role===UserRole.EMPLOYER)throw new ForbiddenException('Работодателю недоступны тесты допуска');
    const universityId=requireUniversityId(actor);
    if(actor.role===UserRole.STUDENT)this.student(actor);
    else await this.center(actor,universityId);
    const toPublicTest=(test:CareerTest)=>({id:test.id,title:test.title,skill:test.skill,passingPercent:test.passingPercent,questions:test.questions.map(question=>({prompt:question.prompt,options:question.options}))});
    const options=query||{};const hasPageParams=query!==undefined&&(options.offset!==undefined||options.limit!==undefined||options.q!==undefined);
    if(!hasPageParams){
      const tests=await this.repo(CareerTest).find({where:{universityId},order:{createdAt:'DESC',id:'DESC'},take:100});
      return tests.map(toPublicTest);
    }
    const offset=options.offset===undefined?0:Number(options.offset);const limit=options.limit===undefined?20:Number(options.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение списка тестов');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы тестов должен быть от 1 до 50');
    const builder=this.repo(CareerTest).createQueryBuilder('test').where('test.universityId = :universityId',{universityId});
    const search=options.q?.trim().slice(0,160).toLocaleLowerCase('ru-RU');
    if(search)builder.andWhere('(LOWER(test.title) LIKE :testSearch OR LOWER(test.skill) LIKE :testSearch)',{testSearch:`%${search}%`});
    builder.orderBy('test.createdAt','DESC').addOrderBy('test.id','DESC').skip(offset).take(limit);
    const [tests,total]=await builder.getManyAndCount();
    let attemptsByTest = new Map<string, number>();
    if (actor.role === UserRole.STUDENT && tests.length) {
      const attempts = await this.repo(CareerTestAttempt)
        .createQueryBuilder('attempt')
        .select('attempt.testId', 'testId')
        .addSelect('COUNT(attempt.id)', 'attemptCount')
        .where('attempt.studentId = :studentId', { studentId: actor.id })
        .andWhere('attempt.testId IN (:...testIds)', { testIds: tests.map(test => test.id) })
        .andWhere('attempt.createdAt >= :windowStart', {
          windowStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .groupBy('attempt.testId')
        .getRawMany<{ testId: string; attemptCount: string }>();
      attemptsByTest = new Map(attempts.map(attempt => [attempt.testId, Number(attempt.attemptCount)]));
    }
    const items = tests.map(test => ({
      ...toPublicTest(test),
      ...(actor.role === UserRole.STUDENT
        ? { remainingAttempts: Math.max(0, 3 - (attemptsByTest.get(test.id) || 0)) }
        : {}),
    }));
    return {items,total,offset,limit,hasMore:offset+tests.length<total};
  }
  async createTest(actor:Actor,dto:CareerTestDto) {
    const universityId=requireUniversityId(actor);await this.center(actor,universityId,true);
    const skill=dto.skill.trim().toLowerCase();if(dto.questions.some(q=>q.answer>=q.options.length||new Set(q.options.map(o=>o.trim())).size!==q.options.length||q.options.some(o=>!o.trim())))throw new BadRequestException('Укажите существующий правильный вариант');
    if(await this.repo(CareerTest).existsBy({universityId,skill}))throw new ConflictException('Тест направления уже существует');
    const test=await this.repo(CareerTest).save({...dto,skill,universityId});return {id:test.id,title:test.title};
  }
  async attempt(actor:Actor,id:string,dto:CareerAttemptDto) {
    const universityId=this.student(actor);
    if(!await this.repo(CareerProfile).existsBy({studentId:actor.id,verification:'verified'}))throw new ForbiddenException('Сначала подтвердите профессиональный профиль');
    return this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`career-test:${actor.id}`]);
      const test=await this.repo(CareerTest,m).findOneBy({id,universityId});if(!test)throw new NotFoundException();
      if(dto.answers.length!==test.questions.length||dto.answers.some((a,i)=>a>=test.questions[i].options.length))throw new BadRequestException('Ответьте на каждый вопрос');
      if(await this.repo(CareerTestAttempt,m).countBy({studentId:actor.id,testId:id,createdAt:MoreThanOrEqual(new Date(Date.now()-86400000))})>=3)throw new ConflictException('Доступно три попытки за 24 часа');
      const score=Math.round(test.questions.filter((q,i)=>q.answer===dto.answers[i]).length*100/test.questions.length);const passed=score>=test.passingPercent;
      const attempt=await this.repo(CareerTestAttempt,m).save({testId:id,studentId:actor.id,score,passed});
      if(passed){const old=await this.repo(CareerAdmission,m).findOneBy({studentId:actor.id,skill:test.skill});await this.repo(CareerAdmission,m).save({...old,studentId:actor.id,universityId,skill:test.skill,evidence:`Тест: ${test.title}`,state:'approved',basis:'test',reason:`Подтверждено тестированием: ${score}%`});}
      return {id:attempt.id,score,passed};
    });
  }

  private async notify(manager:EntityManager,userId:string,title:string,body:string){await this.repo(CareerNotice,manager).save({userId,title,body,isRead:false});}
  private async notifyCompany(manager:EntityManager,companyId:string,title:string,body:string){const members=await this.repo(CareerMembership,manager).find({where:{companyId,revokedAt:IsNull()}});for(const userId of new Set(members.map(m=>m.userId)))await this.notify(manager,userId,title,body);}
  async readNotice(actor:Actor,id:string){const result=await this.repo(CareerNotice).update({id,userId:actor.id},{isRead:true});if(!result.affected)throw new NotFoundException();return {success:true};}
  async listNotices(actor:Actor,query:CareerNoticeListQuery) {
    const offset=query.offset===undefined?0:Number(query.offset);const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение списка уведомлений');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы уведомлений должен быть от 1 до 50');
    const builder=this.repo(CareerNotice).createQueryBuilder('notice').where('notice.userId = :userId',{userId:actor.id});
    builder.orderBy('notice.createdAt','DESC').addOrderBy('notice.id','DESC').skip(offset).take(limit);
    const [notices,total]=await builder.getManyAndCount();
    const items=notices.map(notice=>({id:notice.id,title:notice.title,body:notice.body,isRead:notice.isRead,createdAt:notice.createdAt}));
    return {items,total,offset,limit,hasMore:offset+items.length<total};
  }
  async unreadNoticeCount(actor:Actor){return {count:await this.repo(CareerNotice).countBy({userId:actor.id,isRead:false})};}

  async listUniversities(actor:Actor,requestedMode:string|undefined,query:CareerLookupQuery) {
    if(requestedMode!=='employer'||actor.role!==UserRole.EMPLOYER)throw new ForbiddenException('Список вузов доступен работодателю');
    const offset=query.offset===undefined?0:Number(query.offset);const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение списка вузов');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы вузов должен быть от 1 до 50');
    const builder=this.repo(University).createQueryBuilder('university').where('university.status = :status',{status:'active'});
    const search=query.q?.trim().toLocaleLowerCase();if(search)builder.andWhere('(LOWER(university.name) LIKE :search OR LOWER(university.city) LIKE :search)',{search:`%${search}%`});
    builder.select(['university.id','university.name','university.city']).orderBy('university.name','ASC').addOrderBy('university.id','ASC').skip(offset).take(limit);
    const [universities,total]=await builder.getManyAndCount();const items=universities.map(({id,name,city})=>({id,name,city}));
    return {items,total,offset,limit,hasMore:offset+items.length<total};
  }

  async listAssignableStaff(actor:Actor,query:CareerLookupQuery) {
    if(!actor.universityId)throw new ForbiddenException('У пользователя не указан вуз');
    await this.center(actor,actor.universityId,true);
    const offset=query.offset===undefined?0:Number(query.offset);const limit=query.limit===undefined?20:Number(query.limit);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new BadRequestException('Некорректное смещение списка сотрудников');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new BadRequestException('Размер страницы сотрудников должен быть от 1 до 50');
    const builder=this.repo(User).createQueryBuilder('user').where('user.universityId = :universityId',{universityId:actor.universityId}).andWhere('user.isActive = true').andWhere('user.role NOT IN (:...blockedRoles)',{blockedRoles:[UserRole.STUDENT,UserRole.EMPLOYER,UserRole.DEVELOPER,UserRole.SUPERADMIN]});
    const search=query.q?.trim().toLocaleLowerCase();if(search)builder.andWhere('(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search)',{search:`%${search}%`});
    builder.select(['user.id','user.firstName','user.lastName','user.role']).orderBy('user.lastName','ASC').addOrderBy('user.firstName','ASC').addOrderBy('user.id','ASC').skip(offset).take(limit);
    const [users,total]=await builder.getManyAndCount();const items=users.map(({id,firstName,lastName,role})=>({id,firstName,lastName,role}));
    return {items,total,offset,limit,hasMore:offset+items.length<total};
  }

}
