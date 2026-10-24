import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createCurationFixture } from './curation.fixture';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { PersonalLessonNote } from '../src/pair-space/entities/personal-lesson-note.entity';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { PERSONAL_DATASETS, PERSONAL_EXPORT_EXCLUDED_TABLES } from '../src/users/personal-data.catalog';

const suite = process.env.PERSONAL_DATA_TEST_DATABASE_URL ? describe : describe.skip;
suite('Personal JSON export: actual JWT, PostgreSQL and restrictive RLS', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const download = (actor = 'student') => http().get('/api/v1/users/me/export').auth(tokens[actor], { type: 'bearer' });
  beforeAll(async () => {
    f = await createCurationFixture(process.env.PERSONAL_DATA_TEST_DATABASE_URL!);
    const runner = f.db.createQueryRunner();
    try { await new PersonalDataRead1700000000037().up(runner); } finally { await runner.release(); }
    for (const actor of ['student', 'peer', 'teacher', 'outsider']) {
      tokens[actor] = (await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200)).body.accessToken;
    }
  }, 90000);
  afterAll(async () => { await f?.app.close(); }, 30000);

  it('requires authentication, uses self identity even with foreign query parameters and never emits credentials', async () => {
    await http().get('/api/v1/users/me/export').expect(401);
    const result = await download().query({ userId: f.users.outsider.id, universityId: f.otherUni.id }).expect(200);
    expect(result.headers['content-disposition']).toContain('attachment;');
    expect(result.headers['cache-control']).toContain('no-store');
    expect(result.body.complete).toBe(true);
    expect(result.body.datasets.users).toHaveLength(1);
    expect(result.body.datasets.users[0].id).toBe(f.users.student.id);
    expect(result.text).not.toContain(f.users.outsider.email);
    for (const field of ['passwordHash', 'sessionVersion', 'tokenHash', 'idempotencyKey', '__exportCursor']) expect(result.text).not.toContain(`"${field}"`);
    expect(result.body.limitations.length).toBeGreaterThan(0);
  });
  it('validates every frozen projection against actual database columns', async () => {
    const metadata = f.app.get(DataSource).entityMetadatas;
    const covered = new Set([...PERSONAL_DATASETS.map(dataset => dataset.table), ...Object.keys(PERSONAL_EXPORT_EXCLUDED_TABLES)]);
    expect(metadata.map(table => table.tableName).filter(table => !covered.has(table))).toEqual([]);
    for (const dataset of PERSONAL_DATASETS) {
      const entity = metadata.find(table => table.tableName === dataset.table);
      expect(entity).toBeDefined();
      const columns = entity!.columns.map(column => column.databaseName);
      for (const field of [...dataset.columns, ...dataset.owners, dataset.key]) expect(columns).toContain(field);
    }
  });
  it('exports all 205 rows across pages, including own former-university rows, while excluding peers and foreign accounts', async () => {
    // Notes have no pair-space FK: the lesson-space identifier is opaque here.
    const rows = Array.from({ length: 205 }, (_, index) => ({ userId: f.users.student.id, universityId: index < 105 ? f.uni.id : f.otherUni.id, pairSpaceId: randomUUID(), content: `OWN_NOTE_${index}` }));
    await f.db.getRepository(PersonalLessonNote).save(rows);
    await f.db.getRepository(PersonalLessonNote).save({ userId: f.users.peer.id, universityId: f.uni.id, pairSpaceId: f.lesson.id, content: 'PEER_PRIVATE_SENTINEL' });
    await f.db.getRepository(PersonalLessonNote).save({ userId: f.users.outsider.id, universityId: f.otherUni.id, pairSpaceId: f.lesson.id, content: 'FOREIGN_PRIVATE_SENTINEL' });
    const result = await download().expect(200);
    expect(result.body.counts.personal_lesson_notes).toBe(205);
    expect(new Set(result.body.datasets.personal_lesson_notes.map(row => row.id)).size).toBe(205);
    expect(result.text).toContain('OWN_NOTE_204');
    expect(result.text).not.toContain('PEER_PRIVATE_SENTINEL');
    expect(result.text).not.toContain('FOREIGN_PRIVATE_SENTINEL');
    const peer = await download('peer').expect(200);
    expect(peer.body.counts.personal_lesson_notes).toBe(1);
    expect(peer.text).not.toContain('OWN_NOTE_');
  });
  it('keeps the extra SQL visibility self-only and read-only, and removes it after the scoped operation', async () => {
    const tenant = f.app.get(TenantContext), db = f.app.get(DataSource);
    await tenant.runInRequest(async () => {
      tenant.setUser({ id: f.users.student.id, email: f.users.student.email, role: UserRole.STUDENT, universityId: f.uni.id });
      const read = () => db.query('SELECT id FROM personal_lesson_notes WHERE "universityId"=$1', [f.otherUni.id]);
      expect(await read()).toHaveLength(0);
      await tenant.runWithDatabaseAccess({ personalData: { userId: f.users.outsider.id } }, async () => expect(await read()).toHaveLength(0));
      await tenant.runWithDatabaseAccess({ personalData: { userId: f.users.student.id } }, async () => {
        expect(await read()).toHaveLength(100);
        const updated = await db.query('UPDATE personal_lesson_notes SET content=$1 WHERE "universityId"=$2 RETURNING id', ['MUTATION_FORBIDDEN', f.otherUni.id]);
        expect(updated[0]).toHaveLength(0);
      });
      expect(await read()).toHaveLength(0);
    });
  });
  it('allows career-only accounts without opening academic routes, and rejects deactivated sessions', async () => {
    const teacher = await download('teacher').expect(200);
    expect(teacher.body.datasets.lessons.map(lesson => lesson.id)).toContain(f.lesson.id);
    expect(teacher.body.datasets.personal_lesson_notes).toEqual([]);
    await f.db.getRepository(User).update(f.users.teacher.id, { universityId: null, role: UserRole.EMPLOYER });
    const login = await http().post('/api/v1/auth/login').send({ email: f.users.teacher.email, password: f.password }).expect(200);
    tokens.employer = login.body.accessToken;
    const result = await download('employer').expect(200);
    expect(result.body.datasets.users[0].id).toBe(f.users.teacher.id);
    await http().get('/api/v1/schedule').auth(tokens.employer, { type: 'bearer' }).expect(403);
    await f.db.getRepository(User).update(f.users.teacher.id, { isActive: false });
    await download('employer').expect(401);
  });
});
