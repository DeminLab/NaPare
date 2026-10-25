import { ConfigService } from '@nestjs/config';
import { createECDH } from 'node:crypto';
import type { DeviceToken } from './entities/device-token.entity';
import { deliveryEnabled, queueEnabled } from './delivery/delivery-config';

export const WEBPUSH_CONSENT_VERSION = 'webpush-browser-2026-10-24';
export function hasWebPushConsent(device: Pick<DeviceToken, 'webPushConsentedAt' | 'webPushConsentVersion' | 'webPushRevokedAt'>): boolean {
  return !!device.webPushConsentedAt && device.webPushConsentVersion === WEBPUSH_CONSENT_VERSION && !device.webPushRevokedAt;
}
export function webPushConfiguration(config: ConfigService) {
  const provider = config.get<string>('PUSH_PROVIDER', 'disabled');
  const publicKey = config.get<string>('WEBPUSH_VAPID_PUBLIC_KEY') || '';
  const privateKey = config.get<string>('WEBPUSH_VAPID_PRIVATE_KEY') || '';
  const subject = config.get<string>('WEBPUSH_VAPID_SUBJECT') || '';
  let available = false;
  try {
    const key = createECDH('prime256v1'); key.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    const url = new URL(subject);
    const subjectValid = url.protocol === 'mailto:' ? /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subject) : url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    available = ['webpush','both'].includes(provider) && subjectValid
      && Buffer.from(privateKey, 'base64url').length === 32 && key.getPublicKey().equals(Buffer.from(publicKey, 'base64url'));
  } catch { /* Missing or inconsistent configuration stays disabled; never expose key errors. */ }
  return { available, publicKey: available ? publicKey : null, deliveryEnabled: available && deliveryEnabled(config) && queueEnabled(config), consentVersion: WEBPUSH_CONSENT_VERSION };
}
