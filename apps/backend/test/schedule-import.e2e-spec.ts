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
import { ImportRun } from '../src/schedule/connectors/import-run.entity';
import { ScheduleImportJobs1700000000033 } from '../src/migrations/1700000000033-ScheduleImportJobs';
import { ImportRuns1700000000050 } from '../src/migrations/1700000000050-ImportRuns';
import { TenantOrganizationAlias1700000000046 } from '../src/migrations/1700000000046-TenantOrganizationAlias';
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
    try {
      // import_runs references schedule_import_jobs, so the journal goes first;
      // 050 recreates it together with the university threshold column.
      await runner.query('DROP TABLE IF EXISTS import_runs');
      await runner.query('DROP TABLE schedule_import_jobs');
      await new ScheduleImportJobs1700000000033().up(runner);
      await new ImportRuns1700000000050().up(runner);
      await new TenantOrganizationAlias1700000000046().up(runner);
    } finally { await runner.release(); }
    service = f.app.get(ScheduleImportService);
    await f.db.getRepository(User).update(f.users.outsider.id, { role: UserRole.UNIVERSITY_ADMIN });
    for (const actor of ['admin', 'student', 'outsider']) {
      const result = await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200);
      tokens[actor] = result.body.accessToken;
    }
  }, 60000);
  afterAll(async () => { if (f) await f.app.close(); });
  it('highlights overlapping groups, teachers and rooms in the import preview', async () => {
    const rows = [
      row('conflict-a', { teacher: 'Иванова М.', room: '203' }),
      row('conflict-b', { startTime: '02:00', endTime: '03:00', teacher: 'иванова м.', room: '203' }),
      row('adjacent', { startTime: '03:00', endTime: '04:00', teacher: 'Иванова М.', room: '203' }),
      row('cancelled', { teacher: 'Иванова М.', room: '203', status: 'cancelled' }),
    ];
    const { body } = await submit(payload('overlap-preview', { dryRun: true, content: JSON.stringify(rows) })).expect(201);
    const warnings = body.warnings.filter(warning => warning.message.includes('пересечение'));
    expect(warnings).toHaveLength(3);
    for (const resource of ['группа', 'преподаватель', 'аудитория']) {
      expect(warnings).toContainEqual({ row: 2, externalId: 'conflict-b', message: `Возможное пересечение: ${resource}, строка 1.` });
    }
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:overlap-preview' })).toBe(0);
  });
  it('creates and idempotently repeats an import, preserving local day and immutable delta journal', async () => {
    const key = randomUUID(), data = payload('first', { idempotencyKey: key });
    const first = await submit(data).expect(201);
    expect(first.body).toMatchObject({ status: 'completed', imported: 1, updated: 0 });
    expect((await submit(data).expect(201)).body.jobId).toBe(first.body.jobId);
    await submit({ ...data, content: JSON.stringify([row('first', { subject: 'Другой' })]) }).expect(409);
    const lesson = await f.db.getRepository(Lesson).findOneByOrFail({ source: 'university-import:first' });
    expect(lesson.startDate.toISOString()).toBe('2026-10-21T19:00:00.000Z'); expect(lesson.dayOfWeek).toBe(4);
    await f.app.get(TenantContext).runWithDatabaseAccess({ tables: ['schedule_import_jobs', 'academic_schedule_changes'], organizationIds: [f.uni.id] }, () => service.getChanges(f.uni.id, first.body.jobId, new PaginationQueryDto()));
    const journal = await http().get(`/api/v1/admin/schedule/imports/${first.body.jobId}/changes`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(journal.body.meta.total).toBe(1); expect(journal.body.data[0].newValue.changeType).toBe('added');
    await submit(payload('first')).expect(201).expect(({ body }) => expect(body.unchanged).toBe(1));
    expect(await f.db.getRepository(ScheduleChange).count({ where: { legacyLessonId: lesson.id } })).toBe(1);
  });
  it('updates and soft-cancels only source-owned lessons within explicit groups/local days; preserves manual and other sources', async () => {
    await submit(payload('replace', { content: JSON.stringify([row('a'), row('b')]) })).expect(201);
    const manual = await f.db.getRepository(Lesson).save({ ...f.lesson, id: randomUUID(), source: 'manual', startDate: new Date('2026-10-21T19:00Z') });
    const data = payload('replace', { content: JSON.stringify([row('a', { room: '999' })]), replace: true, startDate: '2026-10-22', endDate: '2026-10-22', groupNames: ['ИН-25'], confirmMassChange: true });
    const result = await submit(data).expect(201); expect(result.body).toMatchObject({ imported: 0, updated: 1, deleted: 1 });
    expect(await f.db.getRepository(Lesson).countBy({ id: manual.id })).toBe(1);
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:first' })).toBe(1);
    const b = await f.db.getRepository(Lesson).findOneOrFail({ where: { externalId: 'b', source: 'university-import:replace' }, withDeleted: true });
    expect(b.deletedAt).toBeInstanceOf(Date);
    expect(await f.db.getRepository(Lesson).countBy({ id: b.id })).toBe(0);
    const changes = await f.db.getRepository(ScheduleChange).findBy({ legacyLessonId: b.id });
    expect(changes.map(change => change.newValue.changeType)).toEqual(['added', 'deleted']);
    await submit(payload('replace', { content: JSON.stringify([row('b')]), confirmMassChange: true })).expect(201).expect(({ body }) => expect(body.updated).toBe(1));
  });
  it('rejects unauthorized role, duplicate IDs and foreign group names; hides foreign jobs/journal', async () => {
    await submit(payload('role'), 'student').expect(403);
    await http().get('/api/v1/admin/schedule/imports/not-a-uuid').auth(tokens.admin, { type: 'bearer' }).expect(400);
    await submit(payload('duplicate', { content: JSON.stringify([row('same'), row('same')]) })).expect(400);
    await submit(payload('foreign', { content: JSON.stringify([row('foreign', { group: f.groups[3].name })]) })).expect(400);
    const job = await f.db.getRepository(ScheduleImportJob).findOneByOrFail({ organizationId: f.uni.id });
    for (const suffix of ['', '/changes']) await http().get(`/api/v1/admin/schedule/imports/${job.id}${suffix}`).auth(tokens.outsider, { type: 'bearer' }).expect(404);
    const foreignCount = await f.db.getRepository(Lesson).countBy({ organizationId: f.otherUni.id }); expect(foreignCount).toBe(0);
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
  it('answers a server dry-run with the plan, a downloadable report and no queued job (FR-IMP-04)', async () => {
    // The previous test revoked the admin account; the token must work again.
    await f.db.getRepository(User).update(f.users.admin.id, { isActive: true });
    const jobsBefore = await f.db.getRepository(ScheduleImportJob).count();
    const content = JSON.stringify([row('dry-1'), row('dry-2', { date: '2026-13-45' })]);
    const dry = await submit(payload('dry', { content, dryRun: true })).expect(201);
    expect(dry.body).toMatchObject({ dryRun: true, summary: { imported: 1, updated: 0, deleted: 0, errors: 1 } });
    expect(dry.body.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 1, outcome: 'created' }),
      expect.objectContaining({ row: 2, outcome: 'error', message: expect.stringContaining('дата') }),
    ]));
    expect(dry.body.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ row: 1 })]));
    expect(dry.body.errors).toHaveLength(1);
    expect(dry.body.requiresConfirmation).toBe(false);
    expect(dry.body.existingActive).toBeGreaterThan(0);
    expect(dry.body.runId).toEqual(expect.any(String));
    // A dry-run is read-only: no job, no lessons.
    expect(await f.db.getRepository(ScheduleImportJob).count()).toBe(jobsBefore);
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:dry' })).toBe(0);
    const run = await http().get(`/api/v1/admin/import-runs/${dry.body.runId}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(run.body).toMatchObject({ dryRun: true, mode: 'dry-run', status: 'completed', mappingVersion: '1' });
    expect(run.body.fileHash).toEqual(expect.any(String));
    expect(run.body.result.summary).toMatchObject({ imported: 1, errors: 1 });
    const report = await http().get(`/api/v1/admin/import-runs/${dry.body.runId}/report`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(report.headers['content-type']).toContain('text/csv');
    expect(report.headers['content-disposition']).toContain(`import-run-${dry.body.runId}.csv`);
    expect(report.text.charCodeAt(0)).toBe(0xfeff);
    expect(report.text).toContain('Тип;Строка;Внешний ID');
    expect(report.text).toContain('создано');
    expect(report.text).toContain('ошибка');
    // The run journal is tenant-isolated.
    await http().get(`/api/v1/admin/import-runs/${dry.body.runId}`).auth(tokens.outsider, { type: 'bearer' }).expect(404);
    await http().get('/api/v1/admin/import-runs/not-a-uuid').auth(tokens.admin, { type: 'bearer' }).expect(400);
    const [rls] = await f.db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='import_runs'");
    expect(rls).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
  it('gates mass changes behind an explicit confirmation and honors the organization threshold (FR-IMP-08)', async () => {
    // Creates are never gated, so the seed row lands without a flag.
    await submit(payload('gate', { content: JSON.stringify([row('g1'), row('g2')]) })).expect(201);
    const changed = payload('gate', { content: JSON.stringify([row('g1', { room: '101' }), row('g2', { room: '102' })]) });
    const setThreshold = (value: number) => http().patch('/api/v1/admin/university').auth(tokens.admin, { type: 'bearer' }).send({ importMassChangeThreshold: value }).expect(200);
    await setThreshold(0);
    try {
      const jobsBefore = await f.db.getRepository(ScheduleImportJob).count();
      const gated = await submit(changed).expect(409);
      expect(gated.body).toMatchObject({ code: 'IMPORT_NEEDS_CONFIRMATION' });
      // Nothing durable is written before the confirmation (FR-IMP-08).
      expect(await f.db.getRepository(ScheduleImportJob).count()).toBe(jobsBefore);
      const g1 = await f.db.getRepository(Lesson).findOneByOrFail({ source: 'university-import:gate', externalId: 'g1' });
      expect(g1.room).toBeFalsy();
      // The explicit confirmation applies the very same payload.
      const confirmed = await submit({ ...changed, confirmMassChange: true }).expect(201);
      expect(confirmed.body).toMatchObject({ updated: 2, deleted: 0, runId: expect.any(String) });
      expect((await f.db.getRepository(Lesson).findOneByOrFail({ source: 'university-import:gate', externalId: 'g1' })).room).toBe('101');
      // Threshold 100 disables only the mass-change gate.
      await setThreshold(100);
      const free = payload('gate', { content: JSON.stringify([row('g1', { room: '103' }), row('g2', { room: '104' })]) });
      await submit(free).expect(201).expect(({ body }) => expect(body.updated).toBe(2));
    } finally {
      await setThreshold(30);
    }
  });
  it('applies only valid rows atomically and keeps error rows for the report (FR-IMP-07)', async () => {
    const content = JSON.stringify([row('p1'), row('p2', { date: '2026-13-45' }), row('p3')]);
    const applied = await submit(payload('partial', { content })).expect(201);
    expect(applied.body).toMatchObject({ imported: 2, updated: 0, deleted: 0, errors: 1 });
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:partial' })).toBe(2);
    const run = await http().get(`/api/v1/admin/import-runs/${applied.body.runId}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(run.body.result.summary).toMatchObject({ imported: 2, errors: 1 });
    const errorRows = run.body.result.rows.filter((entry: { outcome: string }) => entry.outcome === 'error');
    expect(errorRows).toHaveLength(1);
    expect(errorRows[0]).toMatchObject({ row: 2, message: expect.stringContaining('дата') });
    // The dry-run of the same file agrees with what was applied, without applying.
    const dry = await submit(payload('partial', { content, dryRun: true })).expect(201);
    expect(dry.body.summary).toMatchObject({ imported: 0, updated: 0, unchanged: 2, errors: 1 });
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:partial' })).toBe(2);
  });
  it('rolls an applied run back inside 30 days and never overwrites newer data (FR-IMP-05)', async () => {
    // Dry-runs and foreign accounts are not rollback targets.
    const dry = await submit(payload('rb-dry', { content: JSON.stringify([row('rd1')]), dryRun: true })).expect(201);
    await http().post(`/api/v1/admin/import-runs/${dry.body.runId}/rollback`).auth(tokens.admin, { type: 'bearer' }).expect(400);
    await http().post(`/api/v1/admin/import-runs/${dry.body.runId}/rollback`).auth(tokens.outsider, { type: 'bearer' }).expect(404);
    // 1) Created rows are compensated by a soft delete.
    const seed = await submit(payload('rb-created', { content: JSON.stringify([row('rc1'), row('rc2', { room: '101' })]) })).expect(201);
    const undone = await http().post(`/api/v1/admin/import-runs/${seed.body.runId}/rollback`).auth(tokens.admin, { type: 'bearer' }).expect(201);
    expect(undone.body).toMatchObject({ restored: 2, conflicts: [] });
    expect(await f.db.getRepository(Lesson).countBy({ source: 'university-import:rb-created' })).toBe(0);
    await http().post(`/api/v1/admin/import-runs/${seed.body.runId}/rollback`).auth(tokens.admin, { type: 'bearer' }).expect(400);
    const seedRun = await http().get(`/api/v1/admin/import-runs/${seed.body.runId}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(seedRun.body.rollbackResult).toMatchObject({ restored: 2 });
    expect(seedRun.body.rolledBackAt).toEqual(expect.any(String));
    // 2) Updated rows return to their pre-import values.
    await submit(payload('rb-updated', { content: JSON.stringify([row('ru1', { room: '101' })]) })).expect(201);
    const update = await submit(payload('rb-updated', { content: JSON.stringify([row('ru1', { room: '202' })]) })).expect(201);
    expect(update.body).toMatchObject({ updated: 1 });
    const restored = await http().post(`/api/v1/admin/import-runs/${update.body.runId}/rollback`).auth(tokens.admin, { type: 'bearer' }).expect(201);
    expect(restored.body).toMatchObject({ restored: 1, conflicts: [] });
    expect((await f.db.getRepository(Lesson).findOneByOrFail({ source: 'university-import:rb-updated', externalId: 'ru1' })).room).toBe('101');
    // 3) Data changed after the import is never overwritten (FR-IMP-05).
    const conflictSeed = await submit(payload('rb-conflict', { content: JSON.stringify([row('rx1')]) })).expect(201);
    await f.db.getRepository(Lesson).update({ source: 'university-import:rb-conflict', externalId: 'rx1' }, { subject: 'Ручная правка' });
    const conflicted = await http().post(`/api/v1/admin/import-runs/${conflictSeed.body.runId}/rollback`).auth(tokens.admin, { type: 'bearer' }).expect(201);
    expect(conflicted.body).toMatchObject({ restored: 0 });
    expect(conflicted.body.conflicts).toEqual([expect.objectContaining({ reason: 'changed', externalId: 'rx1' })]);
    expect((await f.db.getRepository(Lesson).findOneByOrFail({ source: 'university-import:rb-conflict', externalId: 'rx1' })).subject).toBe('Ручная правка');
    // 4) The 30-day window is enforced.
    const expired = await submit(payload('rb-expired', { content: JSON.stringify([row('re1')]) })).expect(201);
    await f.db.getRepository(ImportRun).update({ id: expired.body.runId }, { completedAt: new Date(Date.now() - 31 * 86400000) });
    await http().post(`/api/v1/admin/import-runs/${expired.body.runId}/rollback`).auth(tokens.admin, { type: 'bearer' }).expect(400);
    await http().post('/api/v1/admin/import-runs/not-a-uuid/rollback').auth(tokens.admin, { type: 'bearer' }).expect(400);
  });
});
