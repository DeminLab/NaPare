import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createCurationFixture } from './curation.fixture';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { Lesson } from '../src/schedule/entities/lesson.entity';
import { ScheduleChange } from '../src/academic/entities/schedule-change.entity';
import { ScheduleImportService } from '../src/schedule/connectors/schedule-import.service';
import { ScheduleImportJob } from '../src/schedule/connectors/schedule-import-job.entity';
import { ScheduleImportJobs1700000000033 } from '../src/migrations/1700000000033-ScheduleImportJobs';
import { PaginationQueryDto } from '../src/common/dto/pagination-query.dto';
import { SibitScheduleConnector } from '../src/schedule/connectors/external-schedule-connectors';
import { normalizeScheduleRow } from '../src/schedule/connectors/file-schedule-connectors';

const suite = process.env.SCHEDULE_IMPORT_TEST_DATABASE_URL ? describe : describe.skip;
suite('Queued schedule import: real HTTP/JWT/PostgreSQL FORCE RLS', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  let service: ScheduleImportService;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const submit = (data: object, actor = 'admin') => http().post('/api/v1/admin/schedule/upload').auth(tokens[actor], { type: 'bearer' }).send(data);
  const row = (id: string, overrides = {}) => ({ id, date: '2026-10-22', startTime: '01:00', endTime: '02:30', pairNumber: 1, subject: 'Математика', group: 'ИН-25', ...overrides });
  const payload = (id: string, overrides = {}) => ({ fileName: 'schedule.json', format: 'json', content: JSON.stringify([row(id)]), sourceKey: id, utcOffset: '+06:00', ...overrides });
  beforeAll(async () => {
    f = await createCurationFixture(process.env.SCHEDULE_IMPORT_TEST_DATABASE_URL!);
    const runner = f.db.createQueryRunner();
    await runner.connect();
    try { await runner.query('DROP TABLE schedule_import_jobs'); await new ScheduleImportJobs1700000000033().up(runner); } finally { await runner.release(); }
    service = f.app.get(ScheduleImportService);
    await f.db.getRepository(User).update(f.users.outsider.id, { role: UserRole.UNIVERSITY_ADMIN });
    for (const actor of ['admin', 'student', 'outsider']) {
      const result = await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200);
      tokens[actor] = result.body.accessToken;
    }
  }, 60000);
  afterAll(async () => { if (f) await f.app.close(); });
  it('creates and idempotently repeats an import, preserving local day and immutable delta journal', async () => {
    const key = randomUUID(), data = payload('first', { idempotencyKey: key });
    const first = await submit(data).expect(201);
    expect(first.body).toMatchObject({ status: 'completed', imported: 1, updated: 0 });
    expect((await submit(data).expect(201)).body.jobId).toBe(first.body.jobId);
    await submit({ ...data, content: JSON.stringify([row('first', { subject: 'Другой' })]) }).expect(409);
    const lesson = await f.db.getRepository(Lesson).findOneByOrFail({ source: 'university-import:first' });
    expect(lesson.startDate.toISOString()).toBe('2026-10-21T19:00:00.000Z'); expect(lesson.dayOfWeek).toBe(4);
    await f.app.get(TenantContext).runWithDatabaseAccess({ tables: ['schedule_import_jobs', 'academic_schedule_changes'], universityIds: [f.uni.id] }, () => service.getChanges(f.uni.id, first.body.jobId, new PaginationQueryDto()));
    const journal = await http().get(`/api/v1/admin/schedule/imports/${first.body.jobId}/changes`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(journal.body.meta.total).toBe(1); expect(journal.body.data[0].newValue.changeType).toBe('added');
    await submit(payload('first')).expect(201).expect(({ body }) => expect(body.unchanged).toBe(1));
    expect(await f.db.getRepository(ScheduleChange).count({ where: { legacyLessonId: lesson.id } })).toBe(1);
  });
  it('updates and soft-cancels only source-owned lessons within explicit groups/local days; preserves manual and other sources', async () => {
    await submit(payload('replace', { content: JSON.stringify([row('a'), row('b')]) })).expect(201);
    const manual = await f.db.getRepository(Lesson).save({ ...f.lesson, id: randomUUID(), source: 'manual', startDate: new Date('2026-10-21T19:00Z') });
    const data = payload('replace', { content: JSON.stringify([row('a', { room: '999' })]), replace: true, startDate: '2026-10-22', endDate: '2026-10-22', groupNames: ['ИН-25'] });
    const result = await submit(data).expect(201); expect(result.body).toMatchObject({ imported: 0, updated: 1, deleted: 1 });
    expect(await f.db.getRepository(Lesson).countBy({ id: manual.id })).toBe(1);
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:first' })).toBe(1);
    const b = await f.db.getRepository(Lesson).findOneOrFail({ where: { externalId: 'b', source: 'university-import:replace' }, withDeleted: true });
    expect(b.deletedAt).toBeInstanceOf(Date);
    expect(await f.db.getRepository(Lesson).countBy({ id: b.id })).toBe(0);
    const changes = await f.db.getRepository(ScheduleChange).findBy({ legacyLessonId: b.id });
    expect(changes.map(change => change.newValue.changeType)).toEqual(['added', 'deleted']);
    await submit(payload('replace', { content: JSON.stringify([row('b')]) })).expect(201).expect(({ body }) => expect(body.updated).toBe(1));
  });
  it('rejects unauthorized role, duplicate IDs and foreign group names; hides foreign jobs/journal', async () => {
    await submit(payload('role'), 'student').expect(403);
    await http().get('/api/v1/admin/schedule/imports/not-a-uuid').auth(tokens.admin, { type: 'bearer' }).expect(400);
    await submit(payload('duplicate', { content: JSON.stringify([row('same'), row('same')]) })).expect(400);
    await submit(payload('foreign', { content: JSON.stringify([row('foreign', { group: f.groups[3].name })]) })).expect(400);
    const job = await f.db.getRepository(ScheduleImportJob).findOneByOrFail({ universityId: f.uni.id });
    for (const suffix of ['', '/changes']) await http().get(`/api/v1/admin/schedule/imports/${job.id}${suffix}`).auth(tokens.outsider, { type: 'bearer' }).expect(404);
    const foreignCount = await f.db.getRepository(Lesson).countBy({ universityId: f.otherUni.id }); expect(foreignCount).toBe(0);
  });
  it('processes durable queued jobs once across two concurrent workers and denies raw unscoped access', async () => {
    const response = await submit(payload('queued', { queued: true })).expect(201);
    expect(response.body.status).toBe('queued');
    const results = await Promise.all([service.processJob(response.body.jobId), service.processJob(response.body.jobId)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const job = await f.db.getRepository(ScheduleImportJob).findOneByOrFail({ id: response.body.jobId }); expect(job.status).toBe('completed'); expect(job.attempts).toBe(1); expect(job.payload).toBeNull();
    const source = f.app.get(DataSource), context = f.app.get(TenantContext);
    await context.runInRequest(async () => expect(await source.getRepository(ScheduleImportJob).count()).toBe(0));
    const [rls] = await f.db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='schedule_import_jobs'");
    expect(rls).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
  it('never falls back from a foreign SIBIT group ID to a matching name or autoassigns a teacher by name', async () => {
    const connector = f.app.get(SibitScheduleConnector);
    const fetch = jest.spyOn(connector, 'fetchSchedule').mockResolvedValue([{ ...normalizeScheduleRow(row('sibit-foreign'), '+06:00'), groupExternalId: '999999', sourceTeacherId: '456' }]);
    try {
      await submit({ fileName: 'sibit', format: 'sibit', sourceKey: 'sibit-test' }).expect(400);
      fetch.mockResolvedValue([
        { ...normalizeScheduleRow(row('sibit-own'), '+06:00'), groupExternalId: '101', sourceTeacherId: '456', teacherName: f.users.teacher.lastName },
        { ...normalizeScheduleRow(row('sibit-own', { group: f.groups[1].name }), '+06:00'), groupExternalId: '102', sourceTeacherId: '456' },
      ]);
      await submit({ fileName: 'sibit', format: 'sibit', sourceKey: 'sibit-test' }).expect(201).expect(({ body }) => expect(body.imported).toBe(2));
      const saved = await f.db.getRepository(Lesson).findOneByOrFail({ source: 'university-import:sibit-test', groupId: f.groups[0].id });
      expect(saved.sourceTeacherId).toBe('456'); expect(saved.teacherId).toBeNull(); expect(saved.groupId).toBe(f.groups[0].id);
    } finally { fetch.mockRestore(); }
  });
  it('accepts bounded file JSON above the default 100 KiB limit only on the upload route', async () => {
    const rows = Array.from({ length: 400 }, (_, index) => row(`large-${index}`, { subject: 'Математика '.repeat(20) }));
    const data = payload('large', { content: JSON.stringify(rows), queued: true });
    expect(Buffer.byteLength(JSON.stringify(data))).toBeGreaterThan(102400);
    await submit(data).expect(201).expect(({ body }) => expect(body.status).toBe('queued'));
    await http().post('/api/v1/auth/login').send({ email: 'x'.repeat(110000) }).expect(413);
  });
  it('rolls back failures, retries transient errors with backoff, stops at three and rechecks actor revocation', async () => {
    const result = await submit(payload('retry', { queued: true })).expect(201);
    const apply = jest.spyOn(service as unknown as { apply(): Promise<unknown> }, 'apply').mockRejectedValue(new Error('synthetic DB outage'));
    await service.processJob(result.body.jobId);
    let job = await f.db.getRepository(ScheduleImportJob).findOneByOrFail({ id: result.body.jobId });
    expect(job.status).toBe('queued'); expect(job.attempts).toBe(1); expect(job.lastError).not.toContain('synthetic'); expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    apply.mockRestore(); await service.processJob(result.body.jobId);
    job = await f.db.getRepository(ScheduleImportJob).findOneByOrFail({ id: result.body.jobId }); expect(job.status).toBe('completed'); expect(job.attempts).toBe(2);
    const failed = await submit(payload('failed', { queued: true })).expect(201);
    const fail = jest.spyOn(service as unknown as { apply(): Promise<unknown> }, 'apply').mockRejectedValue(new Error('synthetic outage'));
    try { await service.processJob(failed.body.jobId); await service.processJob(failed.body.jobId); await service.processJob(failed.body.jobId); } finally { fail.mockRestore(); }
    job = await f.db.getRepository(ScheduleImportJob).findOneByOrFail({ id: failed.body.jobId }); expect(job.status).toBe('failed'); expect(job.attempts).toBe(3);
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:failed' })).toBe(0);
    const revoked = await submit(payload('revoked', { queued: true })).expect(201);
    await f.db.getRepository(User).update(f.users.admin.id, { isActive: false });
    await service.processJob(revoked.body.jobId);
    expect((await f.db.getRepository(ScheduleImportJob).findOneByOrFail({ id: revoked.body.jobId })).status).toBe('failed');
  });
});
