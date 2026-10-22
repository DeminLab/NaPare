import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { createCurationFixture } from './curation.fixture';
import { Faculty } from '../src/users/entities/faculty.entity';
import { Group } from '../src/users/entities/group.entity';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { OfficeAssignments1700000000031 } from '../src/migrations/1700000000031-OfficeAssignments';
import { StudentRequests1700000000032 } from '../src/migrations/1700000000032-StudentRequests';
import { OfficeAssignment, RequestDecision, RequestStep, StudentRequest } from '../src/requests/request.entities';
import { AuditLog } from '../src/common/entities/audit-log.entity';
import { CuratorAssignment } from '../src/curation/entities/curator-assignment.entity';
import { OfficeRoute } from '../src/requests/request.entities';
import { Lesson } from '../src/schedule/entities/lesson.entity';
import { LessonChange } from '../src/schedule/entities/lesson-change.entity';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';

const suite = process.env.OFFICE_TEST_DATABASE_URL ? describe : describe.skip;
suite('Academic office: persisted assignments, workflow and PostgreSQL RLS', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  let method: User, dispatcher: User, foreignStudent: User, officeAssignment: string, dispatcherAssignment: string, secondFaculty: Faculty;
  const http = () => request(f.app.getHttpServer());
  const get = (path: string, actor = 'admin') => http().get(`/api/v1/requests${path}`).auth(tokens[actor], { type: 'bearer' });
  const post = (path: string, body: object, actor = 'admin') => http().post(`/api/v1/requests${path}`).auth(tokens[actor], { type: 'bearer' }).send(body);
  const command = async (id: string, action: string, actor: string, extra = {}) => {
    const current = await get(`/${id}`, actor).expect(200);
    return post(`/${id}/commands`, { action, version: current.body.version, idempotencyKey: randomUUID(), reason: 'Тестовое основание решения', ...extra }, actor);
  };
  const draft = async (type = 'absence', actor = 'student', extra = {}) => (await post('', { type, title: 'Тестовое заявление', description: 'Описание учебного обращения', idempotencyKey: randomUUID(), ...extra }, actor).expect(201)).body.id as string;
  const submitted = async (type = 'absence', actor = 'student') => { const id = await draft(type, actor); await command(id, 'submit', actor).then(result => expect(result.status).toBe(200)); return id; };
  const assignment = async (userId: string, duty: string, groupIds: string[], extra = {}) => (await post('/assignments', { userId, duty, facultyIds: [], groupIds, ...extra }).expect(201)).body.id as string;

  beforeAll(async () => {
    f = await createCurationFixture(process.env.OFFICE_TEST_DATABASE_URL!);
    // Exercise actual migrations on empty feature tables, not just synchronize.
    await f.db.query('DROP TABLE request_documents, request_decisions, request_steps, student_requests, office_routes, office_assignments');
    const runner = f.db.createQueryRunner();
    try { await new OfficeAssignments1700000000031().up(runner); await new StudentRequests1700000000032().up(runner); } finally { await runner.release(); }
    secondFaculty = await f.db.getRepository(Faculty).save({ universityId: f.uni.id, name: 'Второй факультет', code: 'ВТ' });
    await f.db.getRepository(Group).update(f.groups[2].id, { facultyId: secondFaculty.id });
    await f.db.getRepository(Faculty).update(f.groups[0].facultyId, { deanUserId: f.users.dean.id });
    const employee = async (key: string) => f.db.getRepository(User).save({ universityId: f.uni.id, role: UserRole.TEACHER, firstName: key, lastName: 'Сотрудник', email: `${key}@office.test`, passwordHash: f.users.student.passwordHash });
    method = await employee('method'); dispatcher = await employee('dispatcher');
    foreignStudent = await f.db.getRepository(User).save({ universityId: f.otherUni.id, role: UserRole.STUDENT, groupId: f.groups[3].id, firstName: 'Чужой', lastName: 'Студент', email: 'foreign@office.test', passwordHash: f.users.student.passwordHash });
    const accounts = { ...f.users, method, dispatcher, foreignStudent };
    for (const [key, user] of Object.entries(accounts)) {
      if (!user.isActive) continue;
      const response = await http().post('/api/v1/auth/login').send({ email: user.email, password: f.password }).expect(200);
      tokens[key] = response.body.accessToken;
      // Setup issues more accounts than the login/IP budget. Reset only between
      // fixture logins; every HTTP request still traverses the actual guard.
      const storage = f.app.get<ThrottlerStorageService>(getStorageToken());
      storage.onApplicationShutdown();
      for (const key of Object.keys(storage.storage)) delete storage.storage[key];
    }
    officeAssignment = await assignment(f.users.teacher.id, 'office', [f.groups[0].id]);
    await assignment(method.id, 'methodologist', [f.groups[0].id]);
    dispatcherAssignment = await assignment(dispatcher.id, 'dispatcher', [f.groups[0].id]);
  }, 90000);
  afterAll(async () => { await f?.app.close(); }, 30000);

  it('runs with non-superuser and FORCE RLS on all six feature tables', async () => {
    const [role] = await f.db.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    const rows = await f.db.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('office_assignments','office_routes','student_requests','request_steps','request_decisions','request_documents')");
    expect(rows).toHaveLength(6); expect(rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });
  it('rejects foreign user/group/faculty assignments and employee self-administration', async () => {
    const body = { userId: f.users.teacher.id, duty: 'office', groupIds: [], facultyIds: [] };
    await post('/assignments', { ...body, userId: f.users.outsider.id }).expect(400);
    await post('/assignments', { ...body, groupIds: [f.groups[3].id] }).expect(404);
    const faculty = await f.db.getRepository(Faculty).findOneByOrFail({ universityId: f.otherUni.id });
    await post('/assignments', { ...body, facultyIds: [faculty.id] }).expect(400);
    await post('/assignments', body, 'teacher').expect(403);
  });
  it('keeps student drafts private and blocks foreign student/body/document references', async () => {
    const id = await draft();
    await get(`/${id}`, 'teacher').expect(403);
    await get(`/${id}`, 'admin').expect(403);
    await post('', { type: 'absence', title: 'Тест', description: 'Тестовый текст', idempotencyKey: randomUUID(), studentId: foreignStudent.id }).expect(400);
    await post('', { type: 'absence', title: 'Тест', description: 'Тестовый текст', idempotencyKey: randomUUID(), attachmentIds: [randomUUID()] }, 'student').expect(400);
    await post('', { type: 'absence', title: '   ', description: '     ', idempotencyKey: randomUUID() }, 'student').expect(400);
    await get(`/${id}`, 'foreignStudent').expect(404);
  });
  it('requires explicit permission for an operator to create on behalf of a student', async () => {
    await post('', { type: 'absence', title: 'За студента', description: 'Поданное оператором', studentId: f.users.student.id, idempotencyKey: randomUUID() }, 'teacher').expect(403);
    const permission = await assignment(f.users.teacher.id, 'office', [f.groups[0].id], { canCreateForStudents: true });
    const id = await draft('absence', 'teacher', { studentId: f.users.student.id });
    const result = await get(`/${id}`, 'teacher').expect(200);
    expect(result.body.createdBy).toBe(f.users.teacher.id); expect(result.body.studentId).toBe(f.users.student.id);
    await http().delete(`/api/v1/requests/assignments/${permission}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    const audit = await f.db.getRepository(AuditLog).findOneByOrFail({ entityId: id, action: 'office.request.created' });
    expect(JSON.stringify(audit.newValues)).not.toContain('Описание');
  });
  it('keeps default stages, idempotency and concurrent decisions consistent', async () => {
    const id = await submitted();
    let row = (await get(`/${id}`, 'teacher').expect(200)).body;
    expect(row.steps.map(step => step.duty)).toEqual(['office', 'curator_or_dean']);
    await command(id, 'accept', 'teacher'); row = (await get(`/${id}`, 'teacher')).body;
    const cmd = { action: 'approve', version: row.version, reason: 'Рассмотрено', idempotencyKey: randomUUID() };
    const [a, b] = await Promise.all([post(`/${id}/commands`, cmd, 'teacher'), post(`/${id}/commands`, { ...cmd, idempotencyKey: randomUUID() }, 'teacher')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const accepted = a.status === 200 ? a : b;
    const key = a.status === 200 ? cmd.idempotencyKey : (await f.db.getRepository(RequestDecision).findOneByOrFail({ requestId: id, action: 'approve' })).idempotencyKey;
    await post(`/${id}/commands`, { ...cmd, idempotencyKey: key }, 'teacher').expect(200).expect(({ body }) => expect(body).toEqual(accepted.body));
    await post(`/${id}/commands`, { ...cmd, reason: 'Другая команда', idempotencyKey: key }, 'teacher').expect(409);
    await command(id, 'approve', 'dean');
    expect((await get(`/${id}`, 'student')).body.status).toBe('approved');
    await command(id, 'close', 'teacher', { resultReference: 'Приказ 22-Т' });
    row = (await get(`/${id}`, 'student')).body; expect(row.status).toBe('closed'); expect(row.resultReference).toBe('Приказ 22-Т');
    const student = await f.db.getRepository(User).findOneByOrFail({ id: f.users.student.id });
    expect(student.groupId).toBe(f.groups[0].id);
    expect(await f.db.getRepository(RequestDecision).countBy({ requestId: id, action: 'approve' })).toBe(2);
  });
  it('rechecks revoked assignments for an already issued JWT', async () => {
    const id = await submitted();
    await get(`/${id}`, 'teacher').expect(200);
    await http().delete(`/api/v1/requests/assignments/${officeAssignment}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    await get(`/${id}`, 'teacher').expect(403);
    await post(`/${id}/commands`, { action: 'accept', version: 2, idempotencyKey: randomUUID() }, 'teacher').expect(403);
    const list = await get('', 'teacher').expect(200); expect(list.body.data).toEqual([]);
    officeAssignment = await assignment(f.users.teacher.id, 'office', [f.groups[0].id]);
  });
  it('does not expand dispatcher or methodologist access to all requests in their group', async () => {
    const id = await submitted('absence');
    await get(`/${id}`, 'dispatcher').expect(403);
    await get(`/${id}`, 'method').expect(403);
    await get('', 'dispatcher').expect(200).expect(({ body }) => expect(body.data).toEqual([]));
  });
  it('denies another faculty within the same university and prevents self-approval assignment', async () => {
    const extraOffice = await assignment(f.users.legacy.id, 'office', [f.groups[2].id]);
    const permission = await assignment(f.users.legacy.id, 'office', [f.groups[2].id], { canCreateForStudents: true });
    const id = await draft('absence', 'legacy', { studentId: f.users.otherStudent.id });
    await command(id, 'submit', 'legacy').then(result => expect(result.status).toBe(400)); // no dean/curator for faculty 2
    await get(`/${id}`, 'teacher').expect(403);
    const own = await submitted();
    await get(`/${own}`, 'legacy').expect(403);
    await command(own, 'reassign', 'teacher', { sequence: 0, assigneeId: f.users.student.id }).then(result => expect(result.status).toBe(400));
    for (const key of [extraOffice, permission]) await http().delete(`/api/v1/requests/assignments/${key}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
  });
  it('preserves approved stages and history through clarification and reassignment', async () => {
    const id = await submitted('transfer');
    await command(id, 'accept', 'teacher'); await command(id, 'approve', 'teacher');
    await command(id, 'needs_changes', 'method', { reason: 'Уточните основание перевода' });
    await command(id, 'revise', 'student', { description: 'Дополненное основание перевода' });
    await command(id, 'accept', 'teacher');
    const otherMethod = await assignment(f.users.legacy.id, 'methodologist', [f.groups[0].id]);
    await command(id, 'reassign', 'teacher', { sequence: 1, assigneeId: f.users.legacy.id });
    const row = (await get(`/${id}`, 'student')).body;
    expect(row.steps[0].state).toBe('approved'); expect(row.steps[1].assigneeId).toBe(f.users.legacy.id);
    expect(row.history.map(item => item.action)).toEqual(['submit','accept','approve','needs_changes','revise','accept','reassign']);
    expect(row.workflowVersion).toBe(2);
    await command(id, 'approve', 'legacy'); await command(id, 'reject', 'dean', { reason: 'Отказ с основанием' });
    expect((await get(`/${id}`, 'student')).body.status).toBe('rejected');
    await http().delete(`/api/v1/requests/assignments/${otherMethod}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
  });
  it('validates route versions, stages and faculty-bound dean before applying to future requests', async () => {
    const body = { groupId: f.groups[0].id, type: 'retake', assigneeIds: [f.users.teacher.id, method.id, f.users.dean.id], version: 0, dueDays: 7 };
    const put = (data: object) => http().put('/api/v1/requests/routes').auth(tokens.admin, { type: 'bearer' }).send(data);
    await put({ ...body, assigneeIds: [f.users.teacher.id] }).expect(400);
    await put({ ...body, groupId: f.groups[2].id }).expect(400);
    await put(body).expect(200);
    await put(body).expect(409);
    const id = await submitted('retake'); const row = (await get(`/${id}`, 'teacher')).body;
    expect(row.steps).toHaveLength(3); expect(row.workflowVersion).toBe(1);
    await put({ ...body, version: 1, dueDays: 10 }).expect(200);
    expect((await get(`/${id}`, 'teacher')).body.workflowVersion).toBe(1);
  });
  it('reports unavailable debt source without synthetic marks and filters the queue', async () => {
    await get(`/students/${f.users.student.id}/debts`, 'student').expect(200).expect(({ body }) => { expect(body.available).toBe(false); expect(body.source).toBeNull(); expect(body.records).toEqual([]); });
    await get(`/students/${foreignStudent.id}/debts`, 'teacher').expect(400);
    await get(`/report?groupId=${f.groups[3].id}`, 'teacher').expect(200).expect(({ body }) => expect(body.data).toEqual([]));
    await get('?status=closed', 'teacher').expect(200).expect(({ body }) => expect(body.data.every(row => row.status === 'closed')).toBe(true));
  });
  it('rejects impossible transitions, omitted reasons and replay of changed create payload', async () => {
    const body = { type: 'absence', title: 'Ещё одно заявление', description: 'Подробное описание заявления', idempotencyKey: randomUUID() };
    const created = await post('', body, 'student').expect(201);
    await post('', body, 'student').expect(201).expect(({ body: replay }) => expect(replay.id).toBe(created.body.id));
    await post('', { idempotencyKey: body.idempotencyKey, description: body.description, title: body.title, type: body.type }, 'student').expect(201).expect(({ body: replay }) => expect(replay.id).toBe(created.body.id));
    await post('', { ...body, title: 'Другое' }, 'student').expect(409);
    await command(created.body.id, 'close', 'student').then(result => expect(result.status).toBe(403));
    const id = await submitted(); await command(id, 'accept', 'teacher');
    const row = (await get(`/${id}`, 'teacher')).body;
    await post(`/${id}/commands`, { action: 'reject', version: row.version, idempotencyKey: randomUUID() }, 'teacher').expect(400);
    expect(await f.db.getRepository(RequestStep).countBy({ requestId: id, state: 'approved' })).toBe(0);
    expect((await f.db.getRepository(StudentRequest).findOneByOrFail({ id })).status).toBe('in_review');
  });
  it('preserves existing student-curator appointments without permitting self-approval', async () => {
    const curator = await f.db.getRepository(CuratorAssignment).save({ universityId: f.uni.id, groupId: f.groups[0].id, userId: f.users.peer.id, grantedBy: f.users.admin.id });
    const body = { groupId: f.groups[0].id, type: 'absence', assigneeIds: [f.users.teacher.id, f.users.peer.id], version: 0, dueDays: 5 };
    await http().put('/api/v1/requests/routes').auth(tokens.admin, { type: 'bearer' }).send(body).expect(200);
    const id = await submitted();
    await command(id, 'accept', 'teacher'); await command(id, 'approve', 'teacher');
    await get('', 'peer').expect(200).expect(({ body }) => expect(body.data.some(row => row.id === id)).toBe(true));
    await command(id, 'approve', 'peer');
    const own = await draft('absence', 'peer');
    await command(own, 'submit', 'peer').then(result => expect(result.status).toBe(400));
    await f.db.getRepository(CuratorAssignment).update(curator.id, { revokedAt: new Date() });
    await get(`/${id}`, 'peer').expect(403);
    await f.db.getRepository(OfficeRoute).delete({ groupId: f.groups[0].id, type: 'absence' });
    expect((await f.db.getRepository(User).findOneByOrFail({ id: f.users.peer.id })).role).toBe(UserRole.STUDENT);
  });
  it('lets a dispatcher change scoped lesson time/room, preserving journals and source identities', async () => {
    const date = new Date(f.lesson.startDate).toISOString().slice(0, 10);
    await get(`/dispatch/lessons?groupId=${f.groups[0].id}&startDate=${date}&endDate=${date}`, 'dispatcher').expect(200).expect(({ body }) => expect(body.data.some(row => row.id === f.lesson.id)).toBe(true));
    const patch = (id: string, body: object) => http().patch(`/api/v1/schedule/${id}`).auth(tokens.dispatcher, { type: 'bearer' }).send(body);
    await patch(f.lesson.id, { room: '408', isChanged: false, changeDescription: 'Изменение аудитории диспетчером' }).expect(200);
    expect((await f.db.getRepository(Lesson).findOneByOrFail({ id: f.lesson.id })).room).toBe('408');
    expect((await f.db.getRepository(Lesson).findOneByOrFail({ id: f.lesson.id })).isChanged).toBe(true);
    expect(await f.db.getRepository(LessonChange).countBy({ lessonId: f.lesson.id })).toBeGreaterThan(0);
    const startsAt = new Date(new Date(f.lesson.startDate).getTime() + 3600000).toISOString(), endsAt = new Date(new Date(f.lesson.endDate).getTime() + 3600000).toISOString();
    await patch(f.lesson.id, { startDate: startsAt, endDate: endsAt, startTime: '09:30', endTime: '11:00', isChanged: true, changeDescription: 'Перенос времени диспетчером' }).expect(200);
    const moved = await f.db.getRepository(Lesson).findOneByOrFail({ id: f.lesson.id });
    expect(moved.startDate.toISOString()).toBe(startsAt); expect(moved.teacherId).toBe(f.lesson.teacherId); expect(moved.groupId).toBe(f.lesson.groupId); expect(moved.source ?? null).toBe(f.lesson.source ?? null);
    await patch(f.lesson.id, { startTime: '99:00', changeDescription: 'Невалидное время' }).expect(403);
    await patch(f.lesson.id, { room: 'Без основания' }).expect(403);
    await patch(f.lesson.id, { startDate: null, changeDescription: 'Нельзя очистить дату' }).expect(403);
    await patch(f.lesson.id, { source: 'other', changeDescription: 'Попытка смены источника' }).expect(403);
    await patch(f.lesson.id, { groupId: f.groups[2].id, changeDescription: 'Попытка смены группы' }).expect(403);
    const outside = await f.db.getRepository(Lesson).save({ ...f.lesson, id: randomUUID(), groupId: f.groups[2].id });
    await patch(outside.id, { room: 'Чужая', changeDescription: 'Не разрешено' }).expect(403);
    await http().delete(`/api/v1/schedule/${f.lesson.id}`).auth(tokens.dispatcher, { type: 'bearer' }).expect(403);
    await http().delete(`/api/v1/requests/assignments/${dispatcherAssignment}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    await patch(f.lesson.id, { room: '409', changeDescription: 'После отзыва' }).expect(403);
    await get(`/dispatch/lessons?groupId=${f.groups[0].id}&startDate=${date}&endDate=${date}`, 'dispatcher').expect(403);
  });
});
