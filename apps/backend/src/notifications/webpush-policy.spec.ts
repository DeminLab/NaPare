import { ConfigService } from '@nestjs/config';
import { generateVAPIDKeys } from 'web-push';
import { hasWebPushConsent, WEBPUSH_CONSENT_VERSION, webPushConfiguration } from './webpush-policy';

describe('WebPush opt-in configuration', () => {
  const keys = generateVAPIDKeys();
  const settings = { PUSH_PROVIDER: 'webpush', WEBPUSH_VAPID_PUBLIC_KEY: keys.publicKey, WEBPUSH_VAPID_PRIVATE_KEY: keys.privateKey, WEBPUSH_VAPID_SUBJECT: 'mailto:push@example.test', NOTIFICATIONS_DELIVERY_ENABLED: 'true', NOTIFICATIONS_QUEUE_ENABLED: 'true' };
  it('exposes only the matching public key and distinguishes registration from sending', () => {
    const ready = webPushConfiguration(new ConfigService(settings));
    expect(ready).toEqual({ available: true, publicKey: keys.publicKey, deliveryEnabled: true, consentVersion: WEBPUSH_CONSENT_VERSION });
    expect(JSON.stringify(ready)).not.toContain(keys.privateKey);
    expect(webPushConfiguration(new ConfigService({ ...settings, NOTIFICATIONS_QUEUE_ENABLED: 'false' })).deliveryEnabled).toBe(false);
    expect(webPushConfiguration(new ConfigService({ ...settings, NOTIFICATIONS_DELIVERY_ENABLED: 'false' })).available).toBe(true);
  });
  it.each([
    { PUSH_PROVIDER: 'disabled' }, { WEBPUSH_VAPID_PRIVATE_KEY: '' }, { WEBPUSH_VAPID_PUBLIC_KEY: generateVAPIDKeys().publicKey },
    { WEBPUSH_VAPID_SUBJECT: 'http://example.test' }, { WEBPUSH_VAPID_SUBJECT: 'mailto:' }, { WEBPUSH_VAPID_SUBJECT: 'https://user:password@example.test' },
  ])('does not advertise an unusable configuration: %j', update => {
    expect(webPushConfiguration(new ConfigService({ ...settings, ...update }))).toMatchObject({ available: false, publicKey: null, deliveryEnabled: false });
  });
  it('requires a current unrevoked opt-in independently of token presence', () => {
    const row = { webPushConsentedAt: new Date(), webPushConsentVersion: WEBPUSH_CONSENT_VERSION, webPushRevokedAt: null };
    expect(hasWebPushConsent(row)).toBe(true);
    expect(hasWebPushConsent({ ...row, webPushConsentedAt: null })).toBe(false);
    expect(hasWebPushConsent({ ...row, webPushConsentVersion: 'old' })).toBe(false);
    expect(hasWebPushConsent({ ...row, webPushRevokedAt: new Date() })).toBe(false);
  });
});
