import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { TenantContext } from '../common/tenant/tenant-context';
import { AuditLog } from '../common/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DeviceToken } from './entities/device-token.entity';
import { validateDeviceToken } from './delivery/push-providers';
import { WebPushConsentDto } from './dto/webpush-consent.dto';
import { hasWebPushConsent, WEBPUSH_CONSENT_VERSION, webPushConfiguration } from './webpush-policy';

const fingerprint = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');
@Injectable()
export class WebPushClientService {
  constructor(private readonly db: DataSource, private readonly tenant: TenantContext, private readonly config: ConfigService) {}
  private actor() {
    const actor = this.tenant.getUser();
    if (!actor) throw new ForbiddenException('Требуется вход.');
    return actor;
  }
  private async lockActor(manager: EntityManager, actor: AuthenticatedUser) {
    const user = await manager.findOne(User, { where: { id: actor.id }, lock: { mode: 'pessimistic_read' } });
    if (!user || !user.isActive || user.personalDataDeletedAt || user.sessionVersion !== actor.sessionVersion || user.role !== actor.role || user.universityId !== actor.universityId) throw new UnauthorizedException('Сессия изменилась. Войдите заново.');
  }
  async status() {
    const actor = this.actor();
    const devices = await this.db.manager.findBy(DeviceToken, { userId: actor.id, provider: 'webpush', isActive: true });
    const endpoints = devices.filter(hasWebPushConsent).flatMap(device => {
      try { return [fingerprint(JSON.parse(device.token).endpoint)]; } catch { return []; }
    });
    return { ...webPushConfiguration(this.config), accountId: actor.id, registeredEndpoints: [...new Set(endpoints)] };
  }
  async register(dto: WebPushConsentDto) {
    const actor = this.actor();
    if (!dto.confirmed || dto.version !== WEBPUSH_CONSENT_VERSION) throw new ForbiddenException('Нужно подтвердить текущее разрешение на уведомления.');
    if (!webPushConfiguration(this.config).available) throw new ServiceUnavailableException('WebPush пока не настроен оператором.');
    validateDeviceToken(dto.token, 'web', 'webpush', this.config);
    const subscription = JSON.parse(dto.token);
    const endpoint = new URL(subscription.endpoint).toString();
    const token = JSON.stringify({ endpoint, expirationTime: typeof subscription.expirationTime === 'number' && Number.isFinite(subscription.expirationTime) ? subscription.expirationTime : null,
      keys: { p256dh: Buffer.from(subscription.keys.p256dh, 'base64url').toString('base64url'), auth: Buffer.from(subscription.keys.auth, 'base64url').toString('base64url') } });
    validateDeviceToken(token, 'web', 'webpush', this.config);
    return this.db.transaction(async manager => {
      await this.lockActor(manager, actor);
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`webpush:${fingerprint(endpoint)}`]);
      // The old API accepts opaque tokens. CASE prevents parsing unrelated legacy tokens.
      const existing = await manager.getRepository(DeviceToken).createQueryBuilder('device')
        .where("device.token = :token OR (CASE WHEN device.provider = 'webpush' THEN device.token::jsonb->>'endpoint' ELSE NULL END) = :endpoint", { token, endpoint })
        .orderBy('device.createdAt', 'ASC').addOrderBy('device.id', 'ASC').getMany();
      if (existing.some(device => device.userId !== actor.id)) throw new ForbiddenException('Подписка уже связана с другим аккаунтом. Отключите её в браузере перед новым подключением.');
      const row = existing.find(device => device.token === token) || existing[0] || manager.create(DeviceToken, { userId: actor.id });
      Object.assign(row, { token, platform: 'web', provider: 'webpush', deviceName: 'Браузер WebPush', isActive: true,
        webPushConsentedAt: new Date(), webPushConsentVersion: WEBPUSH_CONSENT_VERSION, webPushRevokedAt: null });
      const saved = await manager.save(DeviceToken, row);
      const duplicates = existing.filter(device => device.id !== saved.id).map(device => device.id);
      if (duplicates.length) await manager.update(DeviceToken, { id: In(duplicates), userId: actor.id }, { isActive: false, webPushRevokedAt: new Date() });
      await manager.save(AuditLog, manager.create(AuditLog, { userId: actor.id, action: 'webpush.consent.confirmed', entity: 'device', entityId: saved.id,
        newValues: { version: WEBPUSH_CONSENT_VERSION } }));
      return { registered: true, endpointHash: fingerprint(endpoint), consentVersion: WEBPUSH_CONSENT_VERSION };
    });
  }
  async revoke(token: string) {
    const actor = this.actor();
    validateDeviceToken(token, 'web', 'webpush', this.config);
    const endpoint = new URL(JSON.parse(token).endpoint).toString();
    return this.db.transaction(async manager => {
      await this.lockActor(manager, actor);
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`webpush:${fingerprint(endpoint)}`]);
      const rows = await manager.getRepository(DeviceToken).createQueryBuilder('device')
        .where("device.provider = 'webpush' AND (CASE WHEN device.provider = 'webpush' THEN device.token::jsonb->>'endpoint' ELSE NULL END) = :endpoint", { endpoint }).getMany();
      if (rows.some(row => row.userId !== actor.id)) throw new ForbiddenException('Подписка принадлежит другому аккаунту.');
      if (rows.length) {
        await manager.update(DeviceToken, { id: In(rows.map(row => row.id)), userId: actor.id }, { isActive: false, webPushRevokedAt: new Date() });
        await manager.save(AuditLog, manager.create(AuditLog, { userId: actor.id, action: 'webpush.consent.revoked', entity: 'device', entityId: rows[0].id, newValues: { version: WEBPUSH_CONSENT_VERSION } }));
      }
      return { revoked: true };
    });
  }
}
