import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { createCurationFixture } from './curation.fixture';
import { LessonOccurrence } from '../src/academic/entities/lesson-occurrence.entity';
import { LessonSeries } from '../src/academic/entities/lesson-series.entity';
import { Course } from '../src/academic/entities/course.entity';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from '../src/migrations/1700000000038-AccountErasure';
import { CareerModeration1700000000040 } from '../src/migrations/1700000000040-CareerModeration';

const suite = process.env.SCHEDULE_V2_TEST_DATABASE_URL ? describe : describe.skip;
jest.setTimeout(90000);

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

/**
 * GET /schedule/v2 merges legacy `lessons` with academic occurrences, and the
 * same slot must appear once. Conflict checks must live on the server: a
 * dispatcher can bypass the UI, so both the dry-run and the real write are
 * verified against real PostgreSQL and real JWTs.
 */
suite('Unified schedule read model and server-side conflicts with real JWT/PostgreSQL', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  let day = '';
  const http = () => request(f.app.getHttpServer());
  const get = (path: string, actor?: string) => {
    const call = http().get('/api/v1/schedule/' + path);
    return actor ? call.auth(tokens[actor], { type: 'bearer' }) : call;
  };
  const post = (path: string, actor: string, body: object = {}) => http().post(path ? `/api/v1/schedule/${path}` : '/api/v1/schedule').auth(tokens[actor], { type: 'bearer' }).send(body);

  beforeAll(async () => {
    f = await createCurationFixture(process.env.SCHEDULE_V2_TEST_DATABASE_URL!);
    const runner = f.db.createQueryRunner();
    try {
      await new PersonalDataRead1700000000037().up(runner);
      await new AccountErasure1700000000038().up(runner);
      await new CareerModeration1700000000040().up(runner);
    } finally { await runner.release(); }
    day = iso(new Date(f.lesson.startDate));
    for (const actor of ['student', 'otherStudent', 'teacher', 'admin', 'outsider']) {
      const login = await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200);
      tokens[actor] = login.body.accessToken;
    }
  });
  afterAll(async () => { await f?.app.close(); });

  const entries = (body: { days: Array<{ lessons: Array<Record<string, unknown>> }> }) => body.days.flatMap(day => day.lessons);

  it('requires authentication and rejects a range longer than 62 days', async () => {
    await get(`v2?from=${day}&to=${day}`).expect(401);
    await get(`v2?from=${day}&to=${iso(addDays(new Date(f.lesson.startDate), 62))}`, 'admin').expect(400);
  });

  it('scopes the range by role: own group, own lessons, own university', async () => {
    const week = `v2?from=${day}&to=${iso(addDays(new Date(f.lesson.startDate), 6))}`;
    const student = await get(week, 'student').expect(200);
    expect(student.body.range.days).toBe(7);
    expect(student.body.days).toHaveLength(7);
    const own = entries(student.body);
    expect(own).toEqual([expect.objectContaining({
      source: 'lesson',
      date: day,
      startTime: '08:30',
      endTime: '10:00',
      subject: 'Технологии программирования',
      groupId: f.groups[0].id,
      groupName: 'ИН-25',
      teacherName: 'Соколова М.',
      state: 'scheduled',
      lessonId: f.lesson.id,
    })]);
    // A student of another group of this university sees nothing.
    expect(entries((await get(week, 'otherStudent').expect(200)).body)).toEqual([]);

    const teacher = await get(week, 'teacher').expect(200);
    expect(entries(teacher.body)).toEqual([expect.objectContaining({ teacherId: f.users.teacher.id, lessonId: f.lesson.id })]);

    // A teacher of another university never sees this schedule.
    const outsider = await get(week, 'outsider').expect(200);
    expect(entries(outsider.body)).toEqual([]);
    expect(outsider.body.meta).toEqual({ lessons: 0, occurrences: 0 });

    // A foreign group filter returns nothing instead of leaking rows.
    expect(entries((await get(`${week}&groupId=${f.groups[3].id}`, 'admin').expect(200)).body)).toEqual([]);
  });

  it('shows one entry per slot and lets the academic occurrence win', async () => {
    const series = await f.db.getRepository(LessonSeries).save({
      organizationId: f.uni.id,
      courseId: randomUUID(),
      groupId: f.groups[0].id,
      teacherId: f.users.teacher.id,
      title: 'Математика',
      subjectType: 'practice',
      recurrenceRule: 'weekly',
      dayOfWeek: new Date(f.lesson.startDate).getDay(),
      startTime: '08:30',
      endTime: '10:00',
      pairNumber: 1,
      weekType: 'both',
      room: '416',
      validFrom: f.lesson.startDate,
      validTo: null,
    });
    const occurrence = await f.db.getRepository(LessonOccurrence).save({
      organizationId: f.uni.id,
      seriesId: series.id,
      courseId: series.courseId,
      groupId: f.groups[0].id,
      teacherId: f.users.teacher.id,
      startsAt: f.lesson.startDate,
      endsAt: f.lesson.endDate,
      room: '416',
      status: 'scheduled',
      legacyLessonId: f.lesson.id,
    });

    const body = (await get(`v2?from=${day}&to=${day}`, 'student').expect(200)).body;
    const slots = entries(body).filter(entry => entry.date === day && entry.startTime === '08:30');
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      source: 'series',
      occurrenceId: occurrence.id,
      seriesId: series.id,
      subject: 'Математика',
      subjectType: 'practice',
      groupName: 'ИН-25',
      lessonId: f.lesson.id,
    });
    expect(body.meta).toEqual({ lessons: 1, occurrences: 1 });
  });

  it('reports a clash in the dry run without writing anything', async () => {
    const body = {
      groupId: f.groups[0].id,
      teacherId: f.users.teacher.id,
      room: '416',
      dayOfWeek: new Date(f.lesson.startDate).getDay(),
      startDate: day,
      endDate: day,
      startTime: '09:00',
      endTime: '10:30',
    };
    const clash = await post('validate', 'admin', body).expect(200);
    expect(clash.body.ok).toBe(false);
    expect(clash.body.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'group', lessonId: f.lesson.id, groupName: 'ИН-25' }),
      expect.objectContaining({ type: 'teacher', teacherId: f.users.teacher.id }),
      expect.objectContaining({ type: 'room', room: '416' }),
    ]));

    const free = await post('validate', 'admin', { ...body, startTime: '12:00', endTime: '13:30' }).expect(200);
    expect(free.body).toEqual({ ok: true, conflicts: [] });

    const self = await post('validate', 'admin', { ...body, lessonId: f.lesson.id }).expect(200);
    expect(self.body).toEqual({ ok: true, conflicts: [] });

    const after = (await get(`v2?from=${day}&to=${day}`, 'admin').expect(200)).body;
    expect(entries(after)).toHaveLength(1);
  });

  it('refuses a conflicting write with 409 and still allows a free slot', async () => {
    const lesson = {
      groupId: f.groups[0].id,
      teacherId: f.users.teacher.id,
      subject: 'Физика',
      room: '416',
      dayOfWeek: new Date(f.lesson.startDate).getDay(),
      startDate: day,
      endDate: day,
      startTime: '08:30',
      endTime: '10:00',
      pairNumber: 1,
      weekType: 'both',
    };
    const rejected = await post('', 'admin', lesson).expect(409);
    expect(rejected.body).toMatchObject({ code: 'SCHEDULE_CONFLICT' });
    expect(rejected.body.message).toContain('Конфликт расписания');

    const created = await post('', 'admin', { ...lesson, startTime: '14:00', endTime: '15:30', room: '207', subject: 'Физика' }).expect(201);
    expect(created.body).toMatchObject({ subject: 'Физика', room: '207' });
    expect(entries((await get(`v2?from=${day}&to=${day}`, 'admin').expect(200)).body)).toHaveLength(2);
  });
  it('expands a series into a legacy lesson so today and attendance still work', async () => {
    const seed = new Date(f.lesson.startDate);
    const isoWeekday = ((seed.getUTCDay() + 6) % 7) + 1;
    const series = await f.db.getRepository(LessonSeries).save({
      organizationId: f.uni.id,
      courseId: randomUUID(),
      groupId: f.groups[0].id,
      teacherId: f.users.teacher.id,
      title: 'Информатика',
      subjectType: 'practice',
      recurrenceRule: 'weekly',
      dayOfWeek: isoWeekday,
      startTime: '16:00',
      endTime: '17:30',
      pairNumber: 6,
      weekType: 'both',
      room: '210',
      validFrom: seed,
      validTo: null,
    });
    const baseline = (await get(`v2?from=${day}&to=${day}`, 'admin').expect(200)).body.meta;
    const preview = await post(`series/${series.id}/expand`, 'admin', { from: day, to: day, dryRun: true }).expect(201);
    expect(preview.body).toMatchObject({ dryRun: true, created: [day] });
    // The dry run writes neither an occurrence nor a legacy lesson.
    expect((await get(`v2?from=${day}&to=${day}`, 'admin').expect(200)).body.meta).toEqual(baseline);

    const expanded = await post(`series/${series.id}/expand`, 'admin', { from: day, to: day }).expect(201);
    expect(expanded.body.created).toEqual([day]);

    const v2 = entries((await get(`v2?from=${day}&to=${day}`, 'admin').expect(200)).body);
    const slot = v2.filter(entry => entry.startTime === '16:00');
    expect(slot).toHaveLength(1);
    expect(slot[0]).toMatchObject({ source: 'series', subject: 'Информатика', lessonId: expect.any(String) });
    // The slot replace by the earlier occurrence test still resolves to one entry.
    const morning = v2.filter(entry => entry.startTime === '08:30');
    expect(morning).toHaveLength(1);
    expect(morning[0]).toMatchObject({ occurrenceId: expect.any(String), lessonId: f.lesson.id });

    // The legacy endpoint, used by today and attendance, sees the same lesson.
    const legacy = await http().get('/api/v1/schedule/range').query({ startDate: day, endDate: day }).auth(tokens.admin, { type: 'bearer' }).expect(200);
    const mirrored = legacy.body.data.filter((lesson: { startTime: string }) => lesson.startTime === '16:00');
    expect(mirrored).toEqual([expect.objectContaining({ id: slot[0].lessonId, subject: 'Информатика', groupId: f.groups[0].id })]);

    // A repeated run neither duplicates the occurrence nor the legacy lesson.
    const again = await post(`series/${series.id}/expand`, 'admin', { from: day, to: day }).expect(201);
    expect(again.body.created).toEqual([]);
    expect(again.body.skipped).toEqual([{ date: day, reason: 'Занятие уже создано' }]);
    const legacyAgain = await http().get('/api/v1/schedule/range').query({ startDate: day, endDate: day }).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(legacyAgain.body.data.filter((lesson: { startTime: string }) => lesson.startTime === '16:00')).toHaveLength(1);
  });


  it('creates, edits and deletes a series through the dispatcher API', async () => {
    const course = await f.db.getRepository(Course).save({
      organizationId: f.uni.id,
      code: `CRS-${randomUUID().slice(0, 8)}`,
      name: 'Информатика',
      isActive: true,
    });
    const weekday = ((new Date(f.lesson.startDate).getUTCDay() + 6) % 7) + 1;
    const base = {
      courseId: course.id,
      groupId: f.groups[0].id,
      teacherId: f.users.teacher.id,
      title: 'Информатика',
      subjectType: 'practice',
      dayOfWeek: weekday,
      startTime: '18:00',
      endTime: '19:30',
      pairNumber: 8,
      room: '110',
      validFrom: iso(f.lesson.startDate),
    };

    // The occupied 08:30 slot of the fixture lesson must be rejected.
    const clash = await post('series', 'admin', { ...base, startTime: '08:30', endTime: '10:00', pairNumber: 1 }).expect(409);
    expect(clash.body.message).toContain('Конфликт расписания');

    await post('series', 'student', base).expect(403);

    const created = await post('series', 'admin', base).expect(201);
    expect(created.body).toMatchObject({ id: expect.any(String), groupId: f.groups[0].id, courseId: course.id, dayOfWeek: weekday, startTime: '18:00', weekType: 'both' });

    const listed = await get(`series?groupId=${f.groups[0].id}`, 'admin').expect(200);
    expect(listed.body.map((row: { id: string }) => row.id)).toContain(created.body.id);

    const patched = await http().patch(`/api/v1/schedule/series/${created.body.id}`).auth(tokens.admin, { type: 'bearer' }).send({ room: '111' }).expect(200);
    expect(patched.body).toMatchObject({ id: created.body.id, room: '111' });

    const otherUniversity = await http().get(`/api/v1/schedule/series?groupId=${f.groups[0].id}`).auth(tokens.outsider, { type: 'bearer' }).expect(200);
    expect(otherUniversity.body).toEqual([]);

    await http().delete(`/api/v1/schedule/series/${created.body.id}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    const afterDelete = await get(`series?groupId=${f.groups[0].id}`, 'admin').expect(200);
    expect(afterDelete.body.map((row: { id: string }) => row.id)).not.toContain(created.body.id);
  });
});
