import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createCurationFixture } from './curation.fixture';
import { AcademicIdentities1700000000036 } from '../src/migrations/1700000000036-AcademicIdentities';
import { AcademicIdentity } from '../src/semester/academic-identity.entity';
import { MoodleConnectorService } from '../src/moodle/moodle-connector.service';
import { University } from '../src/users/entities/university.entity';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { TenantContext } from '../src/common/tenant/tenant-context';

const suite = process.env.SEMESTER_TEST_DATABASE_URL ? describe : describe.skip;
suite('Semester: actual JWT/HTTP, numeric identities and PostgreSQL FORCE RLS', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  let moodle: MoodleConnectorService;
  let courses: jest.SpyInstance, grades: jest.SpyInstance;
  const tokens: Record<string, string> = {};
  const originalKey = process.env.CONNECTOR_ENCRYPTION_KEY;
  const http = () => request(f.app.getHttpServer());
  const get = (path: string, actor = 'student') => http().get(`/api/v1/academic/${path}`).auth(tokens[actor], { type: 'bearer' });
  const link = (studentId: string, externalUserId = '17', actor = 'admin', extra = {}) => http().post(`/api/v1/academic/identities/moodle/${studentId}`).auth(tokens[actor], { type: 'bearer' }).send({ externalUserId, confirmed: true, reason: 'Личность подтверждена в реестре Moodle', ...extra });
  const unlink = (id: string) => http().delete(`/api/v1/academic/identities/moodle/${id}`).auth(tokens.admin, { type: 'bearer' });
  const period = 'semester?period=2026-autumn';
  async function configure() {
    await f.db.getRepository(University).update(f.uni.id, { connectorType: 'moodle', connectorConfig: { ...moodle.configure('https://moodle.example.edu/', 'fixture-token'), status: 'active', semesterPeriods: [{ id: '2026-autumn', label: 'Осень 2026', courseIds: [11, 12] }] } });
  }
  beforeAll(async () => {
    process.env.CONNECTOR_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    f = await createCurationFixture(process.env.SEMESTER_TEST_DATABASE_URL!);
    const runner = f.db.createQueryRunner();
    try { await runner.query('DROP TABLE academic_identities'); await new AcademicIdentities1700000000036().up(runner); } finally { await runner.release(); }
    moodle = f.app.get(MoodleConnectorService);
    courses = jest.spyOn(moodle, 'getUserCourses').mockResolvedValue([{ id: 11, fullname: 'Математика', visible: 1, showgrades: true }, { id: 99, fullname: 'Другой семестр', visible: 1 }]);
    grades = jest.spyOn(moodle, 'getUserGradeItems').mockResolvedValue([{ id: 101, itemtype: 'course', itemname: 'Итог', graderaw: 0, gradeformatted: '0', grademin: 0, grademax: 100 }]);
    await f.db.getRepository(User).update(f.users.outsider.id, { role: UserRole.UNIVERSITY_ADMIN });
    for (const actor of ['admin', 'student', 'peer', 'teacher', 'outsider']) {
      const response = await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200);
      tokens[actor] = response.body.accessToken;
    }
  }, 90000);
  afterAll(async () => { jest.restoreAllMocks(); if (originalKey === undefined) delete process.env.CONNECTOR_ENCRYPTION_KEY; else process.env.CONNECTOR_ENCRYPTION_KEY = originalKey; await f?.app.close(); }, 30000);
  it('runs under non-superuser with FORCE RLS established by the real migration', async () => {
    expect((await f.db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'))[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    expect((await f.db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='academic_identities'"))[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
  it('returns a source-labeled unavailable state, never synthetic marks, without calling Moodle', async () => {
    await get(period).expect(200).expect(({ body, headers }) => { expect(body.reason).toBe('source_unavailable'); expect(body.data).toEqual([]); expect(headers['cache-control']).toBe('no-store'); });
    expect(courses).not.toHaveBeenCalled();
    await configure();
    await get('semester?period=other').expect(200).expect(({ body }) => expect(body.reason).toBe('period_unconfigured'));
    await get(period).expect(200).expect(({ body }) => expect(body.reason).toBe('identity_unlinked'));
  });
  it('rejects foreign students, self-linking, role elevation, ambiguous IDs and missing confirmation', async () => {
    await link(f.users.student.id, '17', 'outsider').expect(404);
    await link(f.users.student.id, '17', 'student').expect(403);
    await link(f.users.teacher.id).expect(404);
    await link(f.users.student.id, 'Иванов').expect(400);
    await link(f.users.student.id, '0').expect(400);
    await link(f.users.student.id, '17', 'admin', { confirmed: false }).expect(400);
    await get(period, 'admin').expect(403); await get(period, 'teacher').expect(403);
  });
  it('persists a unique identity and reads only configured, enrolled courses for the authenticated student', async () => {
    await link(f.users.student.id).expect(201);
    await link(f.users.peer.id).expect(409);
    await get(period).expect(200).expect(({ body }) => { expect(body.available).toBe(true); expect(body.meta.total).toBe(1); expect(body.source.provider).toBe('moodle'); expect(body.data[0].grades[0].raw).toBe(0); expect(body.debtSource.available).toBe(false); expect(JSON.stringify(body)).not.toContain('fixture-token'); });
    expect(courses).toHaveBeenLastCalledWith(expect.objectContaining({ baseUrl: 'https://moodle.example.edu/' }), 17);
    expect(grades).toHaveBeenLastCalledWith(expect.anything(), 17, 11);
    await get(period, 'peer').expect(200).expect(({ body }) => expect(body.reason).toBe('identity_unlinked'));
    await get(`${period}&studentId=${f.users.peer.id}`).expect(400);
  });
  it('enforces RLS against an actual foreign-university SQL read', async () => {
    const tenant = f.app.get(TenantContext);
    const rows = await tenant.runInRequest(async () => {
      tenant.setUser({ id: f.users.outsider.id, email: f.users.outsider.email, role: UserRole.UNIVERSITY_ADMIN, universityId: f.otherUni.id });
      return f.app.get(DataSource).getRepository(AcademicIdentity).find();
    });
    expect(rows).toEqual([]);
  });
  it('honors pagination and hides unavailable grade values instead of treating them as failed marks', async () => {
    courses.mockResolvedValueOnce([{ id: 11, fullname: 'Первый', visible: 1, showgrades: true }, { id: 12, fullname: 'Второй', visible: 1, showgrades: false }]);
    await get(`${period}&page=2&limit=1`).expect(200).expect(({ body }) => { expect(body.data[0].id).toBe(12); expect(body.data[0].available).toBe(false); expect(body.data[0].grades).toEqual([]); expect(body.meta.total).toBe(2); });
    grades.mockResolvedValueOnce([{ id: 101, itemtype: 'course', graderaw: 90, gradeformatted: '90', gradeishidden: true }]);
    await get(period).expect(200).expect(({ body }) => expect(body.data[0].grades[0]).toMatchObject({ raw: null, display: null, hidden: true }));
    const calls = grades.mock.calls.length;
    courses.mockResolvedValueOnce([{ id: 11, fullname: 'Неизвестная видимость', showgrades: true }]);
    await get(period).expect(200).expect(({ body }) => expect(body.data).toEqual([]));
    courses.mockResolvedValueOnce([{ id: 11, fullname: 'Без разрешения оценок', visible: 1 }]);
    await get(period).expect(200).expect(({ body }) => expect(body.data[0]).toMatchObject({ available: false, grades: [] }));
    expect(grades.mock.calls.length).toBe(calls);
  });
  it('returns an error without leaking upstream content or misreporting an outage as an empty source', async () => {
    courses.mockRejectedValueOnce(new Error('secret token and student names'));
    await get(period).expect(502).expect(({ body }) => expect(JSON.stringify(body)).not.toContain('secret token'));
    courses.mockResolvedValueOnce([{ id: 11, fullname: 'Курс' }, { id: 11, fullname: 'Дубликат' }]);
    await get(period).expect(502);
    await get(`${period}&limit=11`).expect(400);
  });
  it('invalidates a link on source replacement and rechecks revocation on the same JWT', async () => {
    await f.db.getRepository(University).update(f.uni.id, { connectorConfig: { ...moodle.configure('https://new-moodle.example.edu/', 'new-fixture-token'), semesterPeriods: [{ id: '2026-autumn', label: 'Осень', courseIds: [11] }] } });
    await get(period).expect(200).expect(({ body }) => expect(body.reason).toBe('identity_unlinked'));
    await configure(); await unlink(f.users.student.id).expect(200);
    await get(period).expect(200).expect(({ body }) => expect(body.reason).toBe('identity_unlinked'));
  });
});
