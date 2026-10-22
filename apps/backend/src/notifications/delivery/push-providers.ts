import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { DevicePlatform } from '../entities/device-token.entity';
import { deliveryEnabled } from './delivery-config';

export const DEVICE_PROVIDERS = ['legacy', 'webpush', 'rustore'] as const;
export type DeviceProvider = typeof DEVICE_PROVIDERS[number];
export type DeliveryChannel = Exclude<DeviceProvider, 'legacy'> | 'telegram' | 'max';
export interface DeliveryPayload { id: string; title: string; body: string; deepLink: string | null }
export interface DeliveryTarget { token: string }
export interface PushProvider {
  channel: DeliveryChannel;
  send(target: DeliveryTarget, payload: DeliveryPayload): Promise<void>;
}

export class DeliveryError extends Error {
  constructor(public readonly code: string, public readonly permanent = false, public readonly revokeDevice = false) {
    super(code);
  }
}

function allowedWebPushHosts(config: ConfigService): string[] {
  return config.get<string>('WEBPUSH_ALLOWED_HOSTS', 'fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com')
    .split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
}

export function validateDeviceToken(token: string, platform: DevicePlatform, provider: DeviceProvider, config: ConfigService): void {
  if (!DEVICE_PROVIDERS.includes(provider) || !token || token.length > 8192 || /[\u0000-\u001f]/.test(token)) throw new BadRequestException('Invalid device token');
  if (provider === 'legacy') return; // Existing opaque tokens stay stored but cannot be delivered.
  if (provider === 'rustore') {
    if (platform !== 'android' || !/^[A-Za-z0-9_.:-]{16,4096}$/.test(token)) throw new BadRequestException('RuStore requires an Android push token');
    return;
  }
  try {
    const subscription = JSON.parse(token) as webPush.PushSubscription;
    const endpoint = new URL(subscription.endpoint);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || (endpoint.port && endpoint.port !== '443')
      || !allowedWebPushHosts(config).includes(endpoint.hostname.toLowerCase())) throw Error();
    const { p256dh, auth } = subscription.keys;
    if (!/^[A-Za-z0-9_-]+={0,2}$/.test(p256dh) || !/^[A-Za-z0-9_-]+={0,2}$/.test(auth)
      || Buffer.from(p256dh, 'base64url').length !== 65 || Buffer.from(p256dh, 'base64url')[0] !== 4
      || Buffer.from(auth, 'base64url').length !== 16) throw Error();
  } catch { throw new BadRequestException('Invalid WebPush subscription or unapproved endpoint'); }
}

function httpFailure(status: number, revoke = false): DeliveryError {
  return new DeliveryError(`provider_http_${status}`, status >= 400 && status < 500 && ![408, 429].includes(status), revoke && [404, 410].includes(status));
}

@Injectable()
export class NotificationProviders {
  constructor(private readonly config: ConfigService) {}

  get(channel: DeliveryChannel): PushProvider {
    return { channel, send: (target, payload) => this.send(channel, target, payload) };
  }

  supports(channel: DeliveryChannel): boolean {
    const selected = this.config.get<string>('PUSH_PROVIDER', 'disabled');
    if (channel === 'webpush' || channel === 'rustore') return selected === channel || selected === 'both';
    if (channel === 'max') return this.config.get('MAX_NOTIFICATIONS_ENABLED') === 'true';
    return this.config.get('TELEGRAM_NOTIFICATIONS_ENABLED') === 'true';
  }

  async send(channel: DeliveryChannel, target: DeliveryTarget, payload: DeliveryPayload): Promise<void> {
    if (!deliveryEnabled(this.config)) throw new DeliveryError('delivery_disabled', true);
    if (!this.supports(channel)) throw new DeliveryError('provider_disabled', true);
    if (channel === 'webpush') {
      validateDeviceToken(target.token, 'web', 'webpush', this.config);
      const subject = this.config.get<string>('WEBPUSH_VAPID_SUBJECT');
      const publicKey = this.config.get<string>('WEBPUSH_VAPID_PUBLIC_KEY');
      const privateKey = this.config.get<string>('WEBPUSH_VAPID_PRIVATE_KEY');
      if (!subject || !publicKey || !privateKey) throw new DeliveryError('provider_not_configured', true);
      try {
        await webPush.sendNotification(JSON.parse(target.token), JSON.stringify({ ...payload, tag: payload.id }), {
          vapidDetails: { subject, publicKey, privateKey }, TTL: 86400, timeout: 5000,
        });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        throw status ? httpFailure(status, true) : new DeliveryError('provider_network');
      }
      return;
    }
    let url: string;
    let authorization: string | undefined;
    let body: Record<string, unknown>;
    let destination: string | undefined;
    const appUrl = this.config.get<string>('telegram.publicAppUrl');
    if (appUrl && payload.deepLink?.startsWith('/') && !payload.deepLink.startsWith('//')) {
      try {
        const base = new URL(appUrl);
        const link = new URL(payload.deepLink, base);
        if (base.protocol === 'https:' && !base.username && !base.password && link.origin === base.origin) destination = link.toString();
      } catch { /* A missing/invalid app URL must not create an external destination. */ }
    }
    if (channel === 'rustore') {
      validateDeviceToken(target.token, 'android', 'rustore', this.config);
      const project = this.config.get<string>('RUSTORE_PROJECT_ID');
      const secret = this.config.get<string>('RUSTORE_SERVICE_TOKEN');
      if (!project || !secret) throw new DeliveryError('provider_not_configured', true);
      url = `https://vkpns.rustore.ru/v1/projects/${encodeURIComponent(project)}/messages:send`;
      authorization = `Bearer ${secret}`;
      body = { message: { token: target.token, notification: { title: payload.title, body: payload.body }, data: { notificationId: payload.id, deepLink: payload.deepLink || '/' } } };
    } else if (channel === 'telegram') {
      const secret = this.config.get<string>('telegram.botToken');
      if (!secret || !/^\d+$/.test(target.token)) throw new DeliveryError('provider_not_configured', true);
      url = `https://api.telegram.org/bot${secret}/sendMessage`;
      body = { chat_id: target.token, text: `${payload.title}\n${payload.body}`.slice(0, 4096),
        ...(destination ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть в НаПаре', url: destination }]] } } : {}) };
    } else {
      const secret = this.config.get<string>('max.botToken');
      if (!secret || !/^\d+$/.test(target.token)) throw new DeliveryError('provider_not_configured', true);
      url = `https://platform-api2.max.ru/messages?user_id=${encodeURIComponent(target.token)}`;
      authorization = secret;
      body = { text: `${payload.title}\n${payload.body}`.slice(0, 4000),
        ...(destination ? { attachments: [{ type: 'inline_keyboard', payload: { buttons: [[{ type: 'link', text: 'Открыть в НаПаре', url: destination }]] } }] } : {}) };
    }
    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });
    } catch { throw new DeliveryError('provider_network'); }
    if (!response.ok) throw httpFailure(response.status, channel === 'rustore');
    if (channel === 'telegram') {
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error_code?: number };
      if (!result.ok) throw httpFailure(result.error_code || 502);
    }
  }
}
