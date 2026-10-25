import * as request from 'supertest';
import { createCurationFixture } from './curation.fixture';
import { CareerApplication, CareerCompany, CareerMembership, CareerPartnership, CareerProfile, CareerTask, CareerTaskComplaint, CareerWork } from '../src/career/career.entities';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { AuditLog } from '../src/common/entities/audit-log.entity';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from '../src/migrations/1700000000038-AccountErasure';
import { CareerModeration1700000000040 } from '../src/migrations/1700000000040-CareerModeration';

const suite = process.env.CAREER_MODERATION_TEST_DATABASE_URL ? describe : describe.skip;
jest.setTimeout(90000);
suite('Career moderation, student complaints and tenant isolation with real JWT/PostgreSQL', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>, companyId: string, ordinaryId: string, flaggedId: string, complaintId: string;
  const tokens: Record<string,string> = {};
  let ip=0;
  const http=()=>request(f.app.getHttpServer());
  const post=(path:string,actor:string,body:object={})=>http().post('/api/v1/career/'+path).auth(tokens[actor],{type:'bearer'}).set('X-Forwarded-For',`192.0.2.${++ip}`).send(body);
  const get=(path:string,actor:string)=>http().get('/api/v1/career/'+path).auth(tokens[actor],{type:'bearer'});
  const draft=(extra:object={})=>({companyId,universityId:f.uni.id,title:'Макет учебного проекта',description:'Подготовить доступный макет трёх страниц для согласования',criteria:'Передать исходники и размеры макета',requirements:'',level:'standard',rewardKopecks:100000,hours:10,deadline:'2099-12-01',profiled:false,skill:'',...extra});
  const create=async(extra:object={})=>(await post('tasks','employer',draft(extra)).expect(201)).body;
  beforeAll(async()=>{
    f=await createCurationFixture(process.env.CAREER_MODERATION_TEST_DATABASE_URL!);f.app.getHttpAdapter().getInstance().set('trust proxy',true);
    const runner=f.db.createQueryRunner();try{await new PersonalDataRead1700000000037().up(runner);await new AccountErasure1700000000038().up(runner);await new CareerModeration1700000000040().up(runner);}finally{await runner.release();}
    await f.db.getRepository(User).update(f.users.outsider.id,{role:UserRole.CAREER_STAFF});
    const employer=await f.db.getRepository(User).save({email:'moderation-employer@example.test',firstName:'Синтетический',lastName:'Работодатель',passwordHash:f.users.student.passwordHash,role:UserRole.EMPLOYER,universityId:null});
    const foreignStudent=await f.db.getRepository(User).save({email:'moderation-foreign@example.test',firstName:'Синтетический',lastName:'Студент',passwordHash:f.users.student.passwordHash,role:UserRole.STUDENT,universityId:f.otherUni.id,groupId:f.groups[3].id});
    companyId=(await f.db.getRepository(CareerCompany).save({name:'Синтетическая компания',createdBy:employer.id})).id;
    await f.db.getRepository(CareerMembership).save([{userId:employer.id,companyId,role:'company_owner',universityId:null},{userId:f.users.teacher.id,companyId,role:'company_member',universityId:null},{userId:f.users.teacher.id,companyId:null,universityId:f.uni.id,role:'career_staff'}]);
    await f.db.getRepository(CareerPartnership).save({companyId,universityId:f.uni.id,state:'verified'});
    await f.db.getRepository(CareerProfile).save({studentId:f.users.student.id,universityId:f.uni.id,headline:'Синтетический профиль',about:'',skills:[],verification:'verified'});
    for(const actor of ['employer','student','peer','admin','teacher','outsider','foreignStudent']){const user=actor==='employer'?employer:actor==='foreignStudent'?foreignStudent:f.users[actor];const login=await http().post('/api/v1/auth/login').send({email:user.email,password:f.password}).expect(200);tokens[actor]=login.body.accessToken;}
  });
  afterAll(async()=>{await f?.app.close();});

  it('uses FORCE RLS and four restrictive policies for the complaint table',async()=>{
    const [security]=await f.db.query(`SELECT relrowsecurity,relforcerowsecurity,(SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid AND NOT polpermissive) AS restrictive FROM pg_class c WHERE relname='career_task_complaint'`);
    expect(security).toEqual({relrowsecurity:true,relforcerowsecurity:true,restrictive:4});
    const [role]=await f.db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');expect(role).toEqual({rolsuper:false,rolbypassrls:false});
  });
  it('retains manual review for an ordinary task and preserves the initial legacy approval contract',async()=>{
    ordinaryId=(await create()).id;
    const queued=await post(`tasks/${ordinaryId}/publish`,'employer').expect(201);expect(queued.body).toMatchObject({state:'review',moderationStatus:'pending',moderationFlags:[]});
    await post(`tasks/${ordinaryId}/approve`,'student').expect(403);
    await post(`tasks/${ordinaryId}/approve`,'teacher').expect(403);
    await post(`tasks/${ordinaryId}/approve`,'outsider').expect(404);
    expect((await post(`tasks/${ordinaryId}/approve`,'admin').expect(201)).body).toMatchObject({state:'open',moderationStatus:'approved'});
  });
  it('requires explicit reasons for flagged decisions and current content version after correction',async()=>{
    flaggedId=(await create({description:'Нужен депозит за получение доступа к материалам проекта',rewardKopecks:10000000,hours:1})).id;
    const queued=await post(`tasks/${flaggedId}/publish`,'employer').expect(201);expect(queued.body.moderationFlags).toEqual(expect.arrayContaining(['upfront_payment','high_reward','high_hourly_rate']));
    await post(`tasks/${flaggedId}/approve`,'admin').expect(409);
    await post(`moderation/tasks/${flaggedId}/decision`,'admin',{decision:'approve',expectedVersion:1}).expect(400);
    expect((await post(`moderation/tasks/${flaggedId}/decision`,'admin',{decision:'reject',expectedVersion:1,reason:'Уберите оплату доступа и уточните условия задачи'}).expect(201)).body.state).toBe('draft');
    await post(`tasks/${flaggedId}/publish`,'employer').expect(409);
    const {companyId:ignoredCompany,universityId:ignoredUniversity,...revision}=draft({description:'Исправленный доступный макет без оплаты доступа со стороны исполнителя'});void ignoredCompany;void ignoredUniversity;
    const edit=await http().patch(`/api/v1/career/tasks/${flaggedId}`).auth(tokens.employer,{type:'bearer'}).send({...revision,expectedVersion:1}).expect(200);expect(edit.body.moderationContentVersion).toBe(2);
    await http().patch(`/api/v1/career/tasks/${flaggedId}`).auth(tokens.employer,{type:'bearer'}).send({...revision,expectedVersion:1}).expect(409);
    await post(`tasks/${flaggedId}/publish`,'employer').expect(201);
    await post(`moderation/tasks/${flaggedId}/decision`,'admin',{decision:'approve',expectedVersion:1,reason:'Условия подробно проверены сотрудником центра'}).expect(409);
    await post(`moderation/tasks/${flaggedId}/decision`,'admin',{decision:'approve',expectedVersion:2,reason:'Условия подробно проверены сотрудником центра'}).expect(201);
    expect(await f.db.getRepository(AuditLog).countBy({entity:'career_task',entityId:flaggedId})).toBeGreaterThanOrEqual(5);
  });
  it('accepts only student reports on visible own-university tasks and never exposes another student report',async()=>{
    await post(`tasks/${ordinaryId}/complaints`,'employer',{category:'unsafe',details:'Синтетическое описание жалобы'}).expect(403);
    await post(`tasks/${ordinaryId}/complaints`,'foreignStudent',{category:'unsafe',details:'Синтетическое описание жалобы'}).expect(404);
    await post(`tasks/${ordinaryId}/complaints`,'student',{category:'unsafe',details:'Синтетическое описание жалобы',studentId:f.users.peer.id}).expect(400);
    const own=await post(`tasks/${ordinaryId}/complaints`,'student',{category:'prepayment',details:'OWN_PRIVATE_COMPLAINT_DETAILS'}).expect(201);complaintId=own.body.id;
    expect(own.body.taskSnapshot.description).toBe(draft().description);
    await post(`tasks/${ordinaryId}/complaints`,'student',{category:'prepayment',details:'Повторная синтетическая жалоба'}).expect(409);
    await post(`tasks/${ordinaryId}/complaints`,'peer',{category:'other',details:'KEEP_PEER_PRIVATE_COMPLAINT'}).expect(201);
    const mine=await get('complaints/my','student').expect(200);expect(mine.body.items).toHaveLength(1);expect(mine.body.items[0].id).toBe(complaintId);expect(JSON.stringify(mine.body)).not.toContain('KEEP_PEER');
    expect((await get(`complaints/my?taskId=${flaggedId}`,'student').expect(200)).body.total).toBe(0);
    await get('moderation/complaints','employer').expect(403);expect((await get('moderation/complaints','outsider').expect(200)).body.total).toBe(0);
    expect((await f.db.getRepository(CareerTask).findOneByOrFail({id:ordinaryId})).state).toBe('open');
  });
  it('upholds a report atomically, suspends new applications and does not delete pending applications',async()=>{
    await post(`tasks/${ordinaryId}/apply`,'student',{message:'Готов выполнить задачу по указанным критериям'}).expect(201);
    const application=await f.db.getRepository(CareerApplication).findOneByOrFail({taskId:ordinaryId,studentId:f.users.student.id});
    await post(`moderation/complaints/${complaintId}/decision`,'teacher',{decision:'uphold',reason:'Синтетическое подтверждение нарушения'}).expect(403);
    await post(`moderation/complaints/${complaintId}/decision`,'admin',{decision:'uphold',reason:'Условия требуют исправления перед новыми откликами'}).expect(201);
    expect((await f.db.getRepository(CareerTask).findOneByOrFail({id:ordinaryId}))).toMatchObject({state:'review',moderationStatus:'suspended'});
    await post(`tasks/${ordinaryId}/apply`,'peer',{message:'Готов выполнить задачу по указанным критериям'}).expect(409);
    await post(`applications/${application.id}/select`,'employer').expect(409);
    await post(`moderation/tasks/${ordinaryId}/decision`,'admin',{decision:'reject',expectedVersion:1,reason:'Нельзя изменять условия после появления отклика'}).expect(409);
    expect((await f.db.getRepository(CareerTask).findOneByOrFail({id:ordinaryId}))).toMatchObject({state:'review',moderationStatus:'suspended'});
    expect((await f.db.getRepository(CareerApplication).findOneByOrFail({id:application.id})).state).toBe('pending');
  });
  it('preserves an existing student work when a later complaint is upheld',async()=>{
    const id=(await create()).id;await post(`tasks/${id}/publish`,'employer').expect(201);await post(`tasks/${id}/approve`,'admin').expect(201);
    const application=await post(`tasks/${id}/apply`,'student',{message:'Выполню задачу с учётом критериев приёмки'}).expect(201);
    await post(`applications/${application.body.id}/select`,'employer').expect(201);
    const work=await f.db.getRepository(CareerWork).findOneByOrFail({taskId:id});
    const complaint=await post(`tasks/${id}/complaints`,'student',{category:'misleading',details:'Синтетическое расхождение с условиями задачи'}).expect(201);
    await post(`moderation/complaints/${complaint.body.id}/decision`,'admin',{decision:'uphold',reason:'Нужна дополнительная проверка условий выполнения'}).expect(201);
    expect((await f.db.getRepository(CareerTask).findOneByOrFail({id}))).toMatchObject({state:'assigned',moderationStatus:'suspended'});
    expect((await f.db.getRepository(CareerWork).findOneByOrFail({id:work.id})).state).toBe('in_progress');
  });
  it('rolls back approval if the audit write fails',async()=>{
    const id=(await create()).id;await post(`tasks/${id}/publish`,'employer').expect(201);
    await f.db.query(`ALTER TABLE audit_logs ADD CONSTRAINT synthetic_moderation_audit CHECK (action<>'career.task.approve') NOT VALID`);
    try{await post(`tasks/${id}/approve`,'admin').expect(500);expect((await f.db.getRepository(CareerTask).findOneByOrFail({id}))).toMatchObject({state:'review',moderationStatus:'pending'});}
    finally{await f.db.query('ALTER TABLE audit_logs DROP CONSTRAINT synthetic_moderation_audit');}
  });
  it('waits for the task mutation lock and refuses an application after suspension commits',async()=>{
    const id=(await create()).id;await post(`tasks/${id}/publish`,'employer').expect(201);await post(`tasks/${id}/approve`,'admin').expect(201);
    const gate=f.db.createQueryRunner();let pending:Promise<request.Response>|undefined;let finished:number|undefined;
    try{
      await gate.connect();await gate.startTransaction();const locked=await gate.query('SELECT id FROM career_task WHERE id=$1 FOR UPDATE',[id]);expect(locked).toHaveLength(1);
      const [{pid:gatePid}]=await gate.query('SELECT pg_backend_pid() AS pid');
      pending=post(`tasks/${id}/apply`,'student',{message:'Синтетический конкурентный отклик на задачу'}).then(response=>{finished=response.status;return response;});
      let blocked=false;
      for(let attempt=0;attempt<200;attempt++){
        // pg_stat_activity.query may truncate a wide entity SELECT before its FROM.
        // Observe this transaction as the actual blocker instead of matching SQL text.
        const [state]=await f.db.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))`,[gatePid]);
        if(state.count){blocked=true;break;}if(finished!==undefined)break;await new Promise(resolve=>setTimeout(resolve,20));
      }
      if(!blocked){const activity=await f.db.query(`SELECT pid,state,wait_event_type,wait_event,left(query,250) AS query FROM pg_stat_activity WHERE datname=current_database()`);throw new Error(`Application did not wait for task lock: ${JSON.stringify({finished,body:finished!==undefined?(await pending).body:null,activity})}`);}
      await gate.query('UPDATE career_task SET state=$2,"moderationStatus"=$3 WHERE id=$1',[id,'review','suspended']);await gate.commitTransaction();
    }finally{if(gate.isTransactionActive)await gate.rollbackTransaction();await gate.release();}
    expect((await pending!).status).toBe(409);expect(await f.db.getRepository(CareerApplication).countBy({taskId:id})).toBe(0);
  });
  it('rejects a complaint whose university differs from the referenced task even with maintenance capability',async()=>{
    await expect(f.db.getRepository(CareerTaskComplaint).save({universityId:f.otherUni.id,taskId:ordinaryId,studentId:f.users.student.id,category:'other',details:'Synthetic impossible relation'})).rejects.toThrow();
  });
  it('exports old-university own complaints and scrubs their text on actual account deletion',async()=>{
    const task=await f.db.getRepository(CareerTask).save({...draft(),universityId:f.otherUni.id,state:'open'});
    const old=await f.db.getRepository(CareerTaskComplaint).save({universityId:f.otherUni.id,taskId:task.id,studentId:f.users.student.id,category:'other',details:'OWN_OLD_UNIVERSITY_COMPLAINT'});
    const exported=await http().get('/api/v1/users/me/export').auth(tokens.student,{type:'bearer'}).expect(200);
    expect(exported.body.complete).toBe(true);expect(JSON.stringify(exported.body.datasets.career_task_complaint)).toContain('OWN_OLD_UNIVERSITY_COMPLAINT');
    await http().delete('/api/v1/users/me').auth(tokens.student,{type:'bearer'}).send({expectedUserId:f.users.student.id,currentPassword:f.password,confirmed:true,acknowledgeRetention:true}).expect(200);
    expect((await f.db.getRepository(CareerTaskComplaint).findOneByOrFail({id:old.id})).details).toBe('[Текст жалобы удалён пользователем]');
    expect((await f.db.getRepository(CareerTaskComplaint).findOneByOrFail({id:complaintId})).details).toBe('[Текст жалобы удалён пользователем]');
    expect(await f.db.getRepository(CareerTaskComplaint).existsBy({studentId:f.users.peer.id,details:'KEEP_PEER_PRIVATE_COMPLAINT'})).toBe(true);
  });
});
