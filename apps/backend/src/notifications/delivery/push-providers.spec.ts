import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as webPush from 'web-push';
import { DeliveryError, NotificationProviders, validateDeviceToken } from './push-providers';

const payload = { id: 'synthetic-delivery', title: 'Расписание', body: 'Изменилась аудитория', deepLink: '/schedule' };
const subscription = () => JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', keys: {
  p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url'),
} });

describe('Notification provider boundary', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('does not send anything by default, including legacy messenger channels', async () => {
    const providers = new NotificationProviders(new ConfigService());
    for (const channel of ['webpush', 'rustore', 'telegram', 'max'] as const) {
      await expect(providers.get(channel).send({ token: 'synthetic' }, payload)).rejects.toMatchObject({ code: 'delivery_disabled' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires the separate provider switch even with global delivery enabled', async () => {
    const providers = new NotificationProviders(new ConfigService({ NOTIFICATIONS_DELIVERY_ENABLED: 'true' }));
    await expect(providers.send('max', { token: '123' }, payload)).rejects.toMatchObject({ code: 'provider_disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects private, credentialed, alternate-port and lookalike WebPush endpoints', () => {
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.test/x', 'https://x:y@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x']) {
      const value = JSON.parse(subscription()); value.endpoint = endpoint;
      expect(() => validateDeviceToken(JSON.stringify(value), 'web', 'webpush', new ConfigService())).toThrow(BadRequestException);
    }
    expect(() => validateDeviceToken(subscription(), 'web', 'webpush', new ConfigService())).not.toThrow();
  });

  it('rejects malformed subscription keys and non-Android RuStore tokens', () => {
    const value = JSON.parse(subscription()); value.keys.auth = 'invalid';
    expect(() => validateDeviceToken(JSON.stringify(value), 'web', 'webpush', new ConfigService())).toThrow();
    expect(() => validateDeviceToken('synthetic-rustore-token', 'ios', 'rustore', new ConfigService())).toThrow();
    expect(() => validateDeviceToken('synthetic-rustore-token', 'android', 'rustore', new ConfigService())).not.toThrow();
  });

  it('sends RuStore using the fixed official host and bearer secret', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const providers = new NotificationProviders(new ConfigService({ NOTIFICATIONS_DELIVERY_ENABLED: 'true', PUSH_PROVIDER: 'rustore', RUSTORE_PROJECT_ID: 'test-project', RUSTORE_SERVICE_TOKEN: 'synthetic-secret' }));
    await providers.send('rustore', { token: 'synthetic-rustore-token' }, payload);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://vkpns.rustore.ru/v1/projects/test-project/messages:send');
    expect(options).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer synthetic-secret' } });
    expect(JSON.parse(options.body).message.data.notificationId).toBe(payload.id);
  });

  it.each([[429, false], [503, false], [401, true], [410, true]])('classifies provider HTTP %s without leaking its response', async (status, permanent) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    const providers = new NotificationProviders(new ConfigService({ NOTIFICATIONS_DELIVERY_ENABLED: 'true', PUSH_PROVIDER: 'rustore', RUSTORE_PROJECT_ID: 'test', RUSTORE_SERVICE_TOKEN: 'synthetic' }));
    await expect(providers.send('rustore', { token: 'synthetic-rustore-token' }, payload)).rejects.toMatchObject({ code: `provider_http_${status}`, permanent });
  });

  it('treats a Telegram ok:false response as failure and encodes no markup', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error_code: 403 }) });
    const providers = new NotificationProviders(new ConfigService({ NOTIFICATIONS_DELIVERY_ENABLED: 'true', TELEGRAM_NOTIFICATIONS_ENABLED: 'true', telegram: { botToken: 'synthetic' } }));
    await expect(providers.send('telegram', { token: '12345' }, payload)).rejects.toMatchObject({ permanent: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('parse_mode');
  });

  it('uses the current MAX endpoint and raw Authorization header', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const providers = new NotificationProviders(new ConfigService({ NOTIFICATIONS_DELIVERY_ENABLED: 'true', MAX_NOTIFICATIONS_ENABLED: 'true', max: { botToken: 'synthetic' } }));
    await providers.send('max', { token: '12345' }, payload);
    expect(fetchMock.mock.calls[0][0]).toBe('https://platform-api2.max.ru/messages?user_id=12345');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('synthetic');
  });

  it('adds only same-origin HTTPS action links to messenger messages', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const providers = new NotificationProviders(new ConfigService({ NOTIFICATIONS_DELIVERY_ENABLED: 'true', TELEGRAM_NOTIFICATIONS_ENABLED: 'true', telegram: { botToken: 'synthetic', publicAppUrl: 'https://napare.example.test' } }));
    await providers.send('telegram', { token: '12345' }, payload);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_markup.inline_keyboard[0][0].url).toBe('https://napare.example.test/schedule');
    for (const deepLink of ['//evil.example.test', '/\\evil.example.test', 'https://evil.example.test']) {
      await providers.send('telegram', { token: '12345' }, { ...payload, deepLink });
      expect(JSON.parse(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body)).not.toHaveProperty('reply_markup');
    }
  });

  it('maps WebPush revoked subscriptions to permanent errors', async () => {
    jest.spyOn(webPush, 'sendNotification').mockRejectedValue({ statusCode: 410 });
    const providers = new NotificationProviders(new ConfigService({ NOTIFICATIONS_DELIVERY_ENABLED: 'true', PUSH_PROVIDER: 'webpush', WEBPUSH_VAPID_SUBJECT: 'mailto:test@example.test', WEBPUSH_VAPID_PUBLIC_KEY: 'synthetic', WEBPUSH_VAPID_PRIVATE_KEY: 'synthetic' }));
    await expect(providers.send('webpush', { token: subscription() }, payload)).rejects.toEqual(new DeliveryError('provider_http_410', true, true));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
