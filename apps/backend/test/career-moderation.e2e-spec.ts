import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { CareerVacancyApplication } from '../src/career/vacancies.entity';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { Lesson } from '../src/schedule/entities/lesson.entity';
import { createCurationFixture } from './curation.fixture';
import { CareerApplication, CareerCompany, CareerMembership, CareerPartnership, CareerProfile, CareerTask, CareerTaskComplaint, CareerWork } from '../src/career/career.entities';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { Favorite, CAREER_FAVORITE_KIND } from '../src/favorites/entities/favorite.entity';
import { CareerTaskFavorites1700000000051 } from '../src/migrations/1700000000051-CareerTaskFavorites';
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
  const draft=(extra:object={})=>({companyId,organizationId:f.uni.id,title:'Макет учебного проекта',description:'Подготовить доступный макет трёх страниц для согласования',criteria:'Передать исходники и размеры макета',requirements:'',level:'standard',rewardKopecks:100000,hours:10,deadline:'2099-12-01',profiled:false,skill:'',...extra});
  const create=async(extra:object={})=>(await post('tasks','employer',draft(extra)).expect(201)).body;
  beforeAll(async()=>{
    f=await createCurationFixture(process.env.CAREER_MODERATION_TEST_DATABASE_URL!);f.app.getHttpAdapter().getInstance().set('trust proxy',true);
    const runner=f.db.createQueryRunner();try{await new PersonalDataRead1700000000037().up(runner);await new AccountErasure1700000000038().up(runner);await new CareerModeration1700000000040().up(runner);await new CareerTaskFavorites1700000000051().up(runner);}finally{await runner.release();}
    await f.db.getRepository(User).update(f.users.outsider.id,{role:UserRole.CAREER_STAFF});
    const employer=await f.db.getRepository(User).save({email:'moderation-employer@example.test',firstName:'Синтетический',lastName:'Работодатель',passwordHash:f.users.student.passwordHash,role:UserRole.EMPLOYER,organizationId:null});
    const foreignStudent=await f.db.getRepository(User).save({email:'moderation-foreign@example.test',firstName:'Синтетический',lastName:'Студент',passwordHash:f.users.student.passwordHash,role:UserRole.STUDENT,organizationId:f.otherUni.id,groupId:f.groups[3].id});
    companyId=(await f.db.getRepository(CareerCompany).save({name:'Синтетическая компания',createdBy:employer.id})).id;
    await f.db.getRepository(CareerMembership).save([{userId:employer.id,companyId,role:'company_owner',organizationId:null},{userId:f.users.teacher.id,companyId,role:'company_member',organizationId:null},{userId:f.users.teacher.id,companyId:null,organizationId:f.uni.id,role:'career_staff'}]);
    await f.db.getRepository(CareerPartnership).save({companyId,organizationId:f.uni.id,state:'verified'});
    await f.db.getRepository(CareerProfile).save({studentId:f.users.student.id,organizationId:f.uni.id,headline:'Синтетический профиль',about:'',skills:[],verification:'verified'});
    for(const actor of ['employer','student','peer','admin','teacher','outsider','foreignStudent']){const user=actor==='employer'?employer:actor==='foreignStudent'?foreignStudent:f.users[actor];const login=await http().post('/api/v1/auth/login').send({email:user.email,password:f.password}).expect(200);tokens[actor]=login.body.accessToken;}
  });
  afterAll(async()=>{await f?.app.close();});

  it('publishes a vacancy, transfers a resume and only confirms an available interview', async () => {
    const api = (verb: 'get' | 'post' | 'put' | 'patch', path: string, actor: string) =>
      http()[verb](`/api/v1/career/vacancies${path}`).auth(tokens[actor], { type: 'bearer' });
    const vacancyInput = {
      companyId, organizationId: f.uni.id, title: 'Стажировка аналитика',
      description: 'Подготовка аналитических отчётов. Условия обсуждаются на встрече.', kind: 'internship',
    };

    await api('post', '', 'student').send(vacancyInput).expect(403);
    const { body: vacancy } = await api('post', '', 'employer').send(vacancyInput).expect(201);
    expect(vacancy.status).toBe('pending');
    await api('get', '?workspace=student', 'student').expect(200).expect(({ body }) => expect(body.data).toEqual([]));
    await api('put', `/${vacancy.id}/application`, 'student').expect(404);
    await api('patch', `/${vacancy.id}/review`, 'outsider').send({ decision: 'open', reason: '' }).expect(404);
    await api('patch', `/${vacancy.id}/review`, 'admin').send({ decision: 'open', reason: '' }).expect(200);
    await api('get', '?workspace=student', 'foreignStudent').expect(200).expect(({ body }) => expect(body.data).toEqual([]));

    const submit = () => api('put', `/${vacancy.id}/application`, 'student').expect(200);
    const [first, second] = await Promise.all([submit(), submit()]);
    const application = first.body;
    expect(second.body.id).toBe(application.id);
    expect(application.resume).toMatchObject({ headline: 'Синтетический профиль' });
    await api('get', `/${vacancy.id}/applications`, 'student').expect(403);
    await api('get', `/${vacancy.id}/applications`, 'outsider').expect(404);
    await api('get', `/${vacancy.id}/applications`, 'employer').expect(200)
      .expect(({ body }) => expect(body.data.map(row => row.id)).toEqual([application.id]));
    expect((await api('get', '?workspace=student', 'peer').expect(200)).body.data[0].application).toBeNull();

    const baseTime = new Date(Date.now() + 86400000);
    baseTime.setUTCMinutes(0, 0, 0);
    const time = (addMinutes: number) => new Date(baseTime.getTime() + addMinutes * 60000).toISOString();
    const lesson = f.db.getRepository(Lesson).create({
      organizationId: f.uni.id, groupId: f.groups[0].id, teacherId: f.users.teacher.id,
      subject: 'Приватная дисциплина', dayOfWeek: baseTime.getUTCDay(), pairNumber: 2,
      startDate: baseTime, endDate: new Date(time(60)), startTime: '10:00', endTime: '11:00',
    });
    await f.db.getRepository(Lesson).save(lesson);
    const proposal = (start: number, end: number) => ({ startsAt: time(start), endsAt: time(end), meetingDetails: 'Корпус А, аудитория 201' });
    const propose = (start: number, end: number) =>
      api('put', `/${vacancy.id}/applications/${application.id}/interview`, 'employer').send(proposal(start, end)).expect(200);
    const respond = (actor: string, decision: string, updatedAt: string) =>
      api('patch', `/applications/${application.id}/interview`, actor).send({ decision, updatedAt });
    const busy = (await propose(15, 45)).body;
    await respond('peer', 'confirmed', busy.updatedAt).expect(404);
    await respond('student', 'confirmed', busy.updatedAt).expect(409)
      .expect(({ body }) => expect(JSON.stringify(body)).not.toContain(lesson.subject));
    await respond('student', 'declined', busy.updatedAt).expect(200);

    const available = (await propose(60, 90)).body;
    await respond('student', 'confirmed', busy.updatedAt).expect(409);
    await respond('student', 'confirmed', available.updatedAt).expect(200)
      .expect(({ body }) => expect(body.status).toBe('confirmed'));
    await api('get', `/${vacancy.id}/applications`, 'employer').expect(200)
      .expect(({ body }) => expect(body.data[0].status).toBe('confirmed'));

    const myDay = (await http().get('/api/v1/my-day?timeZone=Asia%2FOmsk').auth(tokens.student, { type: 'bearer' }).expect(200)).body;
    expect(myDay.careerInterviews).toEqual([{ id: application.id, title: vacancy.title, startsAt: time(60), endsAt: time(90) }]);
    expect((await http().get('/api/v1/my-day?timeZone=Asia%2FOmsk').auth(tokens.teacher, { type: 'bearer' }).expect(200)).body.careerInterviews).toEqual([]);

    const offer = async (title: string, start: number, end: number) => {
      const created = (await api('post', '', 'employer').send({ ...vacancyInput, title }).expect(201)).body;
      await api('patch', `/${created.id}/review`, 'admin').send({ decision: 'open', reason: '' }).expect(200);
      const applied = (await api('put', `/${created.id}/application`, 'student').expect(200)).body;
      return (await api('put', `/${created.id}/applications/${applied.id}/interview`, 'employer').send(proposal(start, end)).expect(200)).body;
    };
    const confirm = ({ id, updatedAt }: { id: string; updatedAt: string }) =>
      api('patch', `/applications/${id}/interview`, 'student').send({ decision: 'confirmed', updatedAt });
    await confirm(await offer('Вторая стажировка', 70, 100)).expect(409);
    const competing = [
      await offer('Третья стажировка', 120, 150),
      await offer('Четвёртая стажировка', 130, 160),
    ];
    const confirmations = await Promise.all(competing.map(candidate => confirm(candidate)));
    expect(confirmations.map(result => result.status).sort()).toEqual([200, 409]);

    await api('patch', `/${vacancy.id}/close`, 'employer').expect(200);
    await api('put', `/${vacancy.id}/application`, 'peer').expect(404);
    const exportData = await http().get('/api/v1/users/me/export').auth(tokens.student, { type: 'bearer' }).expect(200);
    expect(JSON.stringify(exportData.body.datasets.career_vacancy_application)).toContain(application.id);
  });

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
  it('saves only visible own-university tasks and keeps favorites private and idempotent', async () => {
    const path = `/api/v1/career/tasks/${ordinaryId}/favorite`;
    const save = (actor: string) => http().put(path).auth(tokens[actor], { type: 'bearer' });
    const remove = (actor: string) => http().delete(path).auth(tokens[actor], { type: 'bearer' });
    await save('employer').expect(403);
    await save('foreignStudent').expect(404);
    await save('student').expect(200, { saved: true });
    await save('student').expect(200, { saved: true });
    expect(await f.db.getRepository(Favorite).countBy({ kind: CAREER_FAVORITE_KIND, externalId: ordinaryId })).toBe(1);
    const saved = await get('tasks?saved=true&limit=1', 'student').expect(200);
    expect(saved.body).toMatchObject({ savedTaskIds: [ordinaryId], total: 1, hasMore: false });
    expect(saved.body.items[0].id).toBe(ordinaryId);
    expect((await get('tasks?saved=true', 'student').query({ q: 'несовпадающая' }).expect(200)).body.total).toBe(0);
    expect((await get('tasks?saved=true', 'peer').expect(200)).body.total).toBe(0);
    await get('tasks?saved=true', 'employer').expect(403);
    await get('tasks?saved=wrong', 'student').expect(400);
    await remove('peer').expect(200, { saved: false });
    expect((await get('tasks?saved=true', 'student').expect(200)).body.total).toBe(1);
    await remove('student').expect(200, { saved: false });
    expect((await get('tasks?saved=true', 'student').expect(200)).body.total).toBe(0);
  });
  it('shows only actionable own-university career deadlines on My Day', async () => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Omsk' }).format(new Date());
    const tasks = f.db.getRepository(CareerTask);
    const own = await tasks.save({ ...draft({ title: 'Своя работа', deadline: today }), state: 'assigned' });
    const peer = await tasks.save({ ...draft({ title: 'Работа сокурсника', deadline: today }), state: 'assigned' });
    const complete = await tasks.save({ ...draft({ title: 'Уже завершена', deadline: today }), state: 'accepted' });
    const foreign = await tasks.save({ ...draft({ title: 'Работа из другого вуза', deadline: today }), organizationId: f.otherUni.id, state: 'assigned' });
    const works = f.db.getRepository(CareerWork);
    const work = await works.save({ taskId: own.id, studentId: f.users.student.id, state: 'revision' });
    const otherWorks = await works.save([
      { taskId: peer.id, studentId: f.users.otherStudent.id, state: 'in_progress' },
      { taskId: complete.id, studentId: f.users.student.id, state: 'accepted' },
      { taskId: foreign.id, studentId: f.users.student.id, state: 'in_progress' },
    ]);

    const load = (actor: string) => http().get('/api/v1/my-day?timeZone=Asia%2FOmsk').auth(tokens[actor], { type: 'bearer' });
    try {
      expect((await load('student').expect(200)).body.careerDeadlines).toEqual([{ id: work.id, title: own.title, deadline: today }]);
      expect((await load('teacher').expect(200)).body.careerDeadlines).toEqual([]);
    } finally {
      await works.delete([work.id, ...otherWorks.map(row => row.id)]);
      await tasks.delete([own.id, peer.id, complete.id, foreign.id]);
    }
  });
  it('requires explicit reasons for flagged decisions and current content version after correction',async()=>{
    flaggedId=(await create({description:'Нужен депозит за получение доступа к материалам проекта',rewardKopecks:10000000,hours:1})).id;
    const queued=await post(`tasks/${flaggedId}/publish`,'employer').expect(201);expect(queued.body.moderationFlags).toEqual(expect.arrayContaining(['upfront_payment','high_reward','high_hourly_rate']));
    await post(`tasks/${flaggedId}/approve`,'admin').expect(409);
    await post(`moderation/tasks/${flaggedId}/decision`,'admin',{decision:'approve',expectedVersion:1}).expect(400);
    expect((await post(`moderation/tasks/${flaggedId}/decision`,'admin',{decision:'reject',expectedVersion:1,reason:'Уберите оплату доступа и уточните условия задачи'}).expect(201)).body.state).toBe('draft');
    await post(`tasks/${flaggedId}/publish`,'employer').expect(409);
    const {companyId:ignoredCompany,organizationId:ignoredUniversity,...revision}=draft({description:'Исправленный доступный макет без оплаты доступа со стороны исполнителя'});void ignoredCompany;void ignoredUniversity;
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
    await expect(f.db.getRepository(CareerTaskComplaint).save({organizationId:f.otherUni.id,taskId:ordinaryId,studentId:f.users.student.id,category:'other',details:'Synthetic impossible relation'})).rejects.toThrow();
  });
  it('exports old-university own complaints and scrubs their text on actual account deletion',async()=>{
    const task=await f.db.getRepository(CareerTask).save({...draft(),organizationId:f.otherUni.id,state:'open'});
    const old=await f.db.getRepository(CareerTaskComplaint).save({organizationId:f.otherUni.id,taskId:task.id,studentId:f.users.student.id,category:'other',details:'OWN_OLD_UNIVERSITY_COMPLAINT'});
    const exported=await http().get('/api/v1/users/me/export').auth(tokens.student,{type:'bearer'}).expect(200);
    expect(exported.body.complete).toBe(true);expect(JSON.stringify(exported.body.datasets.career_task_complaint)).toContain('OWN_OLD_UNIVERSITY_COMPLAINT');
    await http().delete('/api/v1/users/me').auth(tokens.student,{type:'bearer'}).send({expectedUserId:f.users.student.id,currentPassword:f.password,confirmed:true,acknowledgeRetention:true}).expect(200);
    const applications = await f.app.get(TenantContext).runInRequest(() => {
      f.app.get(TenantContext).setUser({ id: f.users.student.id, email: f.users.student.email, role: UserRole.STUDENT, organizationId: f.uni.id });
      return f.app.get(DataSource).getRepository(CareerVacancyApplication).countBy({ studentId: f.users.student.id });
    });
    expect(applications).toBe(0);
    expect((await f.db.getRepository(CareerTaskComplaint).findOneByOrFail({id:old.id})).details).toBe('[Текст жалобы удалён пользователем]');
    expect((await f.db.getRepository(CareerTaskComplaint).findOneByOrFail({id:complaintId})).details).toBe('[Текст жалобы удалён пользователем]');
    expect(await f.db.getRepository(CareerTaskComplaint).existsBy({studentId:f.users.peer.id,details:'KEEP_PEER_PRIVATE_COMPLAINT'})).toBe(true);
  });
});
