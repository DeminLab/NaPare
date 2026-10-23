import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as request from 'supertest';
import { createCurationFixture } from './curation.fixture';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { NotificationDeliveryService, NOTIFICATION_QUEUE } from '../src/notifications/delivery/notification-delivery.service';
import { NotificationProviders, DeliveryError } from '../src/notifications/delivery/push-providers';
import { NotificationDelivery } from '../src/notifications/entities/notification-delivery.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { DeviceToken } from '../src/notifications/entities/device-token.entity';
import { NotificationDelivery1700000000034 } from '../src/migrations/1700000000034-NotificationDelivery';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from '../src/migrations/1700000000038-AccountErasure';

const databaseUrl = process.env.NOTIFICATION_TEST_DATABASE_URL;
const redisUrl = process.env.NOTIFICATION_TEST_REDIS_URL;
const integration = databaseUrl && redisUrl ? describe : describe.skip;
jest.setTimeout(90000);

integration('Notification delivery with real PostgreSQL RLS and Redis/BullMQ', () => {
  let fixture: Awaited<ReturnType<typeof createCurationFixture>>;
  let service: NotificationDeliveryService;
  let config: ConfigService;
  let tenant: TenantContext;
  let providerSend: jest.SpyInstance;
  let queue: Queue;
  let redis: Redis;
  const prefix = `notification_test_${randomUUID().replace(/-/g, '')}`;
  const originalFetch = global.fetch;
  const noOutbound = jest.fn(async () => { throw new Error('External HTTP forbidden in integration test'); });
  const overrides = new Map<string, unknown>();
  const configure = (key: string, value: unknown) => overrides.set(key, value);

  async function asUser<T>(key: 'student' | 'outsider', callback: () => Promise<T>): Promise<T> {
    return tenant.runInRequest(() => { tenant.setUser(fixture.users[key]); return callback(); });
  }
  async function create(eventId = randomUUID()) {
    return asUser('student', () => service.persist({ universityId: fixture.uni.id, userId: fixture.users.student.id,
      title: 'Synthetic notification', body: 'Runtime proof only', eventId }));
  }
  async function deliveries(id: string) { return fixture.db.getRepository(NotificationDelivery).find({ where: { notificationId: id } }); }
  async function awaitStatus(id: string, status: string) {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const rows = await deliveries(id);
      if (rows.length && rows.every(row => row.status === status)) return rows;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Delivery did not reach ${status}: ${JSON.stringify(await deliveries(id))}`);
  }

  beforeAll(async () => {
    process.env.NOTIFICATIONS_QUEUE_ENABLED = 'false';
    process.env.NOTIFICATIONS_DELIVERY_ENABLED = 'false';
    global.fetch = noOutbound as typeof fetch;
    fixture = await createCurationFixture(databaseUrl!);
    service = fixture.app.get(NotificationDeliveryService);
    config = fixture.app.get(ConfigService);
    const get = config.get.bind(config);
    jest.spyOn(config, 'get').mockImplementation(((key: string, ...args: unknown[]) => overrides.has(key) ? overrides.get(key) : get(key, ...args)) as typeof config.get);
    tenant = fixture.app.get(TenantContext);
    const db = fixture.app.get(DataSource);
    const [role] = await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    // Execute migration 34 against the synchronized disposable schema, not a mock runner.
    await fixture.db.query('DROP TABLE notification_deliveries');
    await fixture.db.query('ALTER TABLE device_tokens DROP COLUMN provider');
    const runner = fixture.db.createQueryRunner();
    try {
      await new NotificationDelivery1700000000034().up(runner);
      await new PersonalDataRead1700000000037().up(runner);
      await new AccountErasure1700000000038().up(runner);
    } finally { await runner.release(); }
    const [security] = await db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='notification_deliveries'");
    expect(security).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    configure('PUSH_PROVIDER', 'rustore');
    configure('NOTIFICATIONS_QUEUE_PREFIX', prefix);
    configure('REDIS_URL', redisUrl);
    providerSend = jest.spyOn(fixture.app.get(NotificationProviders), 'send').mockResolvedValue(undefined);
    redis = new Redis(redisUrl!, { maxRetriesPerRequest: 1 });
    queue = new Queue(NOTIFICATION_QUEUE, { prefix, connection: redis });
    await fixture.db.getRepository(DeviceToken).save({ userId: fixture.users.student.id, token: 'synthetic-rustore-token', provider: 'rustore', platform: 'android' });
  }, 90000);

  afterAll(async () => {
    await fixture?.app.close();
    if (queue) { await queue.obliterate({ force: true }); await queue.close(); }
    redis?.disconnect();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    delete process.env.NOTIFICATIONS_QUEUE_ENABLED;
    delete process.env.NOTIFICATIONS_DELIVERY_ENABLED;
  });

  it('persists a suppressed audit row with default flags and never contacts a provider', async () => {
    const notification = await create();
    expect((await deliveries(notification.id))[0]).toMatchObject({ status: 'suppressed', lastError: 'delivery_disabled', attempts: 0 });
    expect(providerSend).not.toHaveBeenCalled();
    expect(noOutbound).not.toHaveBeenCalled();
    const health = await request(fixture.app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(health.body.queue).toBe('not_configured');
  });

  it('uses actual JWT HTTP registration and rejects another user claiming an existing token', async () => {
    const server = fixture.app.getHttpServer();
    const login = await request(server).post('/api/v1/auth/login').send({ email: fixture.users.student.email, password: fixture.password }).expect(200);
    const token = login.body.accessToken;
    expect(token).toBeTruthy();
    await request(server).post('/api/v1/devices/token').set('Authorization', `Bearer ${token}`)
      .send({ token: 'synthetic-second-token', platform: 'android', provider: 'rustore' }).expect(201);
    const otherLogin = await request(server).post('/api/v1/auth/login').send({ email: fixture.users.outsider.email, password: fixture.password }).expect(200);
    await request(server).post('/api/v1/devices/token').set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .send({ token: 'synthetic-second-token', platform: 'android', provider: 'rustore' }).expect(403);
    await fixture.db.getRepository(DeviceToken).delete({ token: 'synthetic-second-token' });
  });

  it('rolls back the notification if outbox persistence fails', async () => {
    const eventId = randomUUID();
    await fixture.db.query(`ALTER TABLE notification_deliveries ADD CONSTRAINT synthetic_reject CHECK (channel <> 'rustore') NOT VALID`);
    try {
      await expect(create(eventId)).rejects.toThrow();
      expect(await fixture.db.getRepository(Notification).count({ where: { eventId } })).toBe(0);
    } finally { await fixture.db.query('ALTER TABLE notification_deliveries DROP CONSTRAINT synthetic_reject'); }
  });

  it('serializes concurrent retries of one event into exactly one notification and target', async () => {
    configure('NOTIFICATIONS_DELIVERY_ENABLED', 'true');
    const eventId = randomUUID();
    const results = await Promise.all([create(eventId), create(eventId), create(eventId)]);
    expect(new Set(results.map(row => row.id)).size).toBe(1);
    expect(await deliveries(results[0].id)).toHaveLength(1);
    expect((await deliveries(results[0].id))[0].status).toBe('pending');
  });

  it('denies foreign tenant creation, read and state mutation under FORCE RLS', async () => {
    const notification = await create();
    await expect(asUser('outsider', () => service.persist({ universityId: fixture.uni.id, userId: fixture.users.student.id, title: 'Forbidden', body: 'Forbidden' }))).rejects.toThrow();
    const db = fixture.app.get(DataSource);
    await asUser('outsider', async () => {
      expect(await db.getRepository(NotificationDelivery).find({ where: { notificationId: notification.id } })).toEqual([]);
      expect((await db.getRepository(NotificationDelivery).update({ notificationId: notification.id }, { status: 'dead' })).affected).toBe(0);
    });
    expect((await deliveries(notification.id))[0].status).toBe('pending');
  });

  it('rolls back device revocation when the terminal delivery write fails', async () => {
    const notification = await create();
    const [row] = await deliveries(notification.id);
    const job = { deliveryId: row.id, universityId: row.universityId };
    await fixture.db.query(`ALTER TABLE notification_deliveries ADD CONSTRAINT synthetic_terminal_reject CHECK (status <> 'dead') NOT VALID`);
    try {
      await expect(service.transition(job, 'dead', 'provider_http_410', false, true)).rejects.toThrow();
      expect((await deliveries(notification.id))[0].status).toBe('pending');
      expect((await fixture.db.getRepository(DeviceToken).findOneByOrFail({ id: row.targetId })).isActive).toBe(true);
    } finally { await fixture.db.query('ALTER TABLE notification_deliveries DROP CONSTRAINT synthetic_terminal_reject'); }
    await service.transition(job, 'dead', 'provider_http_410', false, true);
    expect((await deliveries(notification.id))[0].status).toBe('dead');
    expect((await fixture.db.getRepository(DeviceToken).findOneByOrFail({ id: row.targetId })).isActive).toBe(false);
    await fixture.db.getRepository(DeviceToken).update({ id: row.targetId }, { isActive: true });
  });

  it('recovers durable pending rows through actual BullMQ and terminal duplicate jobs are harmless', async () => {
    configure('NOTIFICATIONS_QUEUE_ENABLED', 'true');
    service.onModuleInit();
    await queue.waitUntilReady();
    await new Promise(resolve => setTimeout(resolve, 100));
    await service.check();
    const health = await request(fixture.app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(health.body.queue).toBe('ok');
    const notification = await create();
    await service.dispatch();
    const [row] = await awaitStatus(notification.id, 'delivered');
    const before = providerSend.mock.calls.length;
    await service.process({ data: { deliveryId: row.id, universityId: row.universityId }, attemptsMade: 0 });
    expect(providerSend.mock.calls.length).toBe(before);
    expect((await deliveries(notification.id))[0].attempts).toBe(1);
    expect((await queue.getJob(row.id))?.data).toEqual({ deliveryId: row.id, universityId: row.universityId });
    expect(noOutbound).not.toHaveBeenCalled();
  });

  it('retries a transient provider failure using Redis backoff and records the attempts', async () => {
    // Drain earlier pending rows before assigning this one-shot provider failure.
    await service.dispatch();
    const notification = await create();
    providerSend.mockRejectedValueOnce(new DeliveryError('provider_http_503'));
    await service.dispatch();
    const [row] = await awaitStatus(notification.id, 'delivered');
    expect(row.attempts).toBe(2);
    expect(row.history.some(item => item.error === 'provider_http_503')).toBe(true);
  });

  it('retains permanent provider rejection as a dead letter and revokes the device', async () => {
    const notification = await create();
    providerSend.mockRejectedValueOnce(new DeliveryError('provider_http_410', true, true));
    await service.dispatch();
    const [row] = await awaitStatus(notification.id, 'dead');
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe('provider_http_410');
    expect((await fixture.db.getRepository(DeviceToken).findOneByOrFail({ id: row.targetId })).isActive).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(await (await queue.getJob(row.id))?.getState()).toBe('failed');
    expect(noOutbound).not.toHaveBeenCalled();
  });

  it('stops after five transient failures and preserves its durable dead letter', async () => {
    await fixture.db.getRepository(DeviceToken).update({ token: 'synthetic-rustore-token' }, { isActive: true });
    const notification = await create();
    providerSend.mockRejectedValue(new DeliveryError('provider_network'));
    try {
      await service.dispatch();
      const [row] = await awaitStatus(notification.id, 'dead');
      expect(row.attempts).toBe(5);
      expect(row.lastError).toBe('provider_network');
      expect(row.history.filter(item => item.status === 'sending')).toHaveLength(5);
      const calls = providerSend.mock.calls.length;
      await service.dispatch();
      await service.process({ data: { deliveryId: row.id, universityId: row.universityId }, attemptsMade: 0 });
      expect(providerSend.mock.calls.length).toBe(calls);
      expect(noOutbound).not.toHaveBeenCalled();
    } finally { providerSend.mockResolvedValue(undefined); }
  });

  it('does not reset the PostgreSQL attempt budget when a Redis job is recreated', async () => {
    configure('NOTIFICATIONS_DELIVERY_ENABLED', 'false');
    const notification = await create();
    const [row] = await deliveries(notification.id);
    await fixture.db.getRepository(NotificationDelivery).update(row.id, { attempts: 5, status: 'queued' });
    configure('NOTIFICATIONS_DELIVERY_ENABLED', 'true');
    const before = providerSend.mock.calls.length;
    await expect(service.process({ data: { deliveryId: row.id, universityId: row.universityId }, attemptsMade: 0 })).rejects.toThrow('queue_attempts_exhausted');
    expect(providerSend.mock.calls.length).toBe(before);
    expect((await deliveries(notification.id))[0]).toMatchObject({ attempts: 5, status: 'dead', lastError: 'queue_attempts_exhausted' });
  });
});
