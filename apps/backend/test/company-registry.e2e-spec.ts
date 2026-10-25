import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { createCurationFixture } from './curation.fixture';
import { CareerCompany, CareerMembership, CareerPartnership } from '../src/career/career.entities';
import { CompanyRegistry1700000000039 } from '../src/migrations/1700000000039-CompanyRegistry';

const suite = process.env.COMPANY_REGISTRY_TEST_DATABASE_URL ? describe : describe.skip;
jest.setTimeout(90000);
suite('Company registry registration and recheck with real JWT/PostgreSQL', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  let companyId: string, ownerId: string, memberId: string, mode = 'matched', ip = 0;
  const tokens: Record<string, string> = {};
  const inn = '7707083893';
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let wait: Promise<void> | undefined, entered: (() => void) | undefined;
  const http = () => request(f.app.getHttpServer());
  const create = (actor = 'owner', extra: object = {}) => http().post('/api/v1/career/companies').auth(tokens[actor], { type: 'bearer' })
    .set('X-Forwarded-For', `192.0.2.${++ip}`).send({ name: 'Синтетическая компания', description: 'Проверка регистрации', universityId: f.uni.id, inn, ...extra });
  const check = (actor = 'owner', body: object = {}) => http().post(`/api/v1/career/companies/${companyId}/registry-check`)
    .auth(tokens[actor], { type: 'bearer' }).set('X-Forwarded-For', `192.0.2.${++ip}`).send(body);
  const ready = () => f.db.getRepository(CareerCompany).update(companyId, { registryRequestedAt: new Date(0) });
  beforeAll(async () => {
    f = await createCurationFixture(process.env.COMPANY_REGISTRY_TEST_DATABASE_URL!);
    f.app.getHttpAdapter().getInstance().set('trust proxy', true);
    const runner = f.db.createQueryRunner();
    try {
      await runner.query(`ALTER TABLE career_company DROP COLUMN inn, DROP COLUMN "registryStatus", DROP COLUMN "registryCheckedAt", DROP COLUMN "registryRequestedAt", DROP COLUMN "registryLegalName", DROP COLUMN "registryOgrn", DROP COLUMN "registryReason", DROP COLUMN "registryCheckVersion"`);
      await new CompanyRegistry1700000000039().up(runner); await new CompanyRegistry1700000000039().up(runner);
    } finally { await runner.release(); }
    const config = f.app.get(ConfigService), get = config.get.bind(config);
    jest.spyOn(config, 'get').mockImplementation(((key: string, ...args: unknown[]) => key === 'CAREER_COMPANY_REGISTRY_ENABLED' ? 'true' : get(key, ...args)) as typeof config.get);
    fetchMock = jest.fn(async (url: string) => {
      if (!url.startsWith('https://egrul.nalog.ru/')) throw new Error('Unexpected external request');
      if (wait) { entered?.(); await wait; }
      const result = url === 'https://egrul.nalog.ru/'
        ? mode === 'captcha' ? { captchaRequired: true } : { t: 'synthetic_registry_ticket' }
        : { rows: mode === 'absent' ? [] : [{ i: inn, k: 'ul', n: 'Реестровое синтетическое имя', o: '1027700132195', ...(mode === 'inactive' ? { e: '01.01.2020' } : {}) }] };
      return new Response(JSON.stringify(result), { status: mode === 'unavailable' ? 503 : 200, headers: { 'Content-Type': 'application/json' } });
    });
    global.fetch = fetchMock;
    for (const actor of ['owner', 'foreign', 'member']) {
      const registration = await http().post('/api/v1/career/accounts/register').set('X-Forwarded-For', `198.51.100.${++ip}`)
        .send({ email: `${actor}@registry.example.test`, password: f.password, firstName: 'Синтетический', lastName: actor }).expect(201);
      tokens[actor] = registration.body.accessToken;
      const profile = await http().get('/api/v1/users/me').auth(tokens[actor], { type: 'bearer' }).expect(200);
      if (actor === 'owner') ownerId = profile.body.id;
      if (actor === 'member') memberId = profile.body.id;
    }
    const student = await http().post('/api/v1/auth/login').send({ email: f.users.student.email, password: f.password }).expect(200);
    tokens.student = student.body.accessToken;
    const [role] = await f.db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });
  afterAll(async () => { global.fetch = originalFetch; jest.restoreAllMocks(); await f?.app.close(); });

  it('requires INN and server-controlled verification fields, rejecting invalid input before network', async () => {
    const before = fetchMock.mock.calls.length;
    await create('owner', { inn: undefined }).expect(400);
    await create('owner', { inn: '7707083894' }).expect(400);
    await create('owner', { registryStatus: 'matched' }).expect(400);
    await create('student').expect(403);
    expect(fetchMock.mock.calls.length).toBe(before);
  });
  it('registers the company and stores the exact lookup separately from pending university partnership', async () => {
    const response = await create().expect(201); companyId = response.body.id;
    expect(response.body).toMatchObject({ inn, registryStatus: 'matched', registryLegalName: 'Реестровое синтетическое имя', registryOgrn: '1027700132195' });
    expect(response.body.registryCheckedAt).toBeTruthy();
    expect((await f.db.getRepository(CareerCompany).findOneByOrFail({ id: companyId })).registryStatus).toBe('matched');
    expect((await f.db.getRepository(CareerPartnership).findOneByOrFail({ companyId })).state).toBe('pending');
    expect(await f.db.getRepository(CareerMembership).existsBy({ companyId, userId: ownerId, role: 'company_owner' })).toBe(true);
  });
  it('denies foreign owners and ordinary company members before lookup; enforces company cooldown', async () => {
    await f.db.getRepository(CareerMembership).save({ companyId, userId: memberId, role: 'company_member', universityId: null });
    const before = fetchMock.mock.calls.length;
    await http().post(`/api/v1/career/companies/${companyId}/registry-check`).send({}).expect(401);
    await check('foreign').expect(403); await check('member').expect(403); await check().expect(409);
    expect(fetchMock.mock.calls.length).toBe(before);
  });
  it('does not permit changing a закреплённый INN through recheck', async () => {
    await ready(); await check('owner', { inn: '7707329152' }).expect(409);
    expect((await f.db.getRepository(CareerCompany).findOneByOrFail({ id: companyId })).inn).toBe(inn);
  });
  it.each([['captcha', 'captcha_required'], ['absent', 'not_found'], ['inactive', 'inactive'], ['unavailable', 'unavailable']])('persists %s as %s without approving partnership', async (scenario, status) => {
    mode = scenario; await ready(); const response = await check().expect(201);
    expect(response.body.registryStatus).toBe(status);
    expect((await f.db.getRepository(CareerPartnership).findOneByOrFail({ companyId })).state).toBe('pending');
  });
  it('rechecks ownership after an in-flight lookup and refuses a revoked owner', async () => {
    mode = 'matched'; await ready(); let release!: () => void;
    wait = new Promise(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const pending = check().then(response => response);
    try {
      await started;
      await f.db.getRepository(CareerMembership).update({ companyId, userId: ownerId }, { revokedAt: new Date() });
    } finally { wait = undefined; release(); }
    expect((await pending).status).toBe(403);
    expect((await f.db.getRepository(CareerCompany).findOneByOrFail({ id: companyId })).registryStatus).toBe('checking');
    await f.db.getRepository(CareerMembership).update({ companyId, userId: ownerId }, { revokedAt: null });
    await ready(); expect((await check().expect(201)).body.registryStatus).toBe('matched');
  });
  it('does not overwrite a newer check when an earlier external response arrives late', async () => {
    await ready(); mode = 'matched'; let release!: () => void;
    wait = new Promise(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const earlier = check().then(response => response);
    try {
      await started; wait = undefined; await ready(); mode = 'inactive';
      expect((await check().expect(201)).body.registryStatus).toBe('inactive');
    } finally { mode = 'matched'; wait = undefined; release(); }
    expect((await earlier).status).toBe(409);
    expect((await f.db.getRepository(CareerCompany).findOneByOrFail({ id: companyId })).registryStatus).toBe('inactive');
  });
  it('does not partially create the company if partnership persistence fails', async () => {
    mode = 'matched'; const before = await f.db.getRepository(CareerCompany).count();
    await f.db.query(`ALTER TABLE career_partnership ADD CONSTRAINT synthetic_registry_reject CHECK (state <> 'pending') NOT VALID`);
    try { await create().expect(500); expect(await f.db.getRepository(CareerCompany).count()).toBe(before); }
    finally { await f.db.query('ALTER TABLE career_partnership DROP CONSTRAINT synthetic_registry_reject'); }
  });
  it('protects saved INN records from accidental destructive migration rollback', async () => {
    const runner = f.db.createQueryRunner();
    try { await expect(new CompanyRegistry1700000000039().down(runner)).rejects.toThrow('Export'); }
    finally { await runner.release(); }
  });
});
