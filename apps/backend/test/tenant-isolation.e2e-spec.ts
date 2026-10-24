import * as request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import { createCurationFixture } from './curation.fixture';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { Faculty } from '../src/users/entities/faculty.entity';
import { Group } from '../src/users/entities/group.entity';
import { Lesson } from '../src/schedule/entities/lesson.entity';
import { Course } from '../src/academic/entities/course.entity';
import { CourseSpace } from '../src/academic/entities/course-space.entity';
import { LessonSpace } from '../src/academic/entities/lesson-space.entity';
import { AcademicEvent } from '../src/academic/entities/academic-event.entity';
import { LessonSeries } from '../src/academic/entities/lesson-series.entity';
import { LessonOccurrence } from '../src/academic/entities/lesson-occurrence.entity';
import { Absence } from '../src/absences/entities/absence.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { InboxItem } from '../src/notifications/entities/inbox-item.entity';
import { NotificationEventHandler } from '../src/notifications/events/notification-event.handler';
import { EventBusService } from '../src/events/event-bus.service';

const suite = process.env.TENANT_TEST_DATABASE_URL ? describe : describe.skip;
suite('Tenant isolation: real HTTP, JWT, services and PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  const objects: Record<string, string> = {};
  const eventWork: Promise<unknown>[] = [];
  const http = () => request(fixture.app.getHttpServer());
  const privileged = <T>(callback: () => Promise<T>) => fixture.app.get(TenantContext).runWithDatabaseAccess({
    tables: fixture.db.entityMetadatas.map(entity => entity.tableName), universityIds: null, write: true,
  }, callback);
  const call = (method: string, path: string, actor = 'admin', resources = objects) => {
    const substituted = path.replace(/\{(\w+)\}/g, (_, key: string) => resources[key]);
    const server = http();
    const operation = method === 'GET' ? server.get(substituted) : method === 'POST' ? server.post(substituted)
      : method === 'DELETE' ? server.delete(substituted) : method === 'PUT' ? server.put(substituted) : server.patch(substituted);
    return operation.auth(tokens[actor], { type: 'bearer' });
  };
  beforeAll(async () => {
    fixture = await createCurationFixture(process.env.TENANT_TEST_DATABASE_URL!);
    // Execute the real listeners, but retain their completion promises for DB assertions.
    const handler = fixture.app.get(NotificationEventHandler), handle = handler.handle.bind(handler);
    jest.spyOn(handler, 'handle').mockImplementation(event => {
      const work = handle(event);
      eventWork.push(work);
      return work;
    });
    await privileged(async () => {
      const student = await fixture.db.getRepository(User).save({ email: `foreign-${randomUUID()}@tenant.test`, firstName: 'Чужой', lastName: 'Студент', role: UserRole.STUDENT, universityId: fixture.otherUni.id, groupId: fixture.groups[3].id, passwordHash: fixture.users.student.passwordHash });
      fixture.users.foreignStudent = student;
      fixture.users.foreignAdmin = await fixture.db.getRepository(User).save({ email: `admin-${randomUUID()}@tenant.test`, firstName: 'Другой', lastName: 'Администратор', role: UserRole.UNIVERSITY_ADMIN, universityId: fixture.otherUni.id, passwordHash: fixture.users.student.passwordHash });
      const lesson = await fixture.db.getRepository(Lesson).save({ ...fixture.lesson, id: randomUUID(), universityId: fixture.otherUni.id, groupId: fixture.groups[3].id, teacherId: fixture.users.outsider.id, subject: `private-${randomBytes(8).toString('hex')}`, isChanged: true });
      const course = await fixture.db.getRepository(Course).save({ universityId: fixture.otherUni.id, code: 'FOREIGN', name: lesson.subject });
      const ownCourse = await fixture.db.getRepository(Course).save({ universityId: fixture.uni.id, code: 'OWN', name: 'Own course' });
      const courseSpace = await fixture.db.getRepository(CourseSpace).save({ universityId: fixture.otherUni.id, courseId: course.id, name: course.name });
      const series = await fixture.db.getRepository(LessonSeries).save({ universityId: fixture.otherUni.id, courseId: course.id, groupId: fixture.groups[3].id, teacherId: fixture.users.outsider.id, dayOfWeek: 1, startTime: '08:30', endTime: '10:00', pairNumber: 1, validFrom: new Date('2026-09-01') });
      const occurrence = await fixture.db.getRepository(LessonOccurrence).save({ universityId: fixture.otherUni.id, seriesId: series.id, courseId: course.id, groupId: fixture.groups[3].id, teacherId: fixture.users.outsider.id, startsAt: new Date('2026-10-22T08:30:00Z'), endsAt: new Date('2026-10-22T10:00:00Z') });
      await fixture.db.getRepository(LessonSpace).save({ universityId: fixture.otherUni.id, courseSpaceId: courseSpace.id, occurrenceId: occurrence.id, name: course.name });
      const event = await fixture.db.getRepository(AcademicEvent).save({ universityId: fixture.otherUni.id, type: 'university_event', title: lesson.subject, groupId: fixture.groups[3].id, courseId: course.id });
      const absence = await fixture.db.getRepository(Absence).save({ universityId: fixture.otherUni.id, studentId: student.id, type: 'sick', startDate: new Date(), endDate: new Date() });
      const notification = await fixture.db.getRepository(Notification).save({ universityId: fixture.otherUni.id, userId: student.id, type: 'system', title: lesson.subject, body: lesson.subject });
      const inbox = await fixture.db.getRepository(InboxItem).save({ universityId: fixture.otherUni.id, userId: student.id, type: 'system', title: lesson.subject, description: lesson.subject });
      const faculty = await fixture.db.getRepository(Faculty).findOneByOrFail({ universityId: fixture.otherUni.id });
      Object.assign(objects, { student: student.id, teacher: fixture.users.outsider.id, lesson: lesson.id, ownLesson: fixture.lesson.id, course: course.id, ownCourse: ownCourse.id, series: series.id, occurrence: occurrence.id, event: event.id, absence: absence.id, notification: notification.id, inbox: inbox.id, faculty: faculty.id, group: fixture.groups[3].id, ownGroup: fixture.groups[0].id, ownUniversity: fixture.uni.id, university: fixture.otherUni.id });
    });
    for (const actor of ['student', 'admin', 'teacher', 'outsider', 'foreignStudent', 'foreignAdmin'] as const) {
      const user = fixture.users[actor];
      const response = await http().post('/api/v1/auth/login').send({ email: user.email, password: fixture.password }).expect(200);
      tokens[actor] = response.body.accessToken;
    }
    await call('PUT', '/api/v1/curation/groups/{group}/curators/' + fixture.users.foreignAdmin.id, 'foreignAdmin').expect(200);
    await call('PUT', '/api/v1/curation/groups/{ownGroup}/curators/' + fixture.users.admin.id).expect(200);
    const homework = await call('POST', '/api/v1/pair-spaces/{lesson}/homeworks', 'foreignAdmin').send({ title: 'Synthetic B homework', description: 'Private B preparation' }).expect(201);
    objects.homework = homework.body.id;
  }, 90000);
  afterAll(async () => { await fixture?.app.close(); });

  // A 404 is meaningful only after the same handler can read the existing B resource.
  const foreignState = (universityId = fixture.otherUni.id) => privileged(async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
    while (eventWork.length) await Promise.all(eventWork.splice(0));
    const state: Record<string, unknown> = {};
    for (const entity of fixture.db.entityMetadatas.filter(entity => entity.columns.some(column => column.databaseName === 'universityId'))) {
      state[entity.tableName] = await fixture.db.query(`SELECT to_jsonb(t) AS row FROM "${entity.tableName}" t WHERE "universityId" = $1 ORDER BY to_jsonb(t)::text`, [universityId]);
    }
    for (const table of ['announcements', 'homeworks', 'file_attachments', 'discussion_messages']) {
      state[table] = await fixture.db.query(`SELECT to_jsonb(t) AS row FROM "${table}" t JOIN pair_spaces p ON p.id = t."pairSpaceId" WHERE p."universityId" = $1 ORDER BY to_jsonb(t)::text`, [universityId]);
    }
    state.absence_confirmations = await fixture.db.query('SELECT to_jsonb(t) AS row FROM absence_confirmations t JOIN absences a ON a.id = t."absenceId" WHERE a."universityId" = $1 ORDER BY to_jsonb(t)::text', [universityId]);
    for (const table of ['homework_progress', 'homework_submissions']) {
      state[table] = await fixture.db.query(`SELECT to_jsonb(t) AS row FROM "${table}" t JOIN homeworks h ON h.id = t."homeworkId" JOIN pair_spaces p ON p.id = h."pairSpaceId" WHERE p."universityId" = $1 ORDER BY to_jsonb(t)::text`, [universityId]);
    }
    return state;
  });

  async function controlResources(path: string) {
    const resources = { ...objects };
    const entities = { student: User, faculty: Faculty, group: Group, lesson: Lesson, course: Course, occurrence: LessonOccurrence, series: LessonSeries, absence: Absence, notification: Notification, inbox: InboxItem };
    await privileged(async () => {
      for (const key of Object.keys(entities) as (keyof typeof entities)[]) {
        if (!path.includes(`{${key}}`)) continue;
        const repository = fixture.db.getRepository(entities[key]);
        const row = await repository.findOneByOrFail({ id: objects[key] });
        const clone = { ...row, id: randomUUID(), ...(key === 'student' ? { email: `control-${randomUUID()}@tenant.test` } : {}), ...(key === 'course' ? { code: `CONTROL-${randomUUID()}` } : {}), ...(key === 'occurrence' ? { startsAt: new Date('2026-10-24T08:30:00Z'), endsAt: new Date('2026-10-24T10:00:00Z') } : {}) };
        resources[key] = (await repository.save(clone)).id;
      }
    });
    return resources;
  }

  it('establishes a successful own-university control request', async () => {
    await call('GET', '/api/v1/admin/university').expect(200).expect(({ body }) => expect(body.id).toBe(fixture.uni.id));
    await call('GET', '/api/v1/schedule/lessons/{ownLesson}').expect(200);
  });

  const reads = [
    '/schedule/lessons/{lesson}', '/schedule/lessons/{lesson}/changes',
    '/academic/courses/{course}', '/academic/courses/{course}/space', '/academic/courses/{course}/series',
    '/academic/occurrences/{occurrence}/context', '/academic/occurrences/{occurrence}/space', '/academic/occurrences/{occurrence}/changes',
    '/pair-spaces/groups/{group}', '/pair-spaces/{lesson}', '/pair-spaces/{lesson}/timeline',
    '/pair-spaces/{lesson}/messages', '/pair-spaces/{lesson}/personal-note',
    '/curation/groups/{group}/students', '/curation/groups/{group}/lessons', '/curation/groups/{group}/curators',
    '/curation/absences/{absence}/context', '/users/{student}',
    '/absences/lesson/{lesson}', '/absences/attendance/lesson/{lesson}',
  ];
  it.each(reads)('rejects a foreign resource read GET %s', async path => {
    const control = await call('GET', `/api/v1${path}`, path === '/users/{student}' ? 'foreignStudent' : 'foreignAdmin');
    expect(control.status).toBeGreaterThanOrEqual(200);
    expect(control.status).toBeLessThan(300);
    const before = await foreignState();
    const response = await call('GET', `/api/v1${path}`);
    expect([403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(before);
  });

  it.each(['/absences/student/{student}', '/absences/stats/{student}'])('returns empty aggregates without disclosing foreign student data: %s', async path => {
    const control = await call('GET', `/api/v1${path}`, 'foreignAdmin').expect(200);
    if (path.includes('/stats/')) expect(control.body.total).toBeGreaterThan(0);
    else expect(control.body.meta.total).toBeGreaterThan(0);
    const before = await foreignState();
    const response = await call('GET', `/api/v1${path}`).expect(200);
    if (path.includes('/stats/')) expect(response.body).toEqual({ total: 0, byType: {} });
    else { expect(response.body.data).toEqual([]); expect(response.body.meta.total).toBe(0); }
    expect(await foreignState()).toEqual(before);
  });

  it('does not return students of a foreign group', async () => {
    const control = await call('GET', '/api/v1/admin/groups/{group}/students', 'foreignAdmin').expect(200);
    expect(control.body.data.some((row: { id: string }) => row.id === objects.student)).toBe(true);
    const response = await call('GET', '/api/v1/admin/groups/{group}/students');
    if (response.status === 200) {
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    } else expect([403, 404]).toContain(response.status);
  });

  it.each([
    ['/admin/users', 'student'], ['/admin/faculties', 'faculty'], ['/admin/groups', 'group'],
    ['/academic/courses', 'course'], ['/academic/occurrences', 'occurrence'], ['/academic/events', 'event'],
    ['/curation/manage/groups', 'group'], ['/curation/manage/candidates', 'student'],
    ['/academic/occurrences?groupId={group}', 'occurrence'], ['/academic/events?groupId={group}', 'event'],
  ])('scopes list results to the JWT university: GET %s', async (path, key) => {
    const control = await call('GET', `/api/v1${path}`, 'foreignAdmin').expect(200);
    expect(JSON.stringify(control.body)).toContain(objects[key]);
    const before = await foreignState();
    const response = await call('GET', `/api/v1${path}`).expect(200);
    for (const foreignId of ['student', 'faculty', 'group', 'course', 'occurrence', 'event']) expect(JSON.stringify(response.body)).not.toContain(objects[foreignId]);
    expect(await foreignState()).toEqual(before);
  });

  it('rejects foreign attendance with valid nested DTO and preserves B rows', async () => {
    const body = { lessonId: objects.lesson, entries: [{ studentId: objects.student, status: 'present' }] };
    await call('POST', '/api/v1/absences/attendance', 'foreignAdmin').send(body).expect(201);
    const before = await foreignState();
    const response = await call('POST', '/api/v1/absences/attendance').send(body);
    expect([403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(before);
  });

  it.each([
    '/schedule?date={date}', '/schedule?date={date}&groupId={group}', '/schedule?date={date}&teacherId={teacher}',
    '/schedule/my?startDate={date}&endDate={date}', '/schedule/range?startDate={date}&endDate={date}', '/schedule/changes?date={date}',
  ])('keeps schedule lists and filters within the JWT university: GET %s', async template => {
    const date = fixture.lesson.startDate.toISOString().slice(0, 10);
    const path = '/api/v1' + template.replaceAll('{date}', date);
    const control = await call('GET', path, 'foreignAdmin').expect(200);
    expect(JSON.stringify(control.body)).toContain(objects.lesson);
    const before = await foreignState();
    const response = await call('GET', path).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(objects.lesson);
    expect(await foreignState()).toEqual(before);
  });

  const scheduleBody = () => ({ subject: 'Synthetic manual lesson', groupId: objects.group, teacherId: objects.teacher,
    dayOfWeek: fixture.lesson.dayOfWeek, startTime: '08:30', endTime: '10:00', pairNumber: 1,
    startDate: fixture.lesson.startDate.toISOString(), endDate: fixture.lesson.endDate.toISOString() });
  it.each([['student', 'foreignStudent'], ['teacher', 'outsider']])('scopes the %s date/my/range branches without exposing B', async (aActor, bActor) => {
    const date = fixture.lesson.startDate.toISOString().slice(0, 10);
    for (const path of [`/schedule?date=${date}&groupId={group}&teacherId={teacher}`, `/schedule/my?startDate=${date}&endDate=${date}`, `/schedule/range?startDate=${date}&endDate=${date}`]) {
      const control = await call('GET', '/api/v1' + path, bActor).expect(200);
      expect(JSON.stringify(control.body)).toContain(objects.lesson);
      const before = await foreignState();
      const response = await call('GET', '/api/v1' + path, aActor).expect(200);
      expect(JSON.stringify(response.body)).not.toContain(objects.lesson);
      expect(await foreignState()).toEqual(before);
    }
  });
  it('ignores a supplied foreign universityId on manual lesson creation and preserves B', async () => {
    const b = await call('POST', '/api/v1/schedule', 'foreignAdmin').send({ ...scheduleBody(), universityId: fixture.uni.id }).expect(201);
    expect(b.body.universityId).toBe(fixture.otherUni.id);
    const before = await foreignState();
    const a = await call('POST', '/api/v1/schedule').send({ ...scheduleBody(), groupId: objects.ownGroup, teacherId: fixture.users.teacher.id, universityId: fixture.otherUni.id }).expect(201);
    expect(a.body.universityId).toBe(fixture.uni.id);
    expect(await foreignState()).toEqual(before);
  });
  it.each(['groupId', 'teacherId'] as const)('rejects a foreign %s during manual lesson creation without partial rows', async field => {
    await call('POST', '/api/v1/schedule', 'foreignAdmin').send(scheduleBody()).expect(201);
    const beforeB = await foreignState(), beforeA = await foreignState(fixture.uni.id);
    await call('POST', '/api/v1/schedule').send({ ...scheduleBody(), groupId: field === 'groupId' ? objects.group : objects.ownGroup, teacherId: field === 'teacherId' ? objects.teacher : fixture.users.teacher.id }).expect(404);
    expect(await foreignState()).toEqual(beforeB);
    expect(await foreignState(fixture.uni.id)).toEqual(beforeA);
  });

  const mutations: [string, string, string, Record<string, unknown>][] = [
    ['PATCH', '/admin/users/{student}/roles', 'admin', { role: 'teacher' }],
    ['PATCH', '/admin/users/{student}/status', 'admin', { isActive: false }],
    ['POST', '/admin/users/{student}/reset-password', 'admin', { password: 'LocalTestPassword123!' }],
    ['PATCH', '/admin/faculties/{faculty}', 'admin', { name: 'Changed' }],
    ['PATCH', '/admin/groups/{group}', 'admin', { name: 'Changed' }],
    ['PATCH', '/schedule/{lesson}', 'admin', { room: 'Changed' }],
    ['DELETE', '/schedule/{lesson}', 'admin', {}],
    ['PATCH', '/academic/courses/{course}', 'admin', { name: 'Changed' }],
    ['PATCH', '/academic/occurrences/{occurrence}', 'admin', { room: 'Changed' }],
    ['POST', '/academic/series/{series}/occurrences', 'admin', { startsAt: '2026-10-23T08:30:00Z', endsAt: '2026-10-23T10:00:00Z' }],
    ['PATCH', '/absences/{absence}', 'student', { comment: 'Changed' }],
    ['DELETE', '/absences/{absence}', 'student', {}],
    ['POST', '/absences/{absence}/confirm', 'admin', {}],
    ['POST', '/absences/{absence}/excuse', 'admin', { reason: 'Changed' }],
    ['PUT', '/pair-spaces/{lesson}/personal-note', 'student', { content: 'Changed' }],
    ['POST', '/pair-spaces/{lesson}/messages', 'student', { text: 'Changed' }],
    ['POST', '/pair-spaces/{lesson}/announcements', 'admin', { text: 'Changed' }],
    ['POST', '/pair-spaces/{lesson}/homeworks', 'admin', { title: 'Changed', description: 'Synthetic preparation' }],
    ['POST', '/pair-spaces/{lesson}/files', 'admin', { fileUrl: 'https://example.test/synthetic.pdf', fileName: 'synthetic.pdf', fileType: 'pdf', size: 64 }],
  ];
  it.each(mutations)('rejects foreign mutation %s %s (%s)', async (method, path, actor, body) => {
    const control = await call(method, `/api/v1${path}`, actor === 'student' ? 'foreignStudent' : 'foreignAdmin', await controlResources(path)).send(body);
    expect(control.status).toBeGreaterThanOrEqual(200);
    expect(control.status).toBeLessThan(300);
    const before = await foreignState();
    const response = await call(method, `/api/v1${path}`, actor).send(body);
    expect([403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(before);
  });

  it('rejects a university move through the schedule PATCH body', async () => {
    await call('PATCH', '/api/v1/schedule/{ownLesson}').send({ universityId: objects.university }).expect(403);
  });
  it('rejects binding the current user to a foreign group', async () => {
    await call('POST', '/api/v1/users/me/bind-group', 'student').send({ groupId: objects.group }).expect(404);
  });
  it('rejects a foreign faculty on an otherwise own-university group', async () => {
    await call('PATCH', '/api/v1/admin/groups/{ownGroup}').send({ facultyId: objects.faculty }).expect(404);
  });
  it.each(['groupId', 'teacherId'] as const)('rejects a foreign %s in an own-university lesson', async field => {
    await call('PATCH', '/api/v1/schedule/{ownLesson}').send({ [field]: field === 'groupId' ? objects.group : objects.teacher }).expect(404);
  });
  it('rejects a foreign teacher for an own-university course series', async () => {
    await call('POST', '/api/v1/academic/courses/{ownCourse}/series').send({
      groupId: objects.ownGroup, teacherId: objects.teacher, dayOfWeek: 1,
      startTime: '08:30', endTime: '10:00', pairNumber: 1, validFrom: '2026-09-01',
    }).expect(404);
  });

  it('creates identical course codes within each JWT university without touching B', async () => {
    const body = { code: `ISOLATED-${randomUUID()}`, name: 'Synthetic scoped course' };
    const b = await call('POST', '/api/v1/academic/courses', 'foreignAdmin').send(body).expect(201);
    expect(b.body.universityId).toBe(fixture.otherUni.id);
    const before = await foreignState();
    const a = await call('POST', '/api/v1/academic/courses').send(body).expect(201);
    expect(a.body.universityId).toBe(fixture.uni.id);
    expect(a.body.id).not.toBe(b.body.id);
    await call('GET', '/api/v1/academic/courses/' + a.body.id + '/space').expect(200);
    expect(await foreignState()).toEqual(before);
  });
  it.each(['POST', 'PATCH'])('rejects a foreign faculty during course %s without partial writes in either university', async method => {
    const body = method === 'POST' ? { code: `FACULTY-${randomUUID()}`, name: 'Synthetic course', facultyId: objects.faculty } : { facultyId: objects.faculty };
    const bPath = method === 'POST' ? '/api/v1/academic/courses' : '/api/v1/academic/courses/{course}';
    await call(method, bPath, 'foreignAdmin').send(body).expect(method === 'POST' ? 201 : 200);
    const beforeB = await foreignState(), beforeA = await foreignState(fixture.uni.id);
    const aPath = method === 'POST' ? bPath : '/api/v1/academic/courses/{ownCourse}';
    await call(method, aPath).send(body).expect(404);
    expect(await foreignState()).toEqual(beforeB);
    expect(await foreignState(fixture.uni.id)).toEqual(beforeA);
  });
  it('rejects creation of a series under a foreign course with a valid B context', async () => {
    const body = { groupId: objects.group, teacherId: objects.teacher, dayOfWeek: 2, startTime: '10:00', endTime: '11:30', pairNumber: 2, validFrom: '2026-09-01' };
    const path = '/api/v1/academic/courses/{course}/series';
    await call('POST', path, 'foreignAdmin').send(body).expect(201);
    const beforeB = await foreignState(), beforeA = await foreignState(fixture.uni.id);
    await call('POST', path).send(body).expect(404);
    expect(await foreignState()).toEqual(beforeB);
    expect(await foreignState(fixture.uni.id)).toEqual(beforeA);
  });
  it.each(['groupId', 'teacherId'] as const)('rejects a foreign %s in a new series of an own course', async field => {
    const body = { groupId: objects.group, teacherId: objects.teacher, dayOfWeek: 3, startTime: '10:00', endTime: '11:30', pairNumber: 2, validFrom: '2026-09-01' };
    await call('POST', '/api/v1/academic/courses/{course}/series', 'foreignAdmin').send(body).expect(201);
    const beforeB = await foreignState(), beforeA = await foreignState(fixture.uni.id);
    await call('POST', '/api/v1/academic/courses/{ownCourse}/series').send({ ...body, groupId: field === 'groupId' ? objects.group : objects.ownGroup, teacherId: field === 'teacherId' ? objects.teacher : fixture.users.teacher.id }).expect(404);
    expect(await foreignState()).toEqual(beforeB);
    expect(await foreignState(fixture.uni.id)).toEqual(beforeA);
  });
  it.each(['courseId', 'groupId', 'occurrenceId'] as const)('rejects a foreign %s in event creation without partial rows', async field => {
    const key = field === 'courseId' ? 'course' : field === 'groupId' ? 'group' : 'occurrence';
    const body = { type: 'university_event', title: 'Synthetic referenced event', [field]: objects[key] };
    await call('POST', '/api/v1/academic/events', 'foreignAdmin').send(body).expect(201);
    const beforeB = await foreignState(), beforeA = await foreignState(fixture.uni.id);
    await call('POST', '/api/v1/academic/events').send(body).expect(404);
    expect(await foreignState()).toEqual(beforeB);
    expect(await foreignState(fixture.uni.id)).toEqual(beforeA);
  });
  it('creates unlinked events only in the JWT university', async () => {
    const body = { type: 'university_event', title: 'Synthetic unlinked event' };
    const b = await call('POST', '/api/v1/academic/events', 'foreignAdmin').send(body).expect(201);
    expect(b.body.universityId).toBe(fixture.otherUni.id);
    const before = await foreignState();
    const a = await call('POST', '/api/v1/academic/events').send(body).expect(201);
    expect(a.body.universityId).toBe(fixture.uni.id);
    expect(await foreignState()).toEqual(before);
  });
  it.each(['done', 'in_progress'])('cannot write preparation state %s to a foreign homework', async state => {
    const body = { state, subtasks: [{ id: randomUUID(), title: 'Synthetic private checklist', done: state === 'done' }] };
    const control = await call('PATCH', '/api/v1/pair-spaces/homeworks/{homework}/progress', 'foreignStudent').send(body).expect(200);
    expect(control.body).toMatchObject({ homeworkId: objects.homework, studentId: fixture.users.foreignStudent.id, state, subtasks: body.subtasks });
    const beforeB = await foreignState(), beforeA = await foreignState(fixture.uni.id);
    const response = await call('PATCH', '/api/v1/pair-spaces/homeworks/{homework}/progress', 'student').send(body);
    expect([403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(beforeB);
    expect(await foreignState(fixture.uni.id)).toEqual(beforeA);
  });
  it.each(['First synthetic submission', 'Updated synthetic submission'])('cannot submit or replace work for a foreign homework: %s', async comment => {
    const body = { comment, fileUrl: 'https://example.test/synthetic-submission.pdf' };
    const control = await call('PATCH', '/api/v1/pair-spaces/homeworks/{homework}/submit', 'foreignStudent').send(body).expect(200);
    expect(control.body).toMatchObject({ homeworkId: objects.homework, studentId: fixture.users.foreignStudent.id, status: 'submitted', ...body });
    const beforeB = await foreignState(), beforeA = await foreignState(fixture.uni.id);
    const response = await call('PATCH', '/api/v1/pair-spaces/homeworks/{homework}/submit', 'student').send(body);
    expect([403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(beforeB);
    expect(await foreignState(fixture.uni.id)).toEqual(beforeA);
  });
  it('rejects a foreign occurrence on an own-university academic event', async () => {
    await call('POST', '/api/v1/academic/events').send({
      type: 'university_event', title: 'Own event', occurrenceId: objects.occurrence,
    }).expect(404);
  });
  it('cannot mark a foreign notification as read', async () => {
    await call('PATCH', '/api/v1/notifications/{notification}/read', 'foreignStudent', await controlResources('{notification}')).expect(200);
    const before = await foreignState();
    const response = await call('PATCH', '/api/v1/notifications/{notification}/read', 'student');
    expect([200, 403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(before);
    await privileged(async () => expect((await fixture.db.getRepository(Notification).findOneByOrFail({ id: objects.notification })).isRead).toBe(false));
  });
  it('cannot complete a foreign inbox item', async () => {
    await call('PATCH', '/api/v1/notifications/inbox/{inbox}/complete', 'foreignStudent', await controlResources('{inbox}')).expect(200);
    const before = await foreignState();
    const response = await call('PATCH', '/api/v1/notifications/inbox/{inbox}/complete', 'student');
    expect([200, 403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(before);
    await privileged(async () => expect((await fixture.db.getRepository(InboxItem).findOneByOrFail({ id: objects.inbox })).status).toBe('open'));
  });
  it('cannot snooze a foreign inbox item with a valid date', async () => {
    const body = { until: new Date(Date.now() + 3600000).toISOString() };
    await call('PATCH', '/api/v1/notifications/inbox/{inbox}/snooze', 'foreignStudent', await controlResources('{inbox}')).send(body).expect(200);
    const before = await foreignState();
    const response = await call('PATCH', '/api/v1/notifications/inbox/{inbox}/snooze', 'student').send(body);
    expect([403, 404]).toContain(response.status);
    expect(await foreignState()).toEqual(before);
  });
  it.each([['/notifications', 'notification'], ['/notifications/inbox', 'inbox']])('keeps recipient lists private: GET %s', async (path, key) => {
    const control = await call('GET', `/api/v1${path}`, 'foreignStudent').expect(200);
    expect(JSON.stringify(control.body)).toContain(objects[key]);
    const before = await foreignState();
    const response = await call('GET', `/api/v1${path}`, 'student').expect(200);
    expect(JSON.stringify(response.body)).not.toContain(objects[key]);
    expect(await foreignState()).toEqual(before);
  });
  it.each(['group', 'teacher'])('keeps favorites private during same-key add/update/delete: %s', async kind => {
    const externalId = kind === 'group' ? '987654321' : 'synthetic-teacher';
    const bLabel = `Private B favorite ${randomUUID()}`, aLabel = 'Own A favorite';
    await call('POST', '/api/v1/users/me/favorites', 'foreignStudent').send({ kind, externalId, label: bLabel }).expect(201);
    const control = await call('GET', '/api/v1/users/me/favorites', 'foreignStudent').expect(200);
    expect(control.body).toEqual(expect.arrayContaining([expect.objectContaining({ kind, externalId, label: bLabel, userId: fixture.users.foreignStudent.id, universityId: fixture.otherUni.id })]));
    const before = await foreignState();
    await call('POST', '/api/v1/users/me/favorites', 'student').send({ kind, externalId, label: aLabel }).expect(201);
    await call('POST', '/api/v1/users/me/favorites', 'student').send({ kind, externalId, label: aLabel + ' updated' }).expect(201);
    const own = await call('GET', '/api/v1/users/me/favorites', 'student').expect(200);
    expect(JSON.stringify(own.body)).not.toContain(bLabel);
    expect(own.body).toEqual(expect.arrayContaining([expect.objectContaining({ kind, externalId, userId: fixture.users.student.id, universityId: fixture.uni.id })]));
    await call('DELETE', '/api/v1/users/me/favorites', 'student').send({ kind, externalId }).expect(200);
    expect(await foreignState()).toEqual(before);
  });
  it.each([['admin', 'foreignAdmin'], ['student', 'foreignStudent'], ['teacher', 'outsider']])('keeps search private for %s with a real B hit', async (aActor, bActor) => {
    const lesson = await privileged(() => fixture.db.getRepository(Lesson).findOneByOrFail({ id: objects.lesson }));
    const path = '/api/v1/search?q=' + encodeURIComponent(lesson.subject);
    const control = await call('GET', path, bActor).expect(200);
    expect(JSON.stringify(control.body.results)).toContain(objects.lesson);
    const before = await foreignState();
    const response = await call('GET', path, aActor).expect(200);
    expect(response.body.query).toBe(lesson.subject);
    expect(response.body.results).toEqual([]);
    expect(await foreignState()).toEqual(before);
  });
  it.each([['student', 'foreignStudent'], ['teacher', 'outsider']])('keeps my-day private for %s with actual B lessons', async (aActor, bActor) => {
    // A host-local 08:30 fixture may be yesterday in Asia/Omsk on a UTC CI host.
    const now = new Date();
    await privileged(() => fixture.db.getRepository(Lesson).update(objects.lesson, { startDate: now, endDate: new Date(now.getTime() + 3600000) }));
    const path = '/api/v1/my-day?timeZone=Asia%2FOmsk';
    const control = await call('GET', path, bActor).expect(200);
    expect(JSON.stringify(control.body)).toContain(objects.lesson);
    const before = await foreignState();
    const response = await call('GET', path, aActor).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(objects.lesson);
    expect(JSON.stringify(response.body)).not.toContain(objects.homework);
    expect(await foreignState()).toEqual(before);
  });
  it('keeps event history and real HTTP SSE replay private across universities', async () => {
    const tenant = fixture.app.get(TenantContext), bus = fixture.app.get(EventBusService);
    const publish = (actorKey: string, studentKey: string, label: string) => tenant.runInRequest(() => {
      const actor = fixture.users[actorKey]; tenant.setUser(actor);
      return bus.publish({ type: 'lesson.changed', universityId: actor.universityId!, actor: { type: 'user', id: actor.id, role: actor.role },
        target: { type: 'lesson', id: actorKey === 'admin' ? objects.ownLesson : objects.lesson },
        recipients: [fixture.users[studentKey].id], payload: { subject: label, deepLink: '/schedule' } });
    });
    const bMarker = `private-b-${randomUUID()}`, aMarker = `own-a-${randomUUID()}`;
    await publish('foreignAdmin', 'foreignStudent', bMarker);
    await publish('admin', 'student', aMarker);
    const before = await foreignState();
    const b = await call('GET', '/api/v1/events', 'foreignStudent').expect(200);
    expect(JSON.stringify(b.body)).toContain(bMarker);
    const a = await call('GET', '/api/v1/events', 'student').expect(200);
    expect(JSON.stringify(a.body)).toContain(aMarker);
    expect(JSON.stringify(a.body)).not.toContain(bMarker);
    const server = fixture.app.getHttpServer();
    if (!server.listening) await fixture.app.listen(0, '127.0.0.1');
    const port = (server.address() as { port: number }).port;
    const replay = async (actor: string, marker: string) => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 4000);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/v1/events/stream`, { headers: { Authorization: `Bearer ${tokens[actor]}` }, signal: controller.signal });
        expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/event-stream');
        reader = response.body!.getReader(); const decoder = new TextDecoder(); let text = '';
        while (!text.includes(marker)) {
          const part = await reader.read(); if (part.done) throw new Error('SSE ended before the owned event');
          text += decoder.decode(part.value, { stream: true }); if (text.length > 1000000) throw new Error('SSE fixture exceeded its evidence bound');
        }
        return text;
      } finally { clearTimeout(timeout); controller.abort(); await reader?.cancel().catch(() => undefined); }
    };
    expect(await replay('foreignStudent', bMarker)).toContain(bMarker);
    expect(await replay('student', aMarker)).not.toContain(bMarker);
    expect(await foreignState()).toEqual(before);
  }, 15000);
  it('keeps foreign rows unchanged after the negative HTTP probes', async () => {
    await privileged(async () => {
      expect((await fixture.db.getRepository(Lesson).findOneByOrFail({ id: objects.lesson })).room).toBe(fixture.lesson.room);
      expect((await fixture.db.getRepository(User).findOneByOrFail({ id: objects.student })).role).toBe(UserRole.STUDENT);
      expect((await fixture.db.getRepository(Absence).findOneByOrFail({ id: objects.absence })).comment).toBeNull();
    });
  });
});
