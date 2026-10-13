import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, MoreThanOrEqual } from 'typeorm';
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
    if (!await this.repo(CareerMembership).existsBy({userId:actor.id,universityId,role:In(roles)})) throw new ForbiddenException('Нужны права карьерного центра');
  }
  private async company(actor: Actor, companyId: string, owner = false, manager = this.db.manager): Promise<void> {
    if (!await this.repo(CareerMembership,manager).existsBy({userId:actor.id,companyId,role:In(owner?['company_owner']:['company_owner','company_member'])})) throw new ForbiddenException('Нет доступа к компании');
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
    const memberships = await this.repo(CareerMembership).find({where:{userId:actor.id}});
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
    const candidates=candidateProfiles.map(profile=>({...profile,name: candidateNames.find(u=>u.id===profile.studentId)?`${candidateNames.find(u=>u.id===profile.studentId)!.firstName} ${candidateNames.find(u=>u.id===profile.studentId)!.lastName}`:''}));
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
    return this.repo(CareerAdmission).save({...old,studentId:actor.id,universityId,skill,evidence:dto.evidence.trim(),state:'pending',reason:''});
  }
  async decideAdmission(actor:Actor,id:string,dto:CareerDecisionDto) {
    const admission=await this.repo(CareerAdmission).findOneBy({id}); if(!admission) throw new NotFoundException();
    await this.center(actor,admission.universityId);if(!['approved','rejected'].includes(dto.decision)||!dto.reason.trim()) throw new BadRequestException('Укажите решение и основание');
    admission.state=dto.decision;admission.reason=dto.reason;return this.repo(CareerAdmission).save(admission);
  }
  async createCompany(actor:Actor,dto:CareerCompanyDto) {
    if ([UserRole.STUDENT,UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(actor.role)) throw new ForbiddenException('Нужен рабочий аккаунт работодателя');await this.university(dto.universityId);
    if (!dto.name.trim()) throw new BadRequestException('Укажите компанию');
    return this.db.transaction(async m=>{const company=await this.repo(CareerCompany,m).save(this.repo(CareerCompany,m).create({name:dto.name.trim(),description:dto.description,createdBy:actor.id}));await this.repo(CareerMembership,m).save({userId:actor.id,companyId:company.id,universityId:null,role:'company_owner'});await this.repo(CareerPartnership,m).save({companyId:company.id,universityId:dto.universityId,state:'pending'});return company;});
  }
  async addPartnership(actor:Actor,companyId:string,universityId:string) {await this.company(actor,companyId,true);await this.university(universityId);if(await this.repo(CareerPartnership).existsBy({companyId,universityId})) throw new ConflictException('Заявка уже существует');return this.repo(CareerPartnership).save({companyId,universityId,state:'pending'});}
  async verifyPartnership(actor:Actor,id:string,dto:CareerDecisionDto) {
    const item=await this.repo(CareerPartnership).findOneBy({id});if(!item) throw new NotFoundException();await this.center(actor,item.universityId);if(await this.repo(CareerMembership).existsBy({userId:actor.id,companyId:item.companyId}))throw new ForbiddenException('Нельзя подтверждать собственную компанию');
    if(!['approved','rejected'].includes(dto.decision)) throw new BadRequestException();item.state=dto.decision==='approved'?'verified':'rejected';return this.repo(CareerPartnership).save(item);
  }
  async addMembership(actor:Actor,dto:CareerMembershipDto) {
    if(dto.companyId){await this.company(actor,dto.companyId,true);if(dto.identityConfirmed!==true)throw new BadRequestException('Подтвердите, что проверили аккаунт сотрудника');}else{await this.center(actor,requireUniversityId(actor),true);}
    if(Boolean(dto.userId)===Boolean(dto.email))throw new BadRequestException('Укажите сотрудника');const user=dto.userId?await this.repo(User).findOneBy({id:dto.userId,isActive:true}):await this.repo(User).createQueryBuilder('u').where('LOWER(u.email) = :email AND u.isActive = true',{email:dto.email!.trim().toLowerCase()}).getOne();if(!user) throw new NotFoundException('Аккаунт не найден');
    if(dto.companyId){await this.company(actor,dto.companyId,true);if(dto.role!=='company_member'||[UserRole.STUDENT,UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(user.role)) throw new BadRequestException('Нужен рабочий аккаунт сотрудника');const old=await this.repo(CareerMembership).findOneBy({userId:user.id,companyId:dto.companyId});if(old)throw new ConflictException('Сотрудник уже имеет доступ к компании');return this.repo(CareerMembership).save({userId:user.id,companyId:dto.companyId,universityId:null,role:dto.role});}
    const universityId=requireUniversityId(actor);await this.center(actor,universityId,true);
    if(user.universityId!==universityId||[UserRole.STUDENT,UserRole.EMPLOYER,UserRole.DEVELOPER,UserRole.SUPERADMIN].includes(user.role)||!['career_staff','career_admin'].includes(dto.role)||dto.role==='career_admin'&&actor.role!==UserRole.UNIVERSITY_ADMIN) throw new ForbiddenException('Недоступное назначение');
    const old=await this.repo(CareerMembership).findOneBy({userId:user.id,universityId});return this.repo(CareerMembership).save({...old,userId:user.id,companyId:null,universityId,role:dto.role});
  }
  async createTask(actor:Actor,dto:CareerTaskDto) {
    await this.company(actor,dto.companyId);await this.university(dto.universityId);
    if(!await this.repo(CareerPartnership).existsBy({companyId:dto.companyId,universityId:dto.universityId,state:'verified'})) throw new ForbiddenException('Сначала карьерный центр должен подтвердить компанию');
    if(dto.title.trim().length<5||dto.description.trim().length<20||dto.criteria.trim().length<10)throw new BadRequestException('Опишите задачу и критерии приёмки');
    if(dto.profiled&&!dto.skill.trim()) throw new BadRequestException('Для профильной задачи требуется направление');
    if(!Number.isFinite(Date.parse(dto.deadline))||new Date(dto.deadline).toISOString().slice(0,10)!==dto.deadline||dto.deadline<new Date().toISOString().slice(0,10)) throw new BadRequestException('Нужна существующая будущая дата');
    return this.repo(CareerTask).save({...dto,title:dto.title.trim(),skill:dto.skill.trim().toLowerCase(),state:'draft'});
  }
  async publishTask(actor:Actor,id:string,approve=false) {
    return this.db.transaction(async m=>{const task=await this.task(id,m,true);if(approve){await this.center(actor,task.universityId);if(await this.repo(CareerMembership,m).existsBy({userId:actor.id,companyId:task.companyId}))throw new ForbiddenException('Нельзя модерировать собственную задачу');assertCareerTransition(task.state,['review']);task.state='open';}else{await this.company(actor,task.companyId,false,m);assertCareerTransition(task.state,['draft']);task.state='review';}return this.repo(CareerTask,m).save(task);});
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
  async publishPortfolio(actor:Actor,id:string,published:boolean) {
    this.student(actor);const item=await this.repo(CareerPortfolio).findOneBy({id,studentId:actor.id});if(!item) throw new NotFoundException();const review=await this.repo(CareerReview).findOneBy({workId:item.workId});if(published&&!review?.publishAllowed) throw new ForbiddenException('Работодатель не разрешил публикацию результата');item.published=published;return this.repo(CareerPortfolio).save(item);
  }
  async publicPortfolio(studentId: string) {
    const items=await this.repo(CareerPortfolio).find({where:{studentId,published:true},take:100});
    const student=await this.repo(User).findOneBy({id:studentId,isActive:true,role:UserRole.STUDENT});
    if(!student||!items.length) throw new NotFoundException('Публичное портфолио не найдено');
    const result: Array<{id:string;title:string;skill:string;company:string|undefined;result:string;resultUrl:string;review:string;rating:number;paymentConfirmed:boolean}> = [];
    for(const item of items){const review=await this.repo(CareerReview).findOneBy({workId:item.workId,publishAllowed:true});const work=await this.repo(CareerWork).findOneBy({id:item.workId,studentId,state:'accepted'});if(!review||!work)continue;const task=await this.task(work.taskId);const company=await this.repo(CareerCompany).findOneBy({id:task.companyId});result.push({id:item.id,title:task.title,skill:task.skill,company:company?.name,result:work.submission,resultUrl:work.resultUrl,review:review.body,rating:review.rating,paymentConfirmed:false});}
    return {name:`${student.firstName} ${student.lastName}`,cases:result};
  }

  async tests(actor:Actor) {
    const universityId=requireUniversityId(actor);
    if(actor.role!==UserRole.STUDENT)await this.center(actor,universityId);
    const tests=await this.repo(CareerTest).find({where:{universityId},take:100});
    return tests.map(test=>({id:test.id,title:test.title,skill:test.skill,passingPercent:test.passingPercent,questions:test.questions.map(q=>({prompt:q.prompt,options:q.options}))}));
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
      if(passed){const old=await this.repo(CareerAdmission,m).findOneBy({studentId:actor.id,skill:test.skill});await this.repo(CareerAdmission,m).save({...old,studentId:actor.id,universityId,skill:test.skill,evidence:`Тест: ${test.title}`,state:'approved',reason:`Подтверждено тестированием: ${score}%`});}
      return {id:attempt.id,score,passed};
    });
  }

  private async notify(manager:EntityManager,userId:string,title:string,body:string){await this.repo(CareerNotice,manager).save({userId,title,body,isRead:false});}
  private async notifyCompany(manager:EntityManager,companyId:string,title:string,body:string){const members=await this.repo(CareerMembership,manager).find({where:{companyId}});for(const userId of new Set(members.map(m=>m.userId)))await this.notify(manager,userId,title,body);}
  async readNotice(actor:Actor,id:string){const result=await this.repo(CareerNotice).update({id,userId:actor.id},{isRead:true});if(!result.affected)throw new NotFoundException();return {success:true};}

}
