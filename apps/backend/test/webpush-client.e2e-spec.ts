import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateVAPIDKeys } from 'web-push';
import * as request from 'supertest';
import { createCurationFixture } from './curation.fixture';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { DeviceToken } from '../src/notifications/entities/device-token.entity';
import { NotificationDelivery } from '../src/notifications/entities/notification-delivery.entity';
import { NotificationDeliveryService } from '../src/notifications/delivery/notification-delivery.service';
import { NotificationProviders } from '../src/notifications/delivery/push-providers';
import { WEBPUSH_CONSENT_VERSION } from '../src/notifications/webpush-policy';
import { WebPushConsent1700000000043 } from '../src/migrations/1700000000043-WebPushConsent';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';

const suite = process.env.WEBPUSH_TEST_DATABASE_URL ? describe : describe.skip;
suite('WebPush client contract: real JWT/HTTP/PostgreSQL, no outbound provider', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>, config: ConfigService, delivery: NotificationDeliveryService, tenant: TenantContext;
  let send: jest.SpyInstance, configSpy: jest.SpyInstance;
  const keys = generateVAPIDKeys(), tokens: Record<string, string> = {}, overrides = new Map<string, unknown>();
  const originalFetch = global.fetch;
  const http = () => request(f.app.getHttpServer());
  const get = (actor = 'student') => http().get('/api/v1/devices/webpush').auth(tokens[actor], { type: 'bearer' });
  const post = (token: string, actor = 'student', extra: object = {}) => http().post('/api/v1/devices/webpush').auth(tokens[actor], { type: 'bearer' }).send({ token, confirmed: true, version: WEBPUSH_CONSENT_VERSION, ...extra });
  const revoke = (token: string, actor = 'student') => http().delete('/api/v1/devices/webpush').auth(tokens[actor], { type: 'bearer' }).send({ token });
  const subscription = (endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`) => {
    const key = createECDH('prime256v1'); key.generateKeys();
    return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh: key.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } });
  };
  const first = subscription(), second = subscription(), peer = subscription();
  const login = async (actor: string) => { tokens[actor] = (await http().post('/api/v1/auth/login').send({ email: f.users[actor].email, password: f.password }).expect(200)).body.accessToken; };
  async function notification() {
    return tenant.runInRequest(() => { tenant.setUser(f.users.student); return delivery.persist({ userId: f.users.student.id, universityId: f.uni.id,
      eventId: randomUUID(), type: 'system', title: 'PRIVATE_FIXTURE_TITLE', body: 'PRIVATE_FIXTURE_BODY', deepLink: '/student/notifications' }); });
  }
  beforeAll(async () => {
    f = await createCurationFixture(process.env.WEBPUSH_TEST_DATABASE_URL!);
    await f.db.query('ALTER TABLE device_tokens DROP COLUMN "webPushConsentedAt", DROP COLUMN "webPushConsentVersion", DROP COLUMN "webPushRevokedAt"');
    const runner = f.db.createQueryRunner();
    try { await new WebPushConsent1700000000043().up(runner); } finally { await runner.release(); }
    config = f.app.get(ConfigService); const getConfig = config.get.bind(config);
    configSpy = jest.spyOn(config, 'get').mockImplementation(((key: string, ...args: unknown[]) => overrides.has(key) ? overrides.get(key) : getConfig(key, ...args)) as typeof config.get);
    overrides.set('NOTIFICATIONS_QUEUE_ENABLED', 'false'); overrides.set('NOTIFICATIONS_DELIVERY_ENABLED', 'false');
    overrides.set('PUSH_PROVIDER', 'disabled'); overrides.set('WEBPUSH_VAPID_PUBLIC_KEY', keys.publicKey); overrides.set('WEBPUSH_VAPID_PRIVATE_KEY', keys.privateKey); overrides.set('WEBPUSH_VAPID_SUBJECT', 'mailto:push@example.test');
    delivery = f.app.get(NotificationDeliveryService); tenant = f.app.get(TenantContext);
    send = jest.spyOn(f.app.get(NotificationProviders), 'send').mockResolvedValue(undefined);
    global.fetch = jest.fn(async () => { throw new Error('Outbound HTTP forbidden in WebPush fixture'); });
    for (const actor of ['student','peer','outsider']) await login(actor);
  }, 90000);
  afterAll(async () => { global.fetch = originalFetch; send?.mockRestore(); configSpy?.mockRestore(); await f?.app.close(); }, 30000);
  it('requires JWT, publishes no secret configuration and stays disabled without the selected provider', async () => {
    await http().get('/api/v1/devices/webpush').expect(401);
    const status = await get().expect(200);
    expect(status.body).toMatchObject({ accountId: f.users.student.id, available: false, publicKey: null, deliveryEnabled: false, registeredEndpoints: [] });
    expect(status.text).not.toContain(keys.privateKey);
    await post(first).expect(503);
    overrides.set('PUSH_PROVIDER', 'webpush');
    const ready = await get().expect(200);
    expect(ready.body).toMatchObject({ available: true, publicKey: keys.publicKey, deliveryEnabled: false });
    expect(ready.text).not.toContain(keys.privateKey);
  });
  it('rejects missing/old consent, foreign account selectors and unapproved endpoints', async () => {
    await post(first, 'student', { confirmed: false }).expect(400);
    await post(first, 'student', { version: 'old' }).expect(400);
    await post(first, 'student', { userId: f.users.peer.id }).expect(400);
    await post(subscription('https://fcm.googleapis.com.attacker.test/send')).expect(400);
    expect(await f.db.getRepository(DeviceToken).count()).toBe(0);
  });
  it('serializes simultaneous registration and preserves endpoint ownership despite JSON ordering', async () => {
    const [a, b] = await Promise.all([post(first).expect(201), post(first).expect(201)]);
    expect(a.body.endpointHash).toBe(b.body.endpointHash);
    expect(await f.db.getRepository(DeviceToken).countBy({ userId: f.users.student.id })).toBe(1);
    const parsed = JSON.parse(first), reordered = JSON.stringify({ keys: { auth: parsed.keys.auth, p256dh: parsed.keys.p256dh }, endpoint: parsed.endpoint });
    await post(reordered).expect(201);
    await post(reordered, 'peer').expect(403); await post(reordered, 'outsider').expect(403);
    await revoke(reordered, 'peer').expect(403); await revoke(reordered, 'outsider').expect(403);
    const status = await get().expect(200);
    expect(status.body.registeredEndpoints).toEqual([a.body.endpointHash]);
    expect(status.text).not.toContain(parsed.endpoint);
    await post(peer, 'peer').expect(201);
    expect((await get('peer').expect(200)).body.registeredEndpoints).not.toContain(a.body.endpointHash);
  });
  it('exports own opt-in dates and version without subscription keys or another account data', async () => {
    const result = await http().get('/api/v1/users/me/export').auth(tokens.student, { type: 'bearer' }).expect(200);
    const [device] = result.body.datasets.device_tokens;
    expect(device.webPushConsentedAt).toBeTruthy(); expect(device.webPushConsentVersion).toBe(WEBPUSH_CONSENT_VERSION); expect(device.webPushRevokedAt).toBeNull();
    expect(result.text).not.toContain(JSON.parse(first).endpoint); expect(result.text).not.toContain(JSON.parse(first).keys.auth); expect(result.text).not.toContain(keys.privateKey);
  });
  it('keeps old unconsented WebPush tokens inert while preserving the legacy registration contract', async () => {
    await http().post('/api/v1/devices/token').auth(tokens.student, { type: 'bearer' }).send({ token: second, platform: 'web', provider: 'webpush' }).expect(201);
    overrides.set('NOTIFICATIONS_DELIVERY_ENABLED', 'true');
    const saved = await notification();
    const rows = await f.db.getRepository(NotificationDelivery).findBy({ notificationId: saved.id });
    expect(rows).toHaveLength(1);
    const firstDevice = await f.db.getRepository(DeviceToken).findOneByOrFail({ userId: f.users.student.id, webPushConsentVersion: WEBPUSH_CONSENT_VERSION });
    expect(rows[0].targetId).toBe(firstDevice.id);
    await delivery.process({ data: { deliveryId: rows[0].id, universityId: f.uni.id }, attemptsMade: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect((await f.db.getRepository(NotificationDelivery).findOneByOrFail({ id: rows[0].id })).status).toBe('delivered');
  });
  it('rejects an already authenticated registration that resumes after session invalidation committed', async () => {
    const runner = f.db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
    let pending: Promise<request.Response> | undefined;
    try {
      await runner.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [f.users.student.id]);
      pending = post(subscription()).then(response => response);
      const deadline = Date.now() + 3000;
      let waiting = false;
      while (Date.now() < deadline) {
        const [state] = await f.db.query("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FOR SHARE%') AS waiting");
        if (state.waiting) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true); // Prove the service reached the real locked revalidation.
      await runner.query('UPDATE users SET "sessionVersion"="sessionVersion"+1 WHERE id=$1', [f.users.student.id]);
      await runner.query('UPDATE device_tokens SET "isActive"=false,"webPushRevokedAt"=now() WHERE "userId"=$1 AND provider=$2', [f.users.student.id, 'webpush']);
      await runner.commitTransaction();
      expect((await pending).status).toBe(401);
    } finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); await pending?.catch(() => undefined); }
    expect(await f.db.getRepository(DeviceToken).countBy({ userId: f.users.student.id })).toBe(2);
    await login('student'); f.users.student.sessionVersion++;
    await post(first).expect(201);
  });
  it('rechecks consent before a pending job and never sends after revocation, even if a legacy call reactivates the row', async () => {
    const saved = await notification(), [row] = await f.db.getRepository(NotificationDelivery).findBy({ notificationId: saved.id });
    await revoke(first).expect(200); await revoke(first).expect(200);
    await http().post('/api/v1/devices/token').auth(tokens.student, { type: 'bearer' }).send({ token: (await f.db.getRepository(DeviceToken).findOneByOrFail({ id: row.targetId })).token, platform: 'web', provider: 'webpush' }).expect(201);
    expect((await f.db.getRepository(DeviceToken).findOneByOrFail({ id: row.targetId })).isActive).toBe(true);
    await expect(delivery.process({ data: { deliveryId: row.id, universityId: f.uni.id }, attemptsMade: 0 })).rejects.toThrow('target_revoked');
    expect(send).toHaveBeenCalledTimes(1);
    expect((await get().expect(200)).body.registeredEndpoints).toEqual([]);
    expect((await f.db.getRepository(DeviceToken).findOneByOrFail({ id: row.targetId })).webPushRevokedAt).toBeTruthy();
  });
  it('allows career accounts to configure only their own WebPush without opening academic/device-token routes', async () => {
    await f.db.getRepository(User).update(f.users.peer.id, { role: UserRole.EMPLOYER, universityId: null }); await login('peer');
    await get('peer').expect(200); await post(peer, 'peer').expect(201);
    await http().get('/api/v1/schedule').auth(tokens.peer, { type: 'bearer' }).expect(403);
    await http().post('/api/v1/devices/token').auth(tokens.peer, { type: 'bearer' }).send({ token: 'opaque-token', platform: 'web' }).expect(403);
  });
  it('atomically invalidates sessions and revokes all own WebPush devices on logout while preserving peers and other providers', async () => {
    await post(first).expect(201); await post(second).expect(201);
    await http().post('/api/v1/devices/token').auth(tokens.student, { type: 'bearer' }).send({ token: 'legacy-device-fixture', platform: 'ios' }).expect(201);
    await f.db.query(`ALTER TABLE device_tokens ADD CONSTRAINT synthetic_revoke_reject CHECK (NOT ("userId"='${f.users.student.id}' AND provider='webpush' AND "isActive"=false))`);
    try {
      await http().post('/api/v1/auth/logout').auth(tokens.student, { type: 'bearer' }).expect(500);
      await get().expect(200); // Session invalidation rolls back if subscription revocation fails.
    } finally { await f.db.query('ALTER TABLE device_tokens DROP CONSTRAINT synthetic_revoke_reject'); }
    await http().post('/api/v1/auth/logout').auth(tokens.student, { type: 'bearer' }).expect(200);
    await get().expect(401);
    const own = await f.db.getRepository(DeviceToken).findBy({ userId: f.users.student.id, provider: 'webpush' });
    expect(own).toHaveLength(2); expect(own.every(row => !row.isActive && !!row.webPushRevokedAt)).toBe(true);
    expect((await f.db.getRepository(DeviceToken).findOneByOrFail({ token: 'legacy-device-fixture' })).isActive).toBe(true);
    expect((await f.db.getRepository(DeviceToken).findOneByOrFail({ userId: f.users.peer.id })).isActive).toBe(true);
    await login('student'); expect((await get().expect(200)).body.registeredEndpoints).toEqual([]);
  });
  it('does not restore revoked consent when a legacy registration saved an entity read before real logout', async () => {
    await post(first).expect(201);
    const stored = await f.db.getRepository(DeviceToken).findOneByOrFail({ userId: f.users.student.id, webPushConsentVersion: WEBPUSH_CONSENT_VERSION, isActive: true });
    const repository = f.app.get<Repository<DeviceToken>>(getRepositoryToken(DeviceToken)), original = repository.findOne.bind(repository);
    let release!: () => void, ready!: () => void, paused = false;
    const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { ready = resolve; });
    const lookup = jest.spyOn(repository, 'findOne').mockImplementation(async options => {
      const row = await original(options);
      if (!paused && (options.where as { token?: string })?.token === stored.token) { paused = true; ready(); await held; }
      return row;
    });
    const pending = http().post('/api/v1/devices/token').auth(tokens.student, { type: 'bearer' }).send({ token: stored.token, platform: 'web', provider: 'webpush' }).then(response => response);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([reached, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Legacy token lookup did not pause')), 3000); })]);
      await http().post('/api/v1/auth/logout').auth(tokens.student, { type: 'bearer' }).expect(200);
      release(); expect((await pending).status).toBe(201);
    } finally { if (timer) clearTimeout(timer); release(); await pending; lookup.mockRestore(); }
    const row = await f.db.getRepository(DeviceToken).findOneByOrFail({ id: stored.id });
    expect(row.isActive).toBe(true); expect(row.webPushRevokedAt).toBeTruthy();
    await login('student'); expect((await get().expect(200)).body.registeredEndpoints).toEqual([]);
  });
  it('physically removes own subscription and consent data on account deletion without removing a peer device', async () => {
    await post(first).expect(201);
    await http().delete('/api/v1/users/me').auth(tokens.student, { type: 'bearer' }).send({ expectedUserId: f.users.student.id, currentPassword: f.password, confirmed: true, acknowledgeRetention: true }).expect(200);
    expect(await f.db.getRepository(DeviceToken).countBy({ userId: f.users.student.id })).toBe(0);
    expect(await f.db.getRepository(DeviceToken).countBy({ userId: f.users.peer.id })).toBe(1);
    await get().expect(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
