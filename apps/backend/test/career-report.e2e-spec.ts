import * as request from 'supertest';
import { Workbook, ValueType } from 'exceljs';
import { createCurationFixture } from './curation.fixture';
import { CareerApplication, CareerMembership, CareerTask, CareerWork } from '../src/career/career.entities';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { University } from '../src/users/entities/university.entity';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from '../src/migrations/1700000000038-AccountErasure';

const integration = process.env.CAREER_REPORT_TEST_DATABASE_URL ? describe : describe.skip;
jest.setTimeout(90000);
integration('University career report with real JWT, PostgreSQL RLS and XLSX', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  const get = (path = '/api/v1/career/center/report', actor = 'admin') => request(f.app.getHttpServer()).get(path).auth(tokens[actor], { type: 'bearer' });
  let delegatedId: string;
  beforeAll(async () => {
    f = await createCurationFixture(process.env.CAREER_REPORT_TEST_DATABASE_URL!);
    const runner = f.db.createQueryRunner();
    try { await new PersonalDataRead1700000000037().up(runner); await new AccountErasure1700000000038().up(runner); } finally { await runner.release(); }
    const [role] = await f.db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    await f.db.getRepository(University).update(f.uni.id, { name: '=1+1' });
    const companyId = f.uni.id; // synthetic foreign-key-free identifier; no company details are exported.
    const tasks = await f.db.getRepository(CareerTask).save(Array.from({ length: 125 }, (_, index) => ({
      companyId, universityId: f.uni.id, title: `PRIVATE_TASK_${index}`, description: 'PRIVATE_DESCRIPTION', criteria: 'PRIVATE_CRITERIA',
      rewardKopecks: 10000, hours: 1, deadline: '2026-12-01', state: index < 110 ? 'closed' : 'open',
    })));
    await f.db.getRepository(CareerApplication).save(tasks.flatMap(task => [f.users.student, f.users.peer].map(user => ({ taskId: task.id, studentId: user.id, message: 'PRIVATE_APPLICATION', state: 'pending' }))));
    await f.db.getRepository(CareerWork).save(tasks.map((task, index) => ({ taskId: task.id, studentId: f.users.student.id, state: index < 110 ? 'accepted' : 'submitted', submission: 'PRIVATE_SUBMISSION' })));
    const foreign = await f.db.getRepository(CareerTask).save({ companyId, universityId: f.otherUni.id, title: 'FOREIGN_TASK', description: 'FOREIGN_DESCRIPTION', criteria: '', rewardKopecks: 0, hours: 1, deadline: '2026-12-01', state: 'open' });
    await f.db.getRepository(CareerApplication).save({ taskId: foreign.id, studentId: f.users.outsider.id, message: 'FOREIGN_MESSAGE' });
    await f.db.getRepository(CareerWork).save({ taskId: foreign.id, studentId: f.users.outsider.id, state: 'accepted' });
    delegatedId = (await f.db.getRepository(CareerMembership).save({ userId: f.users.teacher.id, universityId: f.uni.id, companyId: null, role: 'career_staff' })).id;
    await f.db.getRepository(User).update(f.users.outsider.id, { role: UserRole.CAREER_STAFF });
    const employer = await f.db.getRepository(User).save({ email: 'report-employer@example.test', firstName: 'Synthetic', lastName: 'Employer', passwordHash: f.users.student.passwordHash, role: UserRole.EMPLOYER, universityId: null });
    for (const actor of ['admin', 'student', 'teacher', 'outsider', 'employer']) {
      const user = actor === 'employer' ? employer : f.users[actor];
      const login = await request(f.app.getHttpServer()).post('/api/v1/auth/login').send({ email: user.email, password: f.password }).expect(200);
      tokens[actor] = login.body.accessToken;
    }
  });
  afterAll(async () => { await f?.app.close(); });

  it('denies unauthenticated users, students and employers', async () => {
    await request(f.app.getHttpServer()).get('/api/v1/career/center/report').expect(401);
    for (const actor of ['student', 'employer']) {
      await get(undefined, actor).expect(403);
      await get('/api/v1/career/center/report.xlsx', actor).expect(403);
    }
  });

  it('counts complete datasets without join multiplication, pagination caps or foreign university data', async () => {
    const response = await get().query({ universityId: f.otherUni.id }).expect(200);
    expect(response.headers['cache-control']).toBe('no-store, private');
    expect(response.body).toMatchObject({ universityId: f.uni.id, universityName: '=1+1', period: 'all_time', tasks: 125, applications: 250, acceptedWorks: 110 });
    expect(response.body.byState.works).toEqual([{ state: 'accepted', count: 110 }, { state: 'submitted', count: 15 }]);
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_|FOREIGN_|curation\.example|passwordHash|submission|studentId/);
  });

  it('allows an assigned center staff member and denies the same account after revocation', async () => {
    await get(undefined, 'teacher').expect(200);
    await f.db.getRepository(CareerMembership).update(delegatedId, { revokedAt: new Date() });
    await get(undefined, 'teacher').expect(403);
    await get('/api/v1/career/center/report.xlsx', 'teacher').expect(403);
  });

  it('returns only the foreign staff account own university, never the requested university', async () => {
    const response = await get(undefined, 'outsider').query({ universityId: f.uni.id }).expect(200);
    expect(response.body).toMatchObject({ universityId: f.otherUni.id, tasks: 1, applications: 1, acceptedWorks: 1 });
  });

  it('exports actual numeric XLSX aggregates, preserves formula-like names as strings and contains no personal records', async () => {
    const response = await get('/api/v1/career/center/report.xlsx').buffer(true).parse((res, done) => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => done(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toBe('attachment; filename="napare-career-report.xlsx"');
    expect(response.headers['cache-control']).toBe('no-store, private');
    const workbook = new Workbook(); await workbook.xlsx.load(response.body);
    expect(response.headers['x-napare-university-id']).toBe(f.uni.id);
    const summary = workbook.getWorksheet('Сводка')!;
    expect(summary.getCell('B2').value).toBe('=1+1');
    expect(summary.getCell('B2').type).toBe(ValueType.String);
    expect(summary.getCell('B6').value).toBe(125);
    expect(summary.getCell('B7').value).toBe(250);
    expect(summary.getCell('B8').value).toBe(110);
    expect(summary.getCell('B6').type).toBe(ValueType.Number);
    const values: unknown[] = []; workbook.eachSheet(sheet => sheet.eachRow(row => values.push(row.values)));
    expect(JSON.stringify(values)).not.toMatch(/PRIVATE_|FOREIGN_|curation\.example|passwordHash|submission|studentId/);
  });

  it('keeps retained learning/work history in aggregates after actual self-erasure', async () => {
    await request(f.app.getHttpServer()).delete('/api/v1/users/me').auth(tokens.student, { type: 'bearer' })
      .send({ expectedUserId: f.users.student.id, currentPassword: f.password, confirmed: true, acknowledgeRetention: true }).expect(200);
    const report = await get().expect(200);
    expect(report.body).toMatchObject({ tasks: 125, applications: 250, acceptedWorks: 110 });
  });
});
