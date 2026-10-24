import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createCurationFixture } from './curation.fixture';
import { ProductActivityDay, ProductAnalyticsState } from '../src/analytics/analytics.entities';
import { ProductAnalyticsService } from '../src/analytics/analytics.service';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { UserRole } from '../src/auth/interfaces/user-role';
import { User } from '../src/users/entities/user.entity';
import { Lesson } from '../src/schedule/entities/lesson.entity';
import { EventRecord } from '../src/events/entities/event-record.entity';
import { ScheduleImportJob } from '../src/schedule/connectors/schedule-import-job.entity';
import { StudentRequest } from '../src/requests/request.entities';
import { CareerCompany, CareerTask, CareerWork } from '../src/career/career.entities';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from '../src/migrations/1700000000038-AccountErasure';
import { CareerModeration1700000000040 } from '../src/migrations/1700000000040-CareerModeration';
import { ProductAnalytics1700000000041 } from '../src/migrations/1700000000041-ProductAnalytics';

const suite=process.env.ANALYTICS_TEST_DATABASE_URL?describe:describe.skip;
jest.setTimeout(90000);
suite('First-party product analytics with real JWT/HTTP/PostgreSQL',()=>{
  let f:Awaited<ReturnType<typeof createCurationFixture>>;
  const ids:[string,string]=[randomUUID(),randomUUID()],tokens:Record<string,string>={};
  const query='weekStart=2026-10-12&semesterStart=2026-08-01&semesterEnd=2026-09-30';
  const http=()=>request(f.app.getHttpServer());
  const get=(actor='admin',extra='')=>http().get('/api/v1/analytics/report?'+query+extra).auth(tokens[actor],{type:'bearer'});
  const readiness=()=>http().post('/api/v1/analytics/onboarding-observation').auth(tokens.admin,{type:'bearer'}).send({startDate:'2026-10-12T00:00:00Z',endDate:'2026-10-18T23:59:59.999Z'});
  const metric=(body:any,id:string)=>body.metrics.find((item:{id:string})=>item.id===id);
  beforeAll(async()=>{
    process.env.PRODUCT_ANALYTICS_ENABLED='true';process.env.PRODUCT_ANALYTICS_UNIVERSITY_IDS=ids[0];
    f=await createCurationFixture(process.env.ANALYTICS_TEST_DATABASE_URL!,{universityIds:ids});
    const runner=f.db.createQueryRunner();try{await new PersonalDataRead1700000000037().up(runner);await new AccountErasure1700000000038().up(runner);await new CareerModeration1700000000040().up(runner);await new ProductAnalytics1700000000041().up(runner);}finally{await runner.release();}
    await f.db.getRepository(User).update(f.users.outsider.id,{role:UserRole.UNIVERSITY_ADMIN});
    for(const actor of ['admin','student','peer','teacher','outsider']){const response=await http().post('/api/v1/auth/login').send({email:f.users[actor].email,password:f.password}).expect(200);tokens[actor]=response.body.accessToken;}
  });
  afterAll(async()=>{await f?.app.close();delete process.env.PRODUCT_ANALYTICS_ENABLED;delete process.env.PRODUCT_ANALYTICS_UNIVERSITY_IDS;});
  it('starts without data when disabled and requires an allowlisted university',async()=>{
    const prior=process.env.PRODUCT_ANALYTICS_ENABLED;let disabled:ProductAnalyticsService;
    try{process.env.PRODUCT_ANALYTICS_ENABLED='false';disabled=new ProductAnalyticsService(f.db,new ConfigService(),f.app.get(TenantContext));}finally{process.env.PRODUCT_ANALYTICS_ENABLED=prior;}
    await disabled.recordActivity(f.users.student);
    expect(await f.db.getRepository(ProductActivityDay).count()).toBe(0);
    const report=await disabled.report(f.users.admin,{weekStart:'2026-10-12',semesterStart:'2026-08-01',semesterEnd:'2026-09-30'});
    expect(report.enabled).toBe(false);expect(report.metrics).toHaveLength(10);expect(report.metrics.every(item=>item.value===null)).toBe(true);
    expect((await get('outsider').expect(200)).body).toMatchObject({enabled:false,coverage:null});
  });
  it('protects both analytics tables with FORCE RLS and four restrictive policies',async()=>{
    const rows=await f.db.query(`SELECT relname,relrowsecurity,relforcerowsecurity,(SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid AND NOT polpermissive) AS restrictive FROM pg_class c WHERE relname IN ('product_activity_days','product_analytics_state')`);
    expect(rows).toHaveLength(2);for(const row of rows)expect(row).toMatchObject({relrowsecurity:true,relforcerowsecurity:true,restrictive:4});
    expect((await f.db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'))[0]).toEqual({rolsuper:false,rolbypassrls:false});
  });
  it('records successful campus use once per day, excludes failures and background requests',async()=>{
    await http().get('/api/v1/users/me').auth(tokens.student,{type:'bearer'}).expect(200);
    expect(await f.db.getRepository(ProductActivityDay).count()).toBe(0);
    await http().get('/api/v1/schedule/lessons/'+randomUUID()).auth(tokens.student,{type:'bearer'}).expect(404);
    expect(await f.db.getRepository(ProductActivityDay).count()).toBe(0);
    for(let i=0;i<2;i++)await http().get('/api/v1/schedule/range?startDate=2026-10-12T00:00:00Z&endDate=2026-10-18T23:59:59Z').auth(tokens.student,{type:'bearer'}).expect(200);
    expect(await f.db.getRepository(ProductActivityDay).countBy({userId:f.users.student.id})).toBe(1);
    const raw=f.app.get(DataSource),tenant=f.app.get(TenantContext);
    await tenant.runInRequest(async()=>{tenant.setUser({...f.users.outsider,role:UserRole.UNIVERSITY_ADMIN});expect(await raw.query('SELECT id FROM product_activity_days')).toEqual([]);});
  });
  it('requires university administrator, validates periods and rejects client-supplied tenant selectors',async()=>{
    await http().get('/api/v1/analytics/report?'+query).expect(401);
    for(const actor of ['student','teacher'])await get(actor).expect(403);
    await get('admin','&universityId='+ids[1]).expect(400);
    await get('admin','&semesterEnd=not-a-date').expect(400);
    await http().post('/api/v1/analytics/onboarding-observation').auth(tokens.admin,{type:'bearer'}).send({startDate:'2026-10-12T00:00:00Z',endDate:'2026-10-12T00:00:00Z'}).expect(400);
    await http().post('/api/v1/analytics/onboarding-observation').auth(tokens.student,{type:'bearer'}).send({startDate:'2026-10-12',endDate:'2026-10-18'}).expect(403);
  });
  it('computes ten scoped metrics, real retention cohorts and explicit unknown QR coverage',async()=>{
    await f.db.getRepository(ProductAnalyticsState).save({universityId:ids[0],collectionStartedAt:new Date('2026-07-01T00:00:00Z')});
    for(const [actor,day] of [['student','2026-08-02'],['peer','2026-08-03'],['student','2026-09-28'],['student','2026-10-12'],['peer','2026-10-13'],['teacher','2026-10-14'],['outsider','2026-10-14']])await f.db.getRepository(ProductActivityDay).save({universityId:actor==='outsider'?ids[1]:ids[0],userId:f.users[actor].id,day,role:actor==='teacher'?'teacher':'student'});
    const at=new Date('2026-10-14T12:00:00Z');
    for(const [source,records] of [['qr',2],['manual',6],['unknown',9]] as const)await f.db.getRepository(EventRecord).save({id:randomUUID(),universityId:ids[0],type:'attendance.updated',timestamp:at,actor:{type:'user',id:f.users.teacher.id},target:{type:'lesson',id:f.lesson.id},payload:{source,records,privateText:'NEVER_RETURN_EVENT_PAYLOAD'},priority:'normal'});
    for(let i=0;i<2;i++)await f.db.getRepository(EventRecord).save({id:randomUUID(),universityId:ids[0],type:'homework.created',timestamp:at,actor:{type:'system'},target:{type:'homework',id:randomUUID()},payload:{},priority:'normal'});
    await f.db.getRepository(EventRecord).save({id:randomUUID(),universityId:ids[1],type:'attendance.updated',timestamp:at,actor:{type:'system'},target:{type:'lesson',id:f.lesson.id},payload:{source:'qr',records:1000},priority:'normal'});
    for(const status of ['completed','completed','failed','queued'] as const){const job=await f.db.getRepository(ScheduleImportJob).save({universityId:ids[0],actorId:f.users.admin.id,idempotencyKey:randomUUID(),payloadHash:randomUUID(),status});await f.db.query('UPDATE schedule_import_jobs SET "updatedAt"=$1 WHERE id=$2',[at,job.id]);}
    for(const dueAt of [new Date('2026-10-15T00:00:00Z'),new Date('2026-10-13T00:00:00Z')])await f.db.getRepository(StudentRequest).save({universityId:ids[0],studentId:f.users.student.id,groupId:f.groups[0].id,facultyId:f.groups[0].facultyId,type:'absence',status:'closed',title:'Синтетическое заявление',description:'НЕ ВОЗВРАЩАТЬ ТЕКСТ ЗАЯВЛЕНИЯ',createdBy:f.users.student.id,createKey:randomUUID(),createHash:'synthetic',dueAt,closedAt:at});
    const company=await f.db.getRepository(CareerCompany).save({name:'Синтетическая компания',createdBy:f.users.admin.id});
    const task=await f.db.getRepository(CareerTask).save({companyId:company.id,universityId:ids[0],title:'Синтетическая задача',description:'Условия тестовой задачи',criteria:'Тестовые критерии',rewardKopecks:100000,hours:10,deadline:'2026-12-31'});
    for(const [index,state] of ['accepted','in_progress'].entries()){const workTask=index?await f.db.getRepository(CareerTask).save({...task,id:randomUUID()}):task;const work=await f.db.getRepository(CareerWork).save({taskId:workTask.id,studentId:index?f.users.peer.id:f.users.student.id,state});await f.db.query('UPDATE career_work SET "createdAt"=$1 WHERE id=$2',[at,work.id]);}
    await f.db.getRepository(Lesson).save({...f.lesson,id:randomUUID(),startDate:at,endDate:new Date(at.getTime()+3600000)});
    const response=await get().expect(200),body=response.body;
    expect(response.headers['cache-control']).toBe('no-store, private');expect(body.metrics).toHaveLength(10);
    expect(metric(body,'semester_retention')).toMatchObject({value:50,numerator:1,denominator:2});
    expect(metric(body,'weekly_active_users').value).toBe(3);
    expect(metric(body,'weekly_active_students_share').numerator).toBe(2);
    expect(metric(body,'onboarding_hours')).toMatchObject({value:null,reason:'readiness_not_observed'});
    expect(metric(body,'qr_mark_share')).toMatchObject({value:25,numerator:2,denominator:8,partial:true});expect(body.coverage.qrUnknownRecords).toBe(9);
    expect(metric(body,'homework_publications').value).toBe(2);
    expect(metric(body,'schedule_import_success')).toMatchObject({value:66.67,numerator:2,denominator:3});
    expect(metric(body,'office_on_time_closure').value).toBe(50);
    expect(metric(body,'career_accepted_work_share').value).toBe(50);
    expect(metric(body,'schedule_group_coverage')).toMatchObject({value:33.33,numerator:1,denominator:3});
    expect(JSON.stringify(body)).not.toMatch(/NEVER_RETURN|НЕ ВОЗВРАЩАТЬ|passwordHash|userId/);
  });
  it('does not fabricate retention for a future semester or an unobserved cohort',async()=>{
    const future=await http().get('/api/v1/analytics/report?weekStart=2099-10-12&semesterStart=2099-09-01&semesterEnd=2099-12-31').auth(tokens.admin,{type:'bearer'}).expect(200);
    expect(metric(future.body,'semester_retention')).toMatchObject({value:null,reason:'period_in_progress'});
    const empty=await http().get('/api/v1/analytics/report?weekStart=2026-10-12&semesterStart=2026-07-01&semesterEnd=2026-07-31').auth(tokens.admin,{type:'bearer'}).expect(200);
    expect(metric(empty.body,'semester_retention')).toMatchObject({value:null,reason:'empty_cohort'});
  });
  it('records first readiness only after every group has lessons and a valid teacher',async()=>{
    expect((await readiness().expect(201)).body.ready).toBe(false);
    await f.db.getRepository(Lesson).save({...f.lesson,id:randomUUID(),groupId:f.groups[1].id,teacherId:null,startDate:new Date('2026-10-11T23:30:00Z'),endDate:new Date('2026-10-12T00:30:00Z')});
    expect((await readiness().expect(201)).body.ready).toBe(false);
    expect(metric((await get().expect(200)).body,'schedule_group_coverage')).toMatchObject({numerator:1,denominator:3});
    for(const group of f.groups.slice(1,3))await f.db.getRepository(Lesson).save({...f.lesson,id:randomUUID(),groupId:group.id,startDate:new Date('2026-10-14T12:00:00Z'),endDate:new Date('2026-10-14T13:00:00Z')});
    const first=(await readiness().expect(201)).body;expect(first.ready).toBe(true);expect(first.recordedAt).toBeTruthy();
    expect((await readiness().expect(201)).body.recordedAt).toBe(first.recordedAt);
    expect(metric((await get().expect(200)).body,'onboarding_hours').value).toBeGreaterThanOrEqual(0);
  });
  it('purges expired daily activity only in configured universities',async()=>{
    await f.db.getRepository(ProductActivityDay).save([{universityId:ids[0],userId:f.users.peer.id,day:'2024-01-01',role:'student'},{universityId:ids[1],userId:f.users.outsider.id,day:'2024-01-01',role:'teacher'}]);
    const previous=process.env.PRODUCT_ANALYTICS_ENABLED;let cleaner:ProductAnalyticsService;
    try{process.env.PRODUCT_ANALYTICS_ENABLED='false';cleaner=new ProductAnalyticsService(f.app.get(DataSource),new ConfigService(),f.app.get(TenantContext));}finally{process.env.PRODUCT_ANALYTICS_ENABLED=previous;}
    expect(cleaner.enabledFor(ids[0])).toBe(false);await cleaner.purgeExpired();
    expect(await f.db.getRepository(ProductActivityDay).countBy({universityId:ids[0],day:'2024-01-01'})).toBe(0);
    expect(await f.db.getRepository(ProductActivityDay).countBy({universityId:ids[1],day:'2024-01-01'})).toBe(1);
  });
  it('exports old-university activity, erases only own rows and prevents a stale writer',async()=>{
    await f.db.getRepository(ProductActivityDay).save({universityId:ids[1],userId:f.users.student.id,day:'2026-10-10',role:'student'});
    const exported=await http().get('/api/v1/users/me/export').auth(tokens.student,{type:'bearer'}).expect(200);
    expect(exported.body.complete).toBe(true);expect(exported.body.datasets.product_activity_days.some((row:{universityId:string})=>row.universityId===ids[1])).toBe(true);
    const peerCount=await f.db.getRepository(ProductActivityDay).countBy({userId:f.users.peer.id});
    await http().delete('/api/v1/users/me').auth(tokens.student,{type:'bearer'}).send({expectedUserId:f.users.student.id,currentPassword:f.password,confirmed:true,acknowledgeRetention:true}).expect(200);
    expect(await f.db.getRepository(ProductActivityDay).countBy({userId:f.users.student.id})).toBe(0);
    expect(await f.db.getRepository(ProductActivityDay).countBy({userId:f.users.peer.id})).toBe(peerCount);
    const tenant=f.app.get(TenantContext);
    await expect(tenant.runInRequest(async()=>{tenant.setUser(f.users.student);await f.app.get(ProductAnalyticsService).recordActivity(f.users.student);})).rejects.toThrow();
    expect(await f.db.getRepository(ProductActivityDay).countBy({userId:f.users.student.id})).toBe(0);
  });
});
