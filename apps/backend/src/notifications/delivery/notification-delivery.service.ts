import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { Queue, Worker, Job, UnrecoverableError } from 'bullmq';
import Redis from 'ioredis';
import { TenantContext } from '../../common/tenant/tenant-context';
import { Notification } from '../entities/notification.entity';
import { NotificationDelivery, DeliveryStatus } from '../entities/notification-delivery.entity';
import { DeviceToken } from '../entities/device-token.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { User } from '../../users/entities/user.entity';
import { NotificationProviders, DeliveryError, DeliveryChannel } from './push-providers';
import { deliveryEnabled, queueEnabled } from './delivery-config';

const TABLES = ['notification_deliveries', 'notifications', 'device_tokens', 'notification_preferences', 'users'];
const ATTEMPTS = 5;
export const NOTIFICATION_QUEUE = 'notification-delivery';
export interface DeliveryJob { deliveryId: string; universityId: string }

@Injectable()
export class NotificationDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private queue?: Queue<DeliveryJob>;
  private worker?: Worker<DeliveryJob>;
  private redis?: Redis;
  private workerRedis?: Redis;
  private timer?: ReturnType<typeof setInterval>;
  private dispatching = false;

  constructor(private readonly db: DataSource, private readonly config: ConfigService,
    private readonly providers: NotificationProviders, private readonly tenant: TenantContext) {}

  isConfigured(): boolean { return queueEnabled(this.config); }

  async check(): Promise<void> {
    if (!this.isConfigured()) return;
    if (!this.redis || await this.redis.ping() !== 'PONG') throw new Error('Notification queue unavailable');
  }

  onModuleInit(): void {
    if (!this.isConfigured()) return;
    const url = this.config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379');
    if (!['redis:', 'rediss:'].includes(new URL(url).protocol)) throw new Error('Invalid Redis protocol');
    const prefix = this.config.get<string>('NOTIFICATIONS_QUEUE_PREFIX', 'napare');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(prefix)) throw new Error('Invalid notification queue prefix');
    this.redis = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 3000 });
    this.redis.on('error', () => this.logger.warn('Notification Redis connection unavailable'));
    this.workerRedis = this.redis.duplicate({ maxRetriesPerRequest: null, enableOfflineQueue: true });
    this.workerRedis.on('error', () => this.logger.warn('Notification worker Redis unavailable'));
    this.queue = new Queue<DeliveryJob>(NOTIFICATION_QUEUE, { connection: this.redis, prefix,
      defaultJobOptions: { attempts: ATTEMPTS, backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 604800, count: 1000 }, removeOnFail: { age: 2592000, count: 1000 } } });
    this.queue.on('error', () => this.logger.warn('Notification queue operation unavailable'));
    this.worker = new Worker<DeliveryJob>(NOTIFICATION_QUEUE, job => this.process(job), {
      connection: this.workerRedis, prefix, concurrency: 5, lockDuration: 30000,
    });
    this.worker.on('error', () => this.logger.warn('Notification worker operation unavailable'));
    this.timer = setInterval(() => void this.dispatch().catch(() => this.logger.warn('Notification outbox dispatch postponed')), 10000);
    this.timer.unref();
    void this.dispatch().catch(() => this.logger.warn('Notification outbox dispatch postponed'));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
    this.redis?.disconnect();
    this.workerRedis?.disconnect();
  }

  private scoped<T>(universityIds: string[] | null, tables: string[], write: boolean, callback: (manager: EntityManager) => Promise<T>): Promise<T> {
    const execute = () => this.tenant.runWithDatabaseAccess({ tables, universityIds, write, replaceActor: true },
      () => this.db.transaction(callback));
    // Private-row writes check the recipient tombstone. Allow that SELECT in
    // the same tenant without granting mutations of user records.
    return write && !tables.includes('users')
      ? this.tenant.runWithDatabaseAccess({ tables: ['users'], universityIds, write: false, replaceActor: true }, execute)
      : execute();
  }

  async persist(dto: Partial<Notification>): Promise<Notification> {
    if (!dto.universityId || !dto.userId) throw new Error('Notification tenant and recipient required');
    this.tenant.assertAccess(dto.universityId);
    return this.scoped([dto.universityId], TABLES, true, async manager => {
      const user = await manager.findOne(User, { where: { id: dto.userId, universityId: dto.universityId, isActive: true } });
      if (!user) throw new Error('Notification recipient is outside tenant or inactive');
      if (dto.eventId) {
        // Serialize concurrent handlers of the same event before reading the unique key.
        await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`notification:${dto.eventId}:${dto.userId}`]);
        const existing = await manager.findOne(Notification, { where: { eventId: dto.eventId, userId: dto.userId, universityId: dto.universityId } });
        if (existing) return existing;
      }
      const notification = await manager.save(Notification, manager.create(Notification, dto));
      const devices = await manager.find(DeviceToken, { where: { userId: user.id, isActive: true } });
      const preferences = await manager.findOne(NotificationPreference, { where: { userId: user.id, universityId: dto.universityId } });
      const targets: Array<{ channel: DeliveryChannel; targetId: string }> = devices
        .filter(device => device.provider === 'webpush' || device.provider === 'rustore')
        .map(device => ({ channel: device.provider as DeliveryChannel, targetId: device.id }));
      if (preferences?.telegramEnabled && user.telegramUserId) targets.push({ channel: 'telegram', targetId: user.id });
      if (user.maxUserId && this.providers.supports('max')) targets.push({ channel: 'max', targetId: user.id });
      for (const target of targets) {
        const enabled = deliveryEnabled(this.config) && this.providers.supports(target.channel);
        const status = enabled ? 'pending' : 'suppressed';
        await manager.save(NotificationDelivery, manager.create(NotificationDelivery, {
          notificationId: notification.id, userId: user.id, universityId: dto.universityId, ...target,
          status, lastError: enabled ? null : 'delivery_disabled', attempts: 0,
          history: [{ at: new Date().toISOString(), status, attempt: 0 }],
        }));
      }
      return notification;
    });
  }

  async dispatch(): Promise<void> {
    if (!this.queue || this.dispatching) return;
    this.dispatching = true;
    try {
      // Polling reads only delivery IDs and explicit tenant IDs; payload/tokens stay in PostgreSQL.
      const rows: DeliveryJob[] = await this.scoped(null, ['notification_deliveries'], false, manager => manager.query(
        `SELECT id AS "deliveryId", "universityId" FROM notification_deliveries
         WHERE status = 'pending' OR (status IN ('queued','sending') AND "updatedAt" < now() - interval '60 seconds')
         ORDER BY "updatedAt" LIMIT 100`));
      for (const row of rows) {
        const existing = await this.queue.getJob(row.deliveryId);
        if (existing) {
          if (await existing.getState() === 'failed') await this.transition(row, 'dead', 'queue_attempts_exhausted');
          continue;
        }
        await this.queue.add('deliver', row, { jobId: row.deliveryId });
        await this.scoped([row.universityId], ['notification_deliveries'], true, manager => manager.query(
          `UPDATE notification_deliveries SET status='queued', "updatedAt"=now() WHERE id=$1 AND "universityId"=$2 AND status='pending'`, [row.deliveryId, row.universityId]));
      }
    } finally { this.dispatching = false; }
  }

  async transition(data: DeliveryJob, status: DeliveryStatus, error?: string, increment = false, revokeDevice = false): Promise<NotificationDelivery | null> {
    return this.scoped([data.universityId], revokeDevice ? ['notification_deliveries', 'device_tokens'] : ['notification_deliveries'], true, async manager => {
      const row = await manager.findOne(NotificationDelivery, { where: { id: data.deliveryId, universityId: data.universityId }, lock: { mode: 'pessimistic_write' } });
      if (!row || ['delivered', 'dead', 'suppressed'].includes(row.status)) return null;
      // A terminal rejection and device revocation must become visible together.
      // Otherwise a crash after saving "dead" leaves a rejected token active forever.
      if (revokeDevice && ['webpush', 'rustore'].includes(row.channel)) {
        await manager.update(DeviceToken, { id: row.targetId, userId: row.userId }, { isActive: false });
      }
      if (increment && row.attempts >= ATTEMPTS) {
        status = 'dead';
        error = 'queue_attempts_exhausted';
        increment = false;
      }
      row.status = status;
      row.lastError = error || null;
      if (increment) row.attempts++;
      row.history = [...row.history.slice(-19), { at: new Date().toISOString(), status, attempt: row.attempts, ...(error ? { error } : {}) }];
      return manager.save(NotificationDelivery, row);
    });
  }

  async process(job: Pick<Job<DeliveryJob>, 'data' | 'attemptsMade'>): Promise<void> {
    const data = job.data;
    const current = await this.transition(data, 'sending', undefined, true);
    if (!current) return; // Completed/terminal jobs are idempotent even if re-enqueued.
    if (current.status === 'dead') throw new UnrecoverableError('queue_attempts_exhausted');
    if (!deliveryEnabled(this.config)) { await this.transition(data, 'suppressed', 'delivery_disabled'); return; }
    try {
      const resolved = await this.scoped([data.universityId], TABLES, false, async manager => {
        const notification = await manager.findOne(Notification, { where: { id: current.notificationId, universityId: data.universityId, userId: current.userId } });
        const user = await manager.findOne(User, { where: { id: current.userId, universityId: data.universityId, isActive: true } });
        if (!notification || !user) throw new DeliveryError('recipient_unavailable', true);
        if (Date.now() - notification.createdAt.getTime() > 86400000) throw new DeliveryError('notification_expired', true);
        const preference = await manager.findOne(NotificationPreference, { where: { userId: user.id, universityId: data.universityId } });
        let token: string | null | undefined;
        if (current.channel === 'telegram') token = preference?.telegramEnabled ? user.telegramUserId : null;
        else if (current.channel === 'max') token = user.maxUserId;
        else {
          const device = await manager.findOne(DeviceToken, { where: { id: current.targetId, userId: user.id, provider: current.channel, isActive: true } });
          token = device?.token;
        }
        if (!token) throw new DeliveryError('target_revoked', true);
        return { token, notification };
      });
      await this.providers.get(current.channel).send({ token: resolved.token }, {
        id: current.id, title: resolved.notification.title, body: resolved.notification.body, deepLink: resolved.notification.deepLink,
      });
      await this.transition(data, 'delivered');
    } catch (error) {
      const failure = error instanceof DeliveryError ? error : new DeliveryError('delivery_internal');
      const dead = failure.permanent || current.attempts >= ATTEMPTS || job.attemptsMade + 1 >= ATTEMPTS;
      await this.transition(data, dead ? 'dead' : 'queued', failure.code, false, failure.revokeDevice);
      if (dead) throw new UnrecoverableError(failure.code);
      throw failure;
    }
  }
}
