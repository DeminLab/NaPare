import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createCurationFixture } from './curation.fixture';
import { OfficeAssignment } from '../src/requests/request.entities';
import { OfficeDebtRecord, OfficeDebtSnapshot } from '../src/requests/office-report.entities';
import { OfficeReports1700000000042 } from '../src/migrations/1700000000042-OfficeReports';
import { Group } from '../src/users/entities/group.entity';
import { Faculty } from '../src/users/entities/faculty.entity';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { TenantContext } from '../src/common/tenant/tenant-context';

const suite = process.env.OFFICE_REPORT_TEST_DATABASE_URL ? describe : describe.skip;
suite('Office reports: actual HTTP, confirmed sources and PostgreSQL RLS', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>, foreignStudent: User, foreignAdmin: User;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const get = (path: string, actor = 'admin') => http().get(`/api/v1/requests/${path}`).auth(tokens[actor], { type: 'bearer' });
  const post = (body: object, actor = 'admin') => http().post('/api/v1/requests/reports/debt-snapshots').auth(tokens[actor], { type: 'bearer' }).send(body);
  const payload = (extra: object = {}) => ({ requestId: randomUUID(), groupId: f.groups[0].id, source: 'Официальный реестр — тест', reference: 'Протокол TEST-2026', asOfDate: '2026-10-20', confirmsOfficialSource: true, confirmsCompleteGroupSnapshot: true,
    records: [{ studentId: f.users.student.id, subject: 'Математика', period: '2026 осень', basis: 'Запись официального реестра' }], ...extra });
  beforeAll(async () => {
    f = await createCurationFixture(process.env.OFFICE_REPORT_TEST_DATABASE_URL!);
    await f.db.query('DROP TABLE office_debt_records, office_debt_snapshots');
    const runner = f.db.createQueryRunner();
    try { await new OfficeReports1700000000042().up(runner); } finally { await runner.release(); }
    await f.db.getRepository(OfficeAssignment).save({ universityId: f.uni.id, userId: f.users.teacher.id, duty: 'office', facultyIds: [], groupIds: [f.groups[0].id], assignedBy: f.users.admin.id });
    await f.db.getRepository(OfficeAssignment).save({ universityId: f.uni.id, userId: f.users.legacy.id, duty: 'dispatcher', facultyIds: [], groupIds: [f.groups[0].id], assignedBy: f.users.admin.id });
    await f.db.getRepository(Faculty).update(f.groups[0].facultyId, { deanUserId: f.users.dean.id });
    const secondFaculty = await f.db.getRepository(Faculty).save({ universityId: f.uni.id, name: 'Другой факультет отчётов', code: 'ОТЧ2' });
    await f.db.getRepository(Group).update(f.groups[2].id, { facultyId: secondFaculty.id });
    foreignStudent = await f.db.getRepository(User).save({ universityId: f.otherUni.id, groupId: f.groups[3].id, role: UserRole.STUDENT, firstName: 'Чужой', lastName: 'Студент', email: 'student@foreign-reports.test', passwordHash: f.users.student.passwordHash });
    foreignAdmin = await f.db.getRepository(User).save({ universityId: f.otherUni.id, role: UserRole.UNIVERSITY_ADMIN, firstName: 'Чужой', lastName: 'Администратор', email: 'admin@foreign-reports.test', passwordHash: f.users.student.passwordHash });
    for (const [key, user] of Object.entries({ ...f.users, foreignAdmin, foreignStudent })) {
      if (!user.isActive) continue;
      tokens[key] = (await http().post('/api/v1/auth/login').send({ email: user.email, password: f.password }).expect(200)).body.accessToken;
    }
  }, 90000);
  afterAll(async () => { await f?.app.close(); }, 30000);
  it('requires authentication and preserves unavailable versus confirmed empty sources', async () => {
    await http().get('/api/v1/requests/reports/contingent').expect(401);
    const contingent = await get('reports/contingent').expect(200);
    expect(contingent.body.totalActiveStudents).toBe(3);
    expect(contingent.body.data.find(row => row.groupId === f.groups[0].id).activeStudents).toBe(2);
    expect(contingent.body.data.every(row => !row.debtSource.available)).toBe(true);
    const personal = await get(`students/${f.users.student.id}/debts`, 'student').expect(200);
    expect(personal.body.available).toBe(false);
    for (const actor of ['student', 'legacy']) await get('reports/contingent', actor).expect(403);
  });
  it('limits office to assigned groups, dean to faculty and exposes no unassigned totals to scoped staff', async () => {
    const office = await get('reports/contingent', 'teacher').expect(200);
    expect(office.body.data.map(row => row.groupId)).toEqual([f.groups[0].id]);
    expect(office.body.totalActiveStudents).toBe(2);
    expect(office.body.unresolvedStudentGroups).toBeNull();
    await get(`reports/contingent?groupId=${f.groups[2].id}`, 'teacher').expect(404);
    const dean = await get('reports/contingent', 'dean').expect(200);
    expect(dean.body.totalActiveStudents).toBe(2);
    expect(dean.body.data.some(row => row.groupId === f.groups[2].id)).toBe(false);
    await get(`reports/contingent?facultyId=${f.groups[3].facultyId}`, 'dean').expect(404);
  });
  it('rejects missing attestation, invalid dates, duplicate rows and wrong-group identities atomically', async () => {
    await post(payload({ confirmsOfficialSource: false })).expect(400);
    await post(payload({ confirmsCompleteGroupSnapshot: false })).expect(400);
    await post(payload({ asOfDate: '2026-02-30' })).expect(400);
    await post(payload({ asOfDate: '2999-01-01' })).expect(400);
    const row = payload().records[0];
    await post(payload({ records: [row, row] })).expect(400);
    await post(payload({ records: [{ ...row, studentId: f.users.otherStudent.id }] })).expect(400);
    const large = payload({ records: Array.from({ length: 1000 }, (_, index) => ({ ...row, studentId: f.users.otherStudent.id, subject: `Недопустимая группа ${index}`, basis: 'x'.repeat(180) })) });
    expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(100 * 1024);
    await post(large).expect(400).expect(({ body }) => expect(body.message).toContain('Все записи должны принадлежать'));
    await post(payload(), 'teacher').expect(403);
    expect(await f.db.getRepository(OfficeDebtSnapshot).count()).toBe(0);
  });
  it('publishes a source once, replays canonically and never converts a grade into a debt', async () => {
    const dto = payload(), [created, concurrent] = await Promise.all([post(dto).expect(201), post(dto).expect(201)]);
    expect(concurrent.body.id).toBe(created.body.id);
    expect([created.body.replay, concurrent.body.replay].sort()).toEqual([false, true]);
    const replay = await post({ ...dto, requestId: dto.requestId.toUpperCase(), groupId: dto.groupId.toUpperCase(), records: [{ basis: dto.records[0].basis, period: dto.records[0].period, subject: dto.records[0].subject, studentId: dto.records[0].studentId.toUpperCase() }] }).expect(201);
    expect(replay.body.id).toBe(created.body.id); expect(replay.body.replay).toBe(true);
    await post({ ...dto, reference: 'Другие данные' }).expect(409);
    const own = await get(`students/${f.users.student.id}/debts`, 'student').expect(200);
    expect(own.body.available).toBe(true); expect(own.body.records).toHaveLength(1);
    expect(own.body.records[0].subject).toBe('Математика');
    expect(own.body.source).toBe(dto.source); expect(own.body.asOfDate).toBe('2026-10-20');
    const peer = await get(`students/${f.users.peer.id}/debts`, 'peer').expect(200);
    expect(peer.body.available).toBe(true); expect(peer.body.records).toEqual([]);
    await get(`students/${f.users.student.id}/debts`, 'peer').expect(403);
  });
  it('has a positive foreign-university control before rejecting cross-tenant report/import/resource IDs', async () => {
    const dto = payload({ groupId: f.groups[3].id, records: [{ studentId: foreignStudent.id, subject: 'FOREIGN_ONLY_SUBJECT', period: '2026 осень', basis: 'Тестовый источник другого вуза' }] });
    await post(dto, 'foreignAdmin').expect(201);
    const positive = await get('reports/debts', 'foreignAdmin').expect(200);
    expect(positive.body.meta.total).toBe(1); expect(positive.text).toContain('FOREIGN_ONLY_SUBJECT');
    const before = await f.db.getRepository(OfficeDebtRecord).countBy({ universityId: f.otherUni.id });
    await get(`reports/debts?groupId=${f.groups[3].id}`).expect(404);
    await get(`reports/contingent?groupId=${f.groups[3].id}`).expect(404);
    await get(`reports/contingent?facultyId=${f.groups[3].facultyId}`).expect(404);
    await post({ ...dto, requestId: randomUUID() }).expect(404);
    await get(`students/${foreignStudent.id}/debts`).expect(404);
    const own = await get('reports/debts').expect(200);
    expect(own.text).not.toContain('FOREIGN_ONLY_SUBJECT');
    const adminExport = await http().get('/api/v1/users/me/export').auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(adminExport.body.datasets.office_debt_snapshots).toHaveLength(1);
    expect(adminExport.body.datasets.office_debt_snapshots.every(row => row.verifiedBy === f.users.admin.id)).toBe(true);
    expect(await f.db.getRepository(OfficeDebtRecord).countBy({ universityId: f.otherUni.id })).toBe(before);
    await get('reports/debts?universityId=' + f.otherUni.id).expect(400);
  });
  it('retains prior snapshots, rejects older replacements and exposes only the current complete snapshot', async () => {
    const before = await f.db.getRepository(OfficeDebtRecord).countBy({ universityId: f.uni.id });
    await post(payload({ asOfDate: '2026-10-19', records: [] })).expect(409);
    await post(payload({ asOfDate: '2026-10-21', records: [] })).expect(201);
    const own = await get(`students/${f.users.student.id}/debts`, 'student').expect(200);
    expect(own.body.available).toBe(true); expect(own.body.records).toEqual([]);
    expect(await f.db.getRepository(OfficeDebtRecord).countBy({ universityId: f.uni.id })).toBe(before);
    expect(await f.db.getRepository(OfficeDebtSnapshot).countBy({ universityId: f.uni.id })).toBe(2);
  });
  it('paginates rows in SQL and excludes moved students without exposing their former register to a new group', async () => {
    const rows = Array.from({ length: 105 }, (_, index) => ({ ...payload().records[0], subject: `Дисциплина ${index}` }));
    await post(payload({ asOfDate: '2026-10-22', records: rows })).expect(201);
    const first = await get('reports/debts?limit=100').expect(200), second = await get('reports/debts?page=2&limit=100').expect(200);
    expect(first.body.meta.total).toBe(105); expect(first.body.data).toHaveLength(100); expect(second.body.data).toHaveLength(5);
    expect(new Set([...first.body.data, ...second.body.data].map(row => row.id)).size).toBe(105);
    await f.db.getRepository(User).update(f.users.student.id, { groupId: f.groups[2].id });
    expect((await get('reports/debts').expect(200)).body.meta.total).toBe(0);
    expect((await get(`students/${f.users.student.id}/debts`, 'student').expect(200)).body.available).toBe(false);
    await f.db.getRepository(User).update(f.users.student.id, { groupId: f.groups[0].id });
  });
  it('does not guess ambiguous UUID/external keys and reports unresolved accounts only to the full university administrator', async () => {
    await f.db.getRepository(Group).update(f.groups[1].id, { externalId: f.groups[0].id });
    try {
      const report = await get('reports/contingent').expect(200);
      expect(report.body.unresolvedStudentGroups).toBe(1); expect(report.body.totalActiveStudents).toBe(2);
      await get(`students/${f.users.student.id}/debts`, 'student').expect(400);
      await post(payload()).expect(400);
      expect((await get('reports/debts').expect(200)).body.meta.total).toBe(0);
    } finally { await f.db.getRepository(Group).update(f.groups[1].id, { externalId: '102' }); }
  });
  it('enforces restrictive SQL policies and self export includes retained historical records without peers', async () => {
    const properties = await f.db.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('office_debt_records','office_debt_snapshots')");
    expect(properties).toHaveLength(2); expect(properties.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const policies = await f.db.query("SELECT c.relname, count(*)::int AS total FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname IN ('office_debt_records','office_debt_snapshots') AND NOT p.polpermissive GROUP BY c.relname");
    expect(policies).toHaveLength(2); expect(policies.every(row => row.total === 4)).toBe(true);
    const [role] = await f.db.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user');
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    const tenant = f.app.get(TenantContext), db = f.app.get(DataSource);
    await tenant.runInRequest(async () => {
      tenant.setUser({ id: f.users.admin.id, email: f.users.admin.email, role: UserRole.UNIVERSITY_ADMIN, universityId: f.uni.id });
      expect(await db.query('SELECT id FROM office_debt_records WHERE "universityId"=$1', [f.otherUni.id])).toEqual([]);
      await expect(db.query('INSERT INTO office_debt_records ("universityId","groupId","snapshotId","studentId",subject,period,basis) VALUES ($1,$2,$3,$4,$5,$6,$7)', [f.otherUni.id, f.groups[3].id, randomUUID(), foreignStudent.id, 'invalid', 'invalid', 'invalid'])).rejects.toThrow(/row-level security/i);
    });
    const previousUniversitySource = await f.db.getRepository(OfficeDebtSnapshot).findOneByOrFail({ universityId: f.otherUni.id });
    await f.db.getRepository(OfficeDebtRecord).save({ universityId: f.otherUni.id, groupId: f.groups[3].id, snapshotId: previousUniversitySource.id, studentId: f.users.student.id, subject: 'OWN_PREVIOUS_UNIVERSITY', period: 'Прошлый семестр', basis: 'Синтетический архив до перевода' });
    const own = await http().get('/api/v1/users/me/export').auth(tokens.student, { type: 'bearer' }).expect(200);
    expect(own.body.datasets.office_debt_records).toHaveLength(107);
    expect(own.text).toContain('OWN_PREVIOUS_UNIVERSITY');
    expect(own.text).not.toContain('FOREIGN_ONLY_SUBJECT');
    expect((await http().get('/api/v1/users/me/export').auth(tokens.peer, { type: 'bearer' }).expect(200)).body.datasets.office_debt_records).toEqual([]);
  });
  it('revokes report access on an existing JWT immediately after an office assignment is revoked', async () => {
    await f.db.getRepository(OfficeAssignment).update({ userId: f.users.teacher.id }, { revokedAt: new Date(), revokedBy: f.users.admin.id });
    await get('reports/contingent', 'teacher').expect(403); await get('reports/debts', 'teacher').expect(403);
  });
  it('retains learning records under the archive code after real account deletion and removes the account from current reports', async () => {
    const before = await f.db.getRepository(OfficeDebtRecord).countBy({ studentId: f.users.student.id });
    await http().delete('/api/v1/users/me').auth(tokens.student, { type: 'bearer' }).send({ expectedUserId: f.users.student.id, currentPassword: f.password, confirmed: true, acknowledgeRetention: true }).expect(200);
    expect(await f.db.getRepository(OfficeDebtRecord).countBy({ studentId: f.users.student.id })).toBe(before);
    expect((await get('reports/debts').expect(200)).body.meta.total).toBe(0);
    expect((await f.db.getRepository(User).findOneByOrFail({ id: f.users.student.id })).email).not.toBe(f.users.student.email);
    await http().get('/api/v1/users/me/export').auth(tokens.student, { type: 'bearer' }).expect(401);
  });
});
