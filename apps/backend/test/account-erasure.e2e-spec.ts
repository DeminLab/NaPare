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
import { PairSpace } from '../src/pair-space/entities/pair-space.entity';
import { DiscussionMessage } from '../src/pair-space/entities/discussion-message.entity';
import { FileAttachment } from '../src/pair-space/entities/file-attachment.entity';
import { AcademicIdentity } from '../src/semester/academic-identity.entity';
import { CareerPayment } from '../src/career-billing/payment.entity';
import { EventRecord } from '../src/events/entities/event-record.entity';
import { Faculty } from '../src/users/entities/faculty.entity';
import { Group } from '../src/users/entities/group.entity';
import { CuratorAssignment } from '../src/curation/entities/curator-assignment.entity';

const suite = process.env.ACCOUNT_ERASURE_TEST_DATABASE_URL ? describe : describe.skip;
suite('Account erasure: local private data removed, individual archive retained', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {}, refresh: Record<string, string> = {};
  let ip = 0, absenceId: string, retainedRequestId: string;
  const http = () => request(f.app.getHttpServer());
  const remove = (actor: string, body: object) => http().delete('/api/v1/users/me').set('X-Forwarded-For', `192.0.2.${++ip}`).auth(tokens[actor], { type: 'bearer' }).send({ expectedUserId: f.users[actor].id, ...body });
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
    // A reserved/predictable email must not let another account prevent self-erasure.
    await f.db.getRepository(User).save({ email: `deleted-${f.users.student.id}@account.invalid`, passwordHash: f.users.peer.passwordHash, firstName: 'Синтетический', lastName: 'Резерв', role: UserRole.EMPLOYER, universityId: null });
    await f.db.getRepository(PersonalLessonNote).save([
      { userId: f.users.student.id, universityId: f.uni.id, pairSpaceId: randomUUID(), content: 'OWN_PRIVATE_NOTE' },
      { userId: f.users.student.id, universityId: f.otherUni.id, pairSpaceId: randomUUID(), content: 'OWN_OLD_UNIVERSITY_NOTE' },
      { userId: f.users.peer.id, universityId: f.uni.id, pairSpaceId: randomUUID(), content: 'KEEP_PEER_NOTE' },
    ]);
    await f.db.getRepository(DeviceToken).save({ userId: f.users.student.id, token: 'synthetic-private-push-token', platform: 'android', provider: 'rustore' });
    const space = await f.db.getRepository(PairSpace).save({ universityId: f.uni.id, lessonId: f.lesson.id, subject: 'Учебный архив', date: new Date(), pairNumber: 1 });
    await f.db.getRepository(DiscussionMessage).save([
      { pairSpaceId: space.id, userId: f.users.student.id, text: 'PRIVATE_CONTACT_IN_CHAT' },
      { pairSpaceId: space.id, userId: f.users.peer.id, text: 'KEEP_PEER_MESSAGE' },
    ]);
    await f.db.getRepository(FileAttachment).save({ pairSpaceId: space.id, uploadedBy: f.users.student.id, fileUrl: 'https://example.test/private-name.pdf', fileName: 'private-name.pdf', fileType: 'pdf', size: 10 });
    await f.db.getRepository(AcademicIdentity).save({ universityId: f.otherUni.id, userId: f.users.student.id, sourceBaseUrl: 'https://moodle.example.test/', externalUserId: '100', linkedBy: f.users.admin.id });
    absenceId = (await f.makeAbsence(f.users.student)).id;
    await f.db.getRepository(EventRecord).save({ id: randomUUID(), universityId: f.otherUni.id, type: 'absence.created', actor: { id: f.users.student.id, type: 'user' }, timestamp: new Date(), target: { type: 'absence', id: absenceId }, payload: { privateText: 'PRIVATE_EVENT_SENTINEL' }, priority: 'normal' });
    await f.db.getRepository(AttendanceRecord).save({ universityId: f.uni.id, studentId: f.users.student.id, lessonId: f.lesson.id, status: 'present', markedById: f.users.teacher.id });
  }, 90000);
  afterAll(async () => { await f?.app.close(); }, 30000);

  it('requires identity, password and both explicit confirmations, without mutating on rejection', async () => {
    await http().delete('/api/v1/users/me').send(confirmed()).expect(401);
    await remove('peer', {}).expect(400);
    await remove('peer', { ...confirmed(), acknowledgeRetention: false }).expect(400);
    await remove('peer', { ...confirmed(), currentPassword: 'incorrect-synthetic-password' }).expect(401);
    await remove('peer', { ...confirmed(), expectedUserId: f.users.outsider.id }).expect(409);
    const peer = await f.db.getRepository(User).findOneByOrFail({ id: f.users.peer.id });
    expect(peer.isActive).toBe(true); expect(peer.personalDataDeletedAt).toBeNull();
    for (const result of [
      await http().patch('/api/v1/users/me').auth(tokens.peer, { type: 'bearer' }).send({ firstName: 'Проверено' }).expect(200),
      await http().post('/api/v1/users/me/bind-group').auth(tokens.peer, { type: 'bearer' }).send({ groupId: f.groups[0].id }).expect(201),
    ]) for (const field of ['passwordHash', 'sessionVersion', 'telegramUserId', 'maxUserId']) expect(result.body).not.toHaveProperty(field);
  });
  it('explains pseudonymous learning records, external files, financial exceptions and the export opportunity', async () => {
    const result = await preview('student').expect(200);
    expect(result.headers['cache-control']).toContain('no-store');
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
    expect(await f.db.getRepository(AcademicIdentity).countBy({ userId: user.id })).toBe(0);
    expect(await f.db.getRepository(DiscussionMessage).findOneBy({ userId: user.id })).toMatchObject({ text: '[Сообщение удалено]' });
    expect(await f.db.getRepository(DiscussionMessage).findOneBy({ userId: f.users.peer.id })).toMatchObject({ text: 'KEEP_PEER_MESSAGE' });
    expect(await f.db.getRepository(FileAttachment).findOneBy({ uploadedBy: user.id })).toMatchObject({ fileUrl: '', fileName: 'Удалённый файл', revokedBy: user.id });
    expect(await f.db.getRepository(PersonalLessonNote).countBy({ userId: f.users.peer.id })).toBe(1);
    expect(await f.db.getRepository(Absence).findOneBy({ id: absenceId })).toMatchObject({ studentId: user.id });
    expect(await f.db.getRepository(AttendanceRecord).findOneBy({ studentId: user.id })).toMatchObject({ status: 'present' });
    expect(await f.db.getRepository(EventRecord).findOneBy({ universityId: f.otherUni.id })).toMatchObject({ actor: { type: 'user', id: user.id }, payload: { redacted: true } });
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
    const runner = f.db.createQueryRunner();
    try { await expect(new AccountErasure1700000000038().down(runner)).rejects.toThrow('Cannot remove the tombstone guard'); }
    finally { await runner.release(); }
  });
  it('protects platform ownership and the last university administrator', async () => {
    await f.db.getRepository(PlatformControl).save({ id: 'platform', ownerId: f.users.teacher.id });
    await remove('teacher', confirmed()).expect(403);
    await remove('admin', confirmed()).expect(409).expect(({ body }) => expect(body.blockers.some(blocker => blocker.code === 'university_admin')).toBe(true));
    expect((await f.db.getRepository(User).findOneByOrFail({ id: f.users.admin.id })).personalDataDeletedAt).toBeNull();
  });
  it('rolls back every private-data deletion if the final tombstone write fails', async () => {
    await f.db.query('ALTER TABLE users ADD CONSTRAINT synthetic_reject_erasure CHECK ("personalDataDeletedAt" IS NULL) NOT VALID');
    try {
      await remove('peer', confirmed()).expect(500);
      expect((await f.db.getRepository(User).findOneByOrFail({ id: f.users.peer.id })).personalDataDeletedAt).toBeNull();
      expect(await f.db.getRepository(PersonalLessonNote).countBy({ userId: f.users.peer.id })).toBe(1);
      expect(await f.db.getRepository(DiscussionMessage).findOneBy({ userId: f.users.peer.id })).toMatchObject({ text: 'KEEP_PEER_MESSAGE' });
    } finally { await f.db.query('ALTER TABLE users DROP CONSTRAINT synthetic_reject_erasure'); }
  });
  it('requires office route and pending-stage handoff, then clears blockers after actual reassignment', async () => {
    tokens.legacy = (await http().post('/api/v1/auth/login').set('X-Forwarded-For', '192.0.2.221').send({ email: f.users.legacy.email, password: f.password }).expect(200)).body.accessToken;
    const group = f.groups[1];
    await f.db.getRepository(Faculty).update(group.facultyId, { deanUserId: f.users.dean.id });
    await http().post('/api/v1/requests/assignments').auth(tokens.admin, { type: 'bearer' }).send({ userId: f.users.admin.id, duty: 'office', facultyIds: [], groupIds: [group.id] }).expect(201);
    await http().put('/api/v1/requests/routes').auth(tokens.admin, { type: 'bearer' }).send({ groupId: group.id, type: 'absence', assigneeIds: [f.users.admin.id, f.users.legacy.id], version: 0, dueDays: 5 }).expect(200);
    await http().post('/api/v1/users/me/bind-group').auth(tokens.peer, { type: 'bearer' }).send({ groupId: group.id }).expect(201);
    const draft = await http().post('/api/v1/requests').auth(tokens.peer, { type: 'bearer' }).send({ type: 'absence', title: 'Учебный архив', description: 'Синтетическое заявление для проверки передачи обязанностей', idempotencyKey: randomUUID() }).expect(201);
    retainedRequestId = draft.body.id;
    const command = (actor: string, action: string, version: number, extra = {}) => http().post(`/api/v1/requests/${retainedRequestId}/commands`).auth(tokens[actor], { type: 'bearer' }).send({ action, version, idempotencyKey: randomUUID(), ...extra });
    await command('peer', 'submit', 1).expect(200);
    await command('admin', 'accept', 2).expect(200);
    await command('admin', 'approve', 3, { reason: 'Сведения подтверждены' }).expect(200);
    await preview('legacy').expect(200).expect(({ body }) => expect(body.blockers.some(blocker => blocker.code === 'office_route')).toBe(true));
    await remove('legacy', confirmed()).expect(409);
    await http().put('/api/v1/requests/routes').auth(tokens.admin, { type: 'bearer' }).send({ groupId: group.id, type: 'absence', assigneeIds: [f.users.admin.id, f.users.dean.id], version: 1, dueDays: 5 }).expect(200);
    await preview('legacy').expect(200).expect(({ body }) => {
      expect(body.blockers.some(blocker => blocker.code === 'office_route')).toBe(false);
      expect(body.blockers.some(blocker => blocker.code === 'pending_approval')).toBe(true);
    });
    await remove('legacy', confirmed()).expect(409);
    await command('admin', 'reassign', 4, { sequence: 1, assigneeId: f.users.dean.id, reason: 'Передача обязанностей другому согласующему' }).expect(200);
    await preview('legacy').expect(200).expect(({ body }) => expect(body.blockers).toEqual([]));
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
    // Synthetic stored payment only: no bank call, charge or refund occurs in this suite.
    const payment = await f.db.getRepository(CareerPayment).save({ companyId: company.id, createdBy: f.users.otherStudent.id, idempotencyKey: randomUUID(), product: 'company_basic', receiptEmail: 'member@finance.example.test', amountMinor: 100, currency: 'RUB', state: 'succeeded' });
    await remove('outsider', confirmed()).expect(409).expect(({ body }) => expect(body.blockers.some(blocker => blocker.code === 'company_owner')).toBe(true));
    await preview('otherStudent').expect(200);
    await remove('otherStudent', confirmed()).expect(200).expect(({ body }) => expect(body.retained.join(' ')).toContain('email для чека'));
    expect((await f.db.getRepository(CareerMembership).findOneByOrFail({ userId: f.users.otherStudent.id })).revokedAt).toBeInstanceOf(Date);
    expect((await f.db.getRepository(User).findOneByOrFail({ id: f.users.outsider.id })).isActive).toBe(true);
    expect((await f.db.query('SELECT "receiptEmail","createdBy" FROM career_payments WHERE id=$1', [payment.id]))[0]).toEqual({ receiptEmail: 'member@finance.example.test', createdBy: f.users.otherStudent.id });
  });
  it('waits for an already-running private write, then deletes that committed row as part of the same account erasure', async () => {
    const source = f.app.get(DataSource), tenant = f.app.get(TenantContext);
    const writer = source.createQueryRunner();
    let deletion: Promise<request.Response> | undefined;
    await tenant.runInRequest(async () => {
      tenant.setUser({ id: f.users.peer.id, email: f.users.peer.email, role: UserRole.STUDENT, universityId: f.uni.id });
      try {
        await writer.connect(); await writer.startTransaction();
        await writer.query('INSERT INTO personal_lesson_notes ("universityId","pairSpaceId","userId",content) VALUES ($1,$2,$3,$4)', [f.uni.id, randomUUID(), f.users.peer.id, 'IN_FLIGHT_PRIVATE_NOTE']);
        deletion = remove('peer', confirmed()).then(response => response);
        let blocked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const [state] = await f.db.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%passwordHash%'`);
          if (state.count > 0) { blocked = true; break; }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        expect(blocked).toBe(true);
        await writer.commitTransaction();
        const response = await deletion;
        expect(response.status).toBe(200);
        expect(response.body.removedCounts.personal_lesson_notes).toBe(2);
        expect(await f.db.getRepository(PersonalLessonNote).countBy({ userId: f.users.peer.id })).toBe(0);
        await http().get(`/api/v1/requests/${retainedRequestId}`).auth(tokens.admin, { type: 'bearer' }).expect(200).expect(({ body }) => {
          expect(body.studentId).toBe(f.users.peer.id);
          expect(body.studentName).toContain('Архив');
          expect(body.status).toBe('in_review');
        });
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
        await deletion;
      }
    });
  }, 15000);
  it('rejects a session revoked while the erasure request was waiting for its mutation lock', async () => {
    tokens.legacy = (await http().post('/api/v1/auth/login').set('X-Forwarded-For', '192.0.2.220').send({ email: f.users.legacy.email, password: f.password }).expect(200)).body.accessToken;
    const mutex = f.db.createQueryRunner();
    let deletion: Promise<request.Response> | undefined;
    try {
      await mutex.connect(); await mutex.startTransaction();
      await mutex.query('SELECT pg_advisory_xact_lock(707247126)');
      deletion = remove('legacy', confirmed()).then(response => response);
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const [state] = await f.db.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%707247126%'`);
        if (state.count > 0) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(blocked).toBe(true);
      await mutex.query('UPDATE users SET "sessionVersion"="sessionVersion"+1 WHERE id=$1', [f.users.legacy.id]);
      await mutex.commitTransaction();
      expect((await deletion).status).toBe(401);
      const user = await f.db.getRepository(User).findOneByOrFail({ id: f.users.legacy.id });
      expect(user.isActive).toBe(true); expect(user.personalDataDeletedAt).toBeNull();
    } finally {
      if (mutex.isTransactionActive) await mutex.rollbackTransaction();
      await mutex.release();
      await deletion;
    }
    tokens.legacy = (await http().post('/api/v1/auth/login').set('X-Forwarded-For', '192.0.2.222').send({ email: f.users.legacy.email, password: f.password }).expect(200)).body.accessToken;
    await remove('legacy', confirmed()).expect(200);
    expect((await f.db.getRepository(Group).findOneByOrFail({ id: f.groups[1].id })).curatorId).toBeNull();
    expect((await f.db.getRepository(CuratorAssignment).findBy({ userId: f.users.legacy.id })).every(row => row.revokedAt !== null)).toBe(true);
  }, 15000);
});
