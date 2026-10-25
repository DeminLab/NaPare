import * as request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import { createCurationFixture } from './curation.fixture';
import { CareerCompany, CareerMembership } from '../src/career/career.entities';
import { CareerPayment, CareerPaymentRefund } from '../src/career-billing/payment.entity';
import { tkassaToken } from '../src/career-billing/tkassa.provider';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { bindPlatformOwner } from '../src/platform/bootstrap-owner';
import { CareerBilling1700000000035 } from '../src/migrations/1700000000035-CareerBilling';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';

const suite = process.env.PAYMENT_TEST_DATABASE_URL ? describe : describe.skip;
suite('Career platform billing: HTTP + PostgreSQL + mocked bank transport', () => {
  let fixture: Awaited<ReturnType<typeof createCurationFixture>>;
  let companyId: string;
  let foreignCompanyId: string;
  const tokens: Record<string, string> = {};
  const password = randomBytes(24).toString('hex');
  type Attempt = { PaymentId: string; OrderId: string; Amount: number; Status: string };
  const attempts = new Map<string, Attempt>();
  const methods: string[] = [];
  let initTimeout = false;
  let cancelTimeout = false;
  let fetchMock: jest.SpyInstance;
  const http = () => request(fixture.app.getHttpServer());
  const api = (method: 'get' | 'post', path: string, who = 'admin') => http()[method](`/api/v1/career/payments${path}`).auth(tokens[who], { type: 'bearer' });
  const create = (idempotencyKey = randomUUID()) => api('post', '').send({ companyId, product: 'career_access', idempotencyKey });
  const signed = (attempt: Attempt, changes = {}) => {
    const body = { ...attempt, TerminalKey: 'synthetic-terminal', Success: true, ...changes };
    return { ...body, Token: tkassaToken(body, password) };
  };
  beforeAll(async () => {
    Object.assign(process.env, { TKASSA_SEND_REQUESTS: 'true', TKASSA_TERMINAL_KEY: 'synthetic-terminal', TKASSA_PASSWORD: password,
      TKASSA_CAREER_ACCESS_PRICE_MINOR: '12000', TKASSA_PUBLIC_ORIGIN: 'https://billing.example.test', TKASSA_TAXATION: 'usn_income', TKASSA_ITEM_TAX: 'none', TKASSA_TERMINAL_CURRENCY: 'RUB', TKASSA_LIVE: 'false' });
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (!String(url).startsWith('https://rest-api-test.tinkoff.ru/v2/')) throw new Error('Unexpected outbound request blocked by test');
      const method = String(url).split('/').at(-1)!;
      const body = JSON.parse(String(init!.body));
      expect(body.Token).toBe(tkassaToken(body, password));
      methods.push(method);
      let result: Record<string, unknown>;
      if (method === 'Init') {
        // The intent is visible on another connection BEFORE the bank is called.
        expect((await fixture.db.getRepository(CareerPayment).findOneByOrFail({ id: body.OrderId })).state).toBe('unknown');
        const attempt = { PaymentId: String(attempts.size + 1000), OrderId: body.OrderId, Amount: body.Amount, Status: 'NEW' };
        attempts.set(attempt.OrderId, attempt);
        if (initTimeout) { initTimeout = false; throw new Error('Synthetic timeout after bank accepted Init'); }
        result = { ...attempt, PaymentURL: `https://securepay.tinkoff.ru/new/${attempt.PaymentId}` };
      } else if (method === 'CheckOrder') {
        const attempt = attempts.get(body.OrderId);
        result = { OrderId: body.OrderId, Payments: attempt ? [attempt] : [] };
      } else {
        const attempt = [...attempts.values()].find(item => item.PaymentId === body.PaymentId);
        if (!attempt) throw new Error('Unknown mocked payment');
        if (method === 'Cancel') {
          expect(await fixture.db.getRepository(CareerPaymentRefund).count({ where: { paymentId: attempt.OrderId, state: 'unknown' } })).toBe(1);
          if (cancelTimeout) { cancelTimeout = false; throw new Error('Synthetic cancellation timeout'); }
          attempt.Status = body.Amount === attempt.Amount ? 'REFUNDED' : 'PARTIAL_REFUNDED';
        }
        result = { ...attempt };
      }
      return new Response(JSON.stringify({ Success: true, TerminalKey: 'synthetic-terminal', ...result }), { status: 200 });
    });
    fixture = await createCurationFixture(process.env.PAYMENT_TEST_DATABASE_URL!);
    const owner = await fixture.db.getRepository(User).save({ email: 'billing-owner@example.test', firstName: 'Тест', lastName: 'Владелец', role: UserRole.DEVELOPER, universityId: null, passwordHash: fixture.users.student.passwordHash });
    await bindPlatformOwner(fixture.db, owner.email);
    const company = await fixture.db.getRepository(CareerCompany).save({ name: 'Own company', createdBy: fixture.users.admin.id });
    const foreign = await fixture.db.getRepository(CareerCompany).save({ name: 'Foreign company', createdBy: fixture.users.outsider.id });
    companyId = company.id; foreignCompanyId = foreign.id;
    await fixture.db.getRepository(CareerMembership).save([
      { userId: fixture.users.admin.id, companyId, role: 'company_owner' },
      { userId: fixture.users.outsider.id, companyId: foreignCompanyId, role: 'company_owner' },
    ]);
    // Exercise the actual production migration against an empty disposable schema.
    await fixture.db.query('DROP TABLE career_payment_events; DROP TABLE career_payment_refunds; DROP TABLE career_payments');
    const runner = fixture.db.createQueryRunner();
    try { await new CareerBilling1700000000035().up(runner); } finally { await runner.release(); }
    for (const [key, user] of Object.entries({ admin: fixture.users.admin, student: fixture.users.student, outsider: fixture.users.outsider, owner })) {
      const result = await http().post('/api/v1/auth/login').send({ email: user.email, password: fixture.password }).expect(200);
      tokens[key] = result.body.accessToken;
    }
  }, 90000);
  afterAll(async () => { await fixture?.app.close(); fetchMock?.mockRestore(); });
  beforeEach(() => {
    // Independent HTTP scenarios start with a fresh rate-limit window. The
    // real guard remains active; its rejection is tested explicitly below.
    const storage = fixture.app.get<ThrottlerStorageService>(getStorageToken());
    storage.onApplicationShutdown();
    for (const key of Object.keys(storage.storage)) delete storage.storage[key];
  });

  it('requires identity and company membership for prices and history', async () => {
    await http().get(`/api/v1/career/payments?companyId=${companyId}`).expect(401);
    await api('get', `?companyId=${foreignCompanyId}`).expect(403);
    await api('get', `/options?companyId=${companyId}`, 'student').expect(403);
    await api('get', `/options?companyId=${companyId}`).expect(200).expect(({ body }) => expect(body.amountMinor).toBe(12000));
  });
  it('uses server price and creates one bank attempt for concurrent retries', async () => {
    const key = randomUUID();
    const responses = await Promise.all([create(key), create(key)]);
    expect(responses.every(response => response.status === 201)).toBe(true);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    expect(methods.filter(method => method === 'Init')).toHaveLength(1);
    expect(responses.find(response => response.body.confirmationUrl)?.body.amountMinor).toBe(12000);
    expect(responses[0].body.receiptEmail).toBeUndefined();
    await api('post', '').send({ companyId, product: 'career_access', idempotencyKey: randomUUID(), amountMinor: 1 }).expect(400);
    await api('get', `/${responses[0].body.id}`, 'outsider').expect(403);
  });
  it('keeps a durable unknown intent on timeout and reconciles without a second Init', async () => {
    initTimeout = true;
    const key = randomUUID();
    const first = await create(key).expect(201);
    expect(first.body.state).toBe('unknown');
    const count = methods.filter(method => method === 'Init').length;
    const retry = await create(key).expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(methods.filter(method => method === 'Init')).toHaveLength(count);
    await api('post', `/${first.body.id}/refresh`).expect(200).expect(({ body }) => expect(body.state).toBe('pending'));
    expect(methods.filter(method => method === 'Init')).toHaveLength(count);
  });
  it('validates webhook signature, amount and bank state; handles duplicates and stale events', async () => {
    const created = await create().expect(201);
    const attempt = attempts.get(created.body.id)!;
    attempt.Status = 'CONFIRMED';
    await http().post('/api/v1/career/payments/notification').send({ ...signed(attempt), Token: '0'.repeat(64) }).expect(403);
    await http().post('/api/v1/career/payments/notification').send(signed(attempt, { Amount: 1 })).expect(409);
    for (let index = 0; index < 2; index++) await http().post('/api/v1/career/payments/notification').send(signed(attempt)).expect(200).expect('OK');
    await http().post('/api/v1/career/payments/notification').send(signed(attempt, { Status: 'NEW' })).expect(200);
    await api('get', `/${attempt.OrderId}`).expect(200).expect(({ body }) => expect(body.state).toBe('succeeded'));
    const events = await api('get', `/${attempt.OrderId}/history`).expect(200);
    expect(events.body.filter((event: { source: string }) => event.source === 'reconcile')).toHaveLength(1);
  });
  it('limits refunds to platform owner and makes a repeated refund idempotent', async () => {
    const created = await create().expect(201);
    const attempt = attempts.get(created.body.id)!; attempt.Status = 'CONFIRMED';
    await api('post', `/${attempt.OrderId}/refresh`).expect(200);
    const refund = { idempotencyKey: randomUUID(), amountMinor: 3000, reason: 'Согласованный частичный возврат' };
    await api('post', `/${attempt.OrderId}/refund`).send(refund).expect(403);
    const count = methods.filter(method => method === 'Cancel').length;
    const result = await api('post', `/${attempt.OrderId}/refund`, 'owner').send(refund).expect(200);
    expect(result.body.state).toBe('succeeded');
    await api('post', `/${attempt.OrderId}/refund`, 'owner').send(refund).expect(200).expect(({ body }) => expect(body.id).toBe(result.body.id));
    expect(methods.filter(method => method === 'Cancel')).toHaveLength(count + 1);
    await api('post', `/${attempt.OrderId}/refund`, 'owner').send({ ...refund, idempotencyKey: randomUUID(), amountMinor: 10000 }).expect(409);
  });
  it('does not repeat uncertain refunds or allow another refund before reconciliation', async () => {
    const created = await create().expect(201);
    const attempt = attempts.get(created.body.id)!; attempt.Status = 'CONFIRMED';
    await api('post', `/${attempt.OrderId}/refresh`).expect(200);
    cancelTimeout = true;
    const refund = { idempotencyKey: randomUUID(), amountMinor: 1000, reason: 'Тест неопределённого результата' };
    const result = await api('post', `/${attempt.OrderId}/refund`, 'owner').send(refund).expect(200);
    expect(result.body.state).toBe('unknown');
    const count = methods.filter(method => method === 'Cancel').length;
    await api('post', `/${attempt.OrderId}/refund`, 'owner').send(refund).expect(200);
    await api('post', `/${attempt.OrderId}/refund`, 'owner').send({ ...refund, idempotencyKey: randomUUID() }).expect(409);
    expect(methods.filter(method => method === 'Cancel')).toHaveLength(count);
  });
  it('retains the five-per-minute payment initialization rate limit', async () => {
    const key = randomUUID();
    for (let index = 0; index < 5; index++) await create(key).expect(201);
    await create(key).expect(429);
  });
});
