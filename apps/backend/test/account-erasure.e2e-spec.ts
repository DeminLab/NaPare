import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createCurationFixture } from './curation.fixture';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from '../src/migrations/1700000000038-AccountErasure';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { PersonalLessonNote } from '../src/pair-space/entities/personal-lesson-note.entity';
import { DeviceToken } from '../src/notifications/entities/device-token.entity';
import { AttendanceRecord } from '../src/absences/entities/attendance-record.entity';
import { Absence } from '../src/absences/entities/absence.entity';
import { PlatformControl } from '../src/platform/platform.entity';
import { CareerCompany, CareerMembership } from '../src/career/career.entities';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { DataSource } from 'typeorm';

const suite = process.env.ACCOUNT_ERASURE_TEST_DATABASE_URL ? describe : describe.skip;
suite('Account erasure: local private data removed, individual archive retained', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {}, refresh: Record<string, string> = {};
  let ip = 0, absenceId: string;
  const http = () => request(f.app.getHttpServer());
  const remove = (actor: string, body: object) => http().delete('/api/v1/users/me').set('X-Forwarded-For', `192.0.2.${++ip}`).auth(tokens[actor], { type: 'bearer' }).send(body);
  const preview = (actor: string) => http().get('/api/v1/users/me/deletion-preview').auth(tokens[actor], { type: 'bearer' });
  const confirmed = () => ({ currentPassword: f.password, confirmed: true, acknowledgeRetention: true });
  beforeAll(async () => {
    f = await createCurationFixture(process.env.ACCOUNT_ERASURE_TEST_DATABASE_URL!);
    // Simulate distinct trusted client addresses for independent rate-limit scenarios.
    f.app.getHttpAdapter().getInstance().set('trust proxy', true);
    const runner = f.db.createQueryRunner();
    try { await new PersonalDataRead1700000000037().up(runner); await new AccountErasure1700000000038().up(runner); } finally { await runner.release(); }
    for (const actor of ['student', 'peer', 'teacher', 'admin', 'outsider', 'otherStudent']) {
      const response = await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200);
      tokens[actor] = response.body.accessToken; refresh[actor] = response.body.refreshToken;
    }
    await f.db.getRepository(User).update(f.users.student.id, { phone: '+70000000000', avatarUrl: 'https://example.test/private-avatar.png', maxUserId: 'private-max-id', telegramUserId: 'private-telegram-id', sourceTeacherId: 'private-source-teacher' });
    await f.db.getRepository(PersonalLessonNote).save([
      { userId: f.users.student.id, universityId: f.uni.id, pairSpaceId: randomUUID(), content: 'OWN_PRIVATE_NOTE' },
      { userId: f.users.student.id, universityId: f.otherUni.id, pairSpaceId: randomUUID(), content: 'OWN_OLD_UNIVERSITY_NOTE' },
      { userId: f.users.peer.id, universityId: f.uni.id, pairSpaceId: randomUUID(), content: 'KEEP_PEER_NOTE' },
    ]);
    await f.db.getRepository(DeviceToken).save({ userId: f.users.student.id, token: 'synthetic-private-push-token', platform: 'android', provider: 'rustore' });
    absenceId = (await f.makeAbsence(f.users.student)).id;
    await f.db.getRepository(AttendanceRecord).save({ universityId: f.uni.id, studentId: f.users.student.id, lessonId: f.lesson.id, status: 'present', markedById: f.users.teacher.id });
  }, 90000);
  afterAll(async () => { await f?.app.close(); }, 30000);

  it('requires identity, password and both explicit confirmations, without mutating on rejection', async () => {
    await http().delete('/api/v1/users/me').send(confirmed()).expect(401);
    await remove('peer', {}).expect(400);
    await remove('peer', { ...confirmed(), acknowledgeRetention: false }).expect(400);
    await remove('peer', { ...confirmed(), currentPassword: 'incorrect-synthetic-password' }).expect(401);
    const peer = await f.db.getRepository(User).findOneByOrFail({ id: f.users.peer.id });
    expect(peer.isActive).toBe(true); expect(peer.personalDataDeletedAt).toBeNull();
  });
  it('explains pseudonymous learning records, external files, financial exceptions and the export opportunity', async () => {
    const result = await preview('student').expect(200);
    expect(result.body.archiveModel).toBe('pseudonymous');
    expect(result.body.retained.join(' ')).toContain('не полное обезличивание');
    expect(result.body.blockers).toEqual([]);
    expect(result.body.downloadBeforeDeletion).toBe('/api/v1/users/me/export');
  });
  it('erases profile/private rows across universities, revokes all sessions, and preserves individual learning history', async () => {
    const result = await remove('student', confirmed()).expect(200);
    expect(result.body.success).toBe(true);
    expect(result.body.archiveCode).toBe(f.users.student.id);
    expect(result.body.removedCounts.personal_lesson_notes).toBe(2);
    const user = await f.db.getRepository(User).findOneByOrFail({ id: f.users.student.id });
    expect(user).toMatchObject({ firstName: 'Архив', lastName: f.users.student.id.slice(0, 8), phone: null, avatarUrl: null, maxUserId: null, telegramUserId: null, sourceTeacherId: null, isActive: false });
    expect(user.email).not.toBe(f.users.student.email);
    expect(user.passwordHash).not.toBe(f.users.student.passwordHash);
    expect(user.personalDataDeletedAt).toBeInstanceOf(Date);
    expect(user.sessionVersion).toBeGreaterThan(f.users.student.sessionVersion);
    expect(await f.db.getRepository(PersonalLessonNote).countBy({ userId: user.id })).toBe(0);
    expect(await f.db.getRepository(DeviceToken).countBy({ userId: user.id })).toBe(0);
    expect(await f.db.getRepository(PersonalLessonNote).countBy({ userId: f.users.peer.id })).toBe(1);
    expect(await f.db.getRepository(Absence).findOneBy({ id: absenceId })).toMatchObject({ studentId: user.id });
    expect(await f.db.getRepository(AttendanceRecord).findOneBy({ studentId: user.id })).toMatchObject({ status: 'present' });
    await http().get('/api/v1/users/me').auth(tokens.student, { type: 'bearer' }).expect(401);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: refresh.student }).expect(401);
    await http().post('/api/v1/auth/login').send({ email: f.users.student.email, password: f.password }).expect(401);
  });
  it('cannot reactivate the tombstone or recreate private data through a stale actor or background write', async () => {
    await expect(f.db.getRepository(User).update(f.users.student.id, { isActive: true })).rejects.toMatchObject({ driverError: { code: '42501' } });
    await expect(f.db.getRepository(PersonalLessonNote).save({ userId: f.users.student.id, universityId: f.uni.id, pairSpaceId: randomUUID(), content: 'MUST_NOT_RETURN' })).rejects.toMatchObject({ driverError: { code: '42501' } });
    const tenant = f.app.get(TenantContext), source = f.app.get(DataSource);
    await tenant.runInRequest(async () => {
      tenant.setUser({ id: f.users.student.id, email: f.users.student.email, role: UserRole.STUDENT, universityId: f.uni.id });
      await expect(source.query('UPDATE absences SET comment=$1 WHERE id=$2', ['STALE_ACTOR_WRITE', absenceId])).rejects.toMatchObject({ driverError: { code: '42501' } });
    });
  });
  it('protects platform ownership and the last university administrator', async () => {
    await f.db.getRepository(PlatformControl).save({ id: 'platform', ownerId: f.users.teacher.id });
    await remove('teacher', confirmed()).expect(403);
    await remove('admin', confirmed()).expect(409).expect(({ body }) => expect(body.blockers.some(blocker => blocker.code === 'university_admin')).toBe(true));
    expect((await f.db.getRepository(User).findOneByOrFail({ id: f.users.admin.id })).personalDataDeletedAt).toBeNull();
  });
  it('blocks deleting the sole company owner and permits a career member to delete their own account', async () => {
    await f.db.getRepository(User).update(f.users.outsider.id, { role: UserRole.EMPLOYER, universityId: null });
    await f.db.getRepository(User).update(f.users.otherStudent.id, { role: UserRole.EMPLOYER, universityId: null });
    for (const actor of ['outsider', 'otherStudent']) tokens[actor] = (await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200)).body.accessToken;
    const company = await f.db.getRepository(CareerCompany).save({ name: 'Синтетическая компания', createdBy: f.users.outsider.id });
    await f.db.getRepository(CareerMembership).save([
      { companyId: company.id, universityId: null, userId: f.users.outsider.id, role: 'company_owner' },
      { companyId: company.id, universityId: null, userId: f.users.otherStudent.id, role: 'company_member' },
    ]);
    await remove('outsider', confirmed()).expect(409).expect(({ body }) => expect(body.blockers.some(blocker => blocker.code === 'company_owner')).toBe(true));
    await preview('otherStudent').expect(200);
    await remove('otherStudent', confirmed()).expect(200);
    expect((await f.db.getRepository(CareerMembership).findOneByOrFail({ userId: f.users.otherStudent.id })).revokedAt).toBeInstanceOf(Date);
    expect((await f.db.getRepository(User).findOneByOrFail({ id: f.users.outsider.id })).isActive).toBe(true);
  });
});
