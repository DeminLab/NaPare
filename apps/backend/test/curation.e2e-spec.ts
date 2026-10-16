import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createCurationFixture } from './curation.fixture';
import { CuratorAssignment } from '../src/curation/entities/curator-assignment.entity';
import { AbsenceConfirmation } from '../src/absences/entities/absence-confirmation.entity';
import { AuditLog } from '../src/common/entities/audit-log.entity';
import { EventRecord } from '../src/events/entities/event-record.entity';
import { User } from '../src/users/entities/user.entity';

const suite = process.env.CURATION_TEST_DATABASE_URL ? describe : describe.skip;
suite('Curation: real PostgreSQL, HTTP and existing JWT sessions', () => {
  let fixture: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  const http = () => request(fixture.app.getHttpServer());
  const get = (path: string, who = 'student') => http().get(`/api/v1${path}`).auth(tokens[who], { type: 'bearer' });
  const assignment = (group: number, who: string, grant = true, actor = 'dean') => {
    const path = `/api/v1/curation/groups/${fixture.groups[group].id}/curators/${fixture.users[who].id}`;
    return (grant ? http().put(path) : http().delete(path)).auth(tokens[actor], { type: 'bearer' });
  };
  const decide = (id: string, who = 'student', status = 'confirm') => http().patch(`/api/v1/curator/absences/${id}/${status}`).auth(tokens[who], { type: 'bearer' }).send(status === 'reject' ? { reason: 'Не подтверждено' } : { comment: 'Документы проверены' });

  beforeAll(async () => {
    fixture = await createCurationFixture(process.env.CURATION_TEST_DATABASE_URL!);
    for (const [key, user] of Object.entries(fixture.users)) {
      if (!user.isActive) continue;
      const response = await http().post('/api/v1/auth/login').send({ email: user.email, password: fixture.password }).expect(200);
      tokens[key] = response.body.accessToken;
    }
  }, 60000);
  afterAll(async () => { await fixture?.app.close(); });

  it('backfills valid legacy assignments without granting cross-university access', async () => {
    expect(await fixture.db.getRepository(CuratorAssignment).count()).toBe(1);
    const result = await get('/curation/groups', 'legacy').expect(200);
    expect(result.body.data.map((g: { id: string }) => g.id)).toEqual([fixture.groups[1].id]);
  });
  it('requires authentication and rejects unknown query fields', async () => {
    await http().get('/api/v1/curation/context').expect(401);
    await get('/curation/groups?universityId=' + fixture.otherUni.id).expect(400);
    await get('/curation/groups/not-a-uuid/students').expect(400);
  });
  it('only the deanery/admin can grant; blocked or foreign accounts cannot be assigned', async () => {
    await assignment(0, 'student', true, 'student').expect(403);
    await assignment(0, 'student', true, 'teacher').expect(403);
    await assignment(0, 'outsider').expect(400);
    await assignment(0, 'blocked').expect(400);
    await assignment(3, 'student').expect(404);
    await http().patch(`/api/v1/admin/users/${fixture.users.student.id}/roles`).auth(tokens.admin, { type: 'bearer' }).send({ role: 'curator' }).expect(400);
  });
  it('grants multiple curators/groups and activates rights on the same student JWT', async () => {
    expect((await get('/curation/context')).body.canCurate).toBe(false);
    await assignment(0, 'student').expect(200);
    await assignment(0, 'teacher').expect(200);
    await assignment(1, 'student', true, 'admin').expect(200);
    await assignment(0, 'student').expect(200).expect(({ body }) => expect(body.changed).toBe(false));
    const context = await get('/curation/context').expect(200);
    expect(context.body).toMatchObject({ canCurate: true, canManage: false, groupCount: 2 });
    const profile = await get('/users/me').expect(200);
    expect(profile.body.role).toBe('student');
    expect(profile.body.groupId).toBe(fixture.groups[0].id);
    const portal = await http().post('/api/v1/auth/portal-login').send({ email: fixture.users.student.email, password: fixture.password }).expect(200);
    expect(portal.body.workspace).toBe('student');
  });
  it('keeps primary staff roles and supports curator assignment to a dean account', async () => {
    await assignment(1, 'dean').expect(200);
    expect((await get('/curation/context', 'dean')).body.canCurate).toBe(true);
    expect((await get('/users/me', 'teacher')).body.role).toBe('teacher');
    expect((await get('/users/me', 'dean')).body.role).toBe('faculty_dean');
  });
  it('scopes lists and pagination, resolving external SIBIT group IDs without leaking private fields', async () => {
    const groups = await get('/curation/groups?limit=1&page=2').expect(200);
    expect(groups.body.meta).toMatchObject({ total: 2, page: 2, totalPages: 2 });
    const roster = await get(`/curation/groups/${fixture.groups[0].id}/students`).expect(200);
    expect(roster.body.data.map((user: User) => user.id)).toEqual(expect.arrayContaining([fixture.users.student.id, fixture.users.peer.id]));
    expect(roster.body.data[0]).not.toHaveProperty('passwordHash');
    expect(roster.body.data[0]).not.toHaveProperty('email');
    await get(`/curation/groups/${fixture.groups[2].id}/students`).expect(403);
    await get(`/curation/groups/${fixture.groups[3].id}/students`).expect(404);
    await get(`/curation/groups/${fixture.groups[0].id}/lessons`).expect(200).expect(({ body }) => expect(body.data[0].id).toBe(fixture.lesson.id));
    await get('/curation/manage/candidates').expect(403);
    const candidates = await get('/curation/manage/candidates?q=peer', 'dean').expect(200);
    expect(candidates.body.data[0].id).toBe(fixture.users.peer.id);
    expect(candidates.body.data[0]).not.toHaveProperty('passwordHash');
  });
  it('blocks direct access to unrelated absences and self-review', async () => {
    const own = await fixture.makeAbsence(fixture.users.student);
    const foreign = await fixture.makeAbsence(fixture.users.otherStudent);
    await decide(own.id).expect(403);
    await decide(foreign.id).expect(403);
    await decide(randomUUID()).expect(404);
    await get(`/curation/absences/${foreign.id}/context`).expect(403);
    await get(`/curation/absences/${own.id}/context`).expect(200).expect(({ body }) => expect(body.id).toBe(fixture.groups[0].id));
    const response = await get('/curation/absences?status=pending').expect(200);
    expect(response.body.data.some((item: { id: string }) => item.id === foreign.id)).toBe(false);
    expect(response.body.data.find((item: { id: string }) => item.id === own.id).canReview).toBe(false);
  });
  it('does not turn a curator assignment into management or journal permissions', async () => {
    await http().post('/api/v1/absences/attendance').auth(tokens.student, { type: 'bearer' }).send({ lessonId: fixture.lesson.id, entries: [] }).expect(403);
    await get('/curation/manage/groups', 'legacy').expect(403);
    await get('/admin/groups', 'student').expect(403);
    const legacyGroups = await get('/admin/attendance-groups', 'legacy').expect(200);
    expect(legacyGroups.body.data.map((group: { id: string }) => group.id)).toEqual([fixture.groups[1].id]);
    await get(`/absences/lesson/${fixture.lesson.id}`, 'legacy').expect(403);
    await get(`/schedule/lessons/${fixture.lesson.id}`, 'legacy').expect(403);
    await get('/search?q=' + encodeURIComponent('программирования'), 'legacy').expect(200).expect(({ body }) => expect(body.results).toEqual([]));
    await http().post(`/api/v1/academic/courses/${randomUUID()}/series`).auth(tokens.legacy, { type: 'bearer' }).send({}).expect(403);
  });
  it('records a decision with its author and preserves the student reason', async () => {
    const absence = await fixture.makeAbsence();
    await decide(absence.id, 'student', 'reject').expect(200);
    const history = await fixture.db.getRepository(AbsenceConfirmation).findBy({ absenceId: absence.id });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ curatorId: fixture.users.student.id, status: 'rejected', comment: 'Не подтверждено' });
    const personal = await get('/absences/my', 'peer').expect(200);
    expect(personal.body.data.find((item: { id: string }) => item.id === absence.id)).toMatchObject({ comment: 'По болезни', status: 'rejected' });
    await decide(absence.id, 'teacher').expect(409);
  });
  it('allows only one of two concurrent decisions', async () => {
    const absence = await fixture.makeAbsence();
    const responses = await Promise.all([decide(absence.id), decide(absence.id, 'teacher')]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await fixture.db.getRepository(AbsenceConfirmation).countBy({ absenceId: absence.id })).toBe(1);
  });
  it('notifies the assigned curators and deanery without all-university curator broadcast', async () => {
    const response = await http().post('/api/v1/absences').auth(tokens.peer, { type: 'bearer' }).send({ type: 'sick', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString(), comment: 'По болезни' }).expect(201);
    const events = await fixture.db.getRepository(EventRecord).find({ where: { type: 'absence.created' }, order: { timestamp: 'DESC' } });
    const event = events.find(item => item.target.id === response.body.id)!;
    expect(event.recipients).toEqual(expect.arrayContaining([fixture.users.student.id, fixture.users.teacher.id, fixture.users.dean.id]));
    expect(event.recipients).not.toContain(fixture.users.legacy.id);
    expect(event.recipients).not.toContain(fixture.users.outsider.id);
  });
  it('revokes access immediately without invalidating the existing student session or other groups', async () => {
    const pending = await fixture.makeAbsence();
    await assignment(0, 'student', false).expect(200);
    await get('/users/me').expect(200).expect(({ body }) => expect(body.role).toBe('student'));
    await get(`/curation/groups/${fixture.groups[0].id}/students`).expect(403);
    await decide(pending.id).expect(403);
    expect((await get('/curation/context')).body.groupCount).toBe(1);
    await get(`/curation/groups/${fixture.groups[1].id}/students`).expect(200);
    expect(await fixture.db.getRepository(AuditLog).countBy({ action: 'curation.revoked', userId: fixture.users.dean.id })).toBe(1);
    const row = await fixture.db.getRepository(CuratorAssignment).findOneBy({ userId: fixture.users.student.id, groupId: fixture.groups[0].id });
    expect(row?.revokedAt).toBeInstanceOf(Date);
    expect(await fixture.db.getRepository(AbsenceConfirmation).countBy({ curatorId: fixture.users.student.id })).toBeGreaterThan(0);
  });
});
