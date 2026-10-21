import * as request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import { createCurationFixture } from './curation.fixture';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { Faculty } from '../src/users/entities/faculty.entity';
import { Lesson } from '../src/schedule/entities/lesson.entity';
import { Course } from '../src/academic/entities/course.entity';
import { CourseSpace } from '../src/academic/entities/course-space.entity';
import { LessonSeries } from '../src/academic/entities/lesson-series.entity';
import { LessonOccurrence } from '../src/academic/entities/lesson-occurrence.entity';
import { Absence } from '../src/absences/entities/absence.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { InboxItem } from '../src/notifications/entities/inbox-item.entity';

const suite = process.env.TENANT_TEST_DATABASE_URL ? describe : describe.skip;
suite('Tenant isolation: real HTTP, JWT, services and PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  const objects: Record<string, string> = {};
  const http = () => request(fixture.app.getHttpServer());
  const privileged = <T>(callback: () => Promise<T>) => fixture.app.get(TenantContext).runWithDatabaseAccess({
    tables: fixture.db.entityMetadatas.map(entity => entity.tableName), universityIds: null, write: true,
  }, callback);
  const call = (method: string, path: string, actor = 'admin') => {
    const substituted = path.replace(/\{(\w+)\}/g, (_, key: string) => objects[key]);
    const server = http();
    const operation = method === 'GET' ? server.get(substituted) : method === 'POST' ? server.post(substituted)
      : method === 'DELETE' ? server.delete(substituted) : method === 'PUT' ? server.put(substituted) : server.patch(substituted);
    return operation.auth(tokens[actor], { type: 'bearer' });
  };
  beforeAll(async () => {
    fixture = await createCurationFixture(process.env.TENANT_TEST_DATABASE_URL!);
    await privileged(async () => {
      const student = await fixture.db.getRepository(User).save({ email: `foreign-${randomUUID()}@tenant.test`, firstName: 'Чужой', lastName: 'Студент', role: UserRole.STUDENT, universityId: fixture.otherUni.id, groupId: fixture.groups[3].id, passwordHash: fixture.users.student.passwordHash });
      const lesson = await fixture.db.getRepository(Lesson).save({ ...fixture.lesson, id: randomUUID(), universityId: fixture.otherUni.id, groupId: fixture.groups[3].id, teacherId: fixture.users.outsider.id, subject: `private-${randomBytes(8).toString('hex')}` });
      const course = await fixture.db.getRepository(Course).save({ universityId: fixture.otherUni.id, code: 'FOREIGN', name: lesson.subject });
      const ownCourse = await fixture.db.getRepository(Course).save({ universityId: fixture.uni.id, code: 'OWN', name: 'Own course' });
      await fixture.db.getRepository(CourseSpace).save({ universityId: fixture.otherUni.id, courseId: course.id, name: course.name });
      const series = await fixture.db.getRepository(LessonSeries).save({ universityId: fixture.otherUni.id, courseId: course.id, groupId: fixture.groups[3].id, teacherId: fixture.users.outsider.id, dayOfWeek: 1, startTime: '08:30', endTime: '10:00', pairNumber: 1, validFrom: new Date('2026-09-01') });
      const occurrence = await fixture.db.getRepository(LessonOccurrence).save({ universityId: fixture.otherUni.id, seriesId: series.id, courseId: course.id, groupId: fixture.groups[3].id, teacherId: fixture.users.outsider.id, startsAt: new Date('2026-10-22T08:30:00Z'), endsAt: new Date('2026-10-22T10:00:00Z') });
      const absence = await fixture.db.getRepository(Absence).save({ universityId: fixture.otherUni.id, studentId: student.id, type: 'sick', startDate: new Date(), endDate: new Date() });
      const notification = await fixture.db.getRepository(Notification).save({ universityId: fixture.otherUni.id, userId: student.id, type: 'system', title: lesson.subject, body: lesson.subject });
      const inbox = await fixture.db.getRepository(InboxItem).save({ universityId: fixture.otherUni.id, userId: student.id, type: 'system', title: lesson.subject, description: lesson.subject });
      const faculty = await fixture.db.getRepository(Faculty).findOneByOrFail({ universityId: fixture.otherUni.id });
      Object.assign(objects, { student: student.id, teacher: fixture.users.outsider.id, lesson: lesson.id, ownLesson: fixture.lesson.id, course: course.id, ownCourse: ownCourse.id, series: series.id, occurrence: occurrence.id, absence: absence.id, notification: notification.id, inbox: inbox.id, faculty: faculty.id, group: fixture.groups[3].id, ownGroup: fixture.groups[0].id, ownUniversity: fixture.uni.id, university: fixture.otherUni.id });
    });
    for (const actor of ['student', 'admin', 'teacher'] as const) {
      const user = fixture.users[actor];
      const response = await http().post('/api/v1/auth/login').send({ email: user.email, password: fixture.password }).expect(200);
      tokens[actor] = response.body.accessToken;
    }
  }, 90000);
  afterAll(async () => { await fixture?.app.close(); });

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
  ];
  it.each(reads)('rejects a foreign resource read GET %s', async path => {
    const response = await call('GET', `/api/v1${path}`);
    expect([403, 404]).toContain(response.status);
  });

  it('does not return students of a foreign group', async () => {
    const response = await call('GET', '/api/v1/admin/groups/{group}/students');
    if (response.status === 200) {
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    } else expect([403, 404]).toContain(response.status);
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
  ];
  it.each(mutations)('rejects foreign mutation %s %s (%s)', async (method, path, actor, body) => {
    const response = await call(method, `/api/v1${path}`, actor).send(body);
    expect([403, 404]).toContain(response.status);
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
  it('rejects a foreign occurrence on an own-university academic event', async () => {
    await call('POST', '/api/v1/academic/events').send({
      type: 'university_event', title: 'Own event', occurrenceId: objects.occurrence,
    }).expect(404);
  });
  it('cannot mark a foreign notification as read', async () => {
    const response = await call('PATCH', '/api/v1/notifications/{notification}/read', 'student');
    expect([200, 403, 404]).toContain(response.status);
    await privileged(async () => expect((await fixture.db.getRepository(Notification).findOneByOrFail({ id: objects.notification })).isRead).toBe(false));
  });
  it('cannot complete a foreign inbox item', async () => {
    const response = await call('PATCH', '/api/v1/notifications/inbox/{inbox}/complete', 'student');
    expect([200, 403, 404]).toContain(response.status);
    await privileged(async () => expect((await fixture.db.getRepository(InboxItem).findOneByOrFail({ id: objects.inbox })).status).toBe('open'));
  });
  it('keeps foreign rows unchanged after the negative HTTP probes', async () => {
    await privileged(async () => {
      expect((await fixture.db.getRepository(Lesson).findOneByOrFail({ id: objects.lesson })).room).toBe(fixture.lesson.room);
      expect((await fixture.db.getRepository(User).findOneByOrFail({ id: objects.student })).role).toBe(UserRole.STUDENT);
      expect((await fixture.db.getRepository(Absence).findOneByOrFail({ id: objects.absence })).comment).toBeNull();
    });
  });
});
