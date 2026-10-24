import { ConfigService } from '@nestjs/config';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { TkassaProvider, tkassaToken } from './tkassa.provider';
import { advancePaymentState, normalizeTkassaStatus } from './payment-state';

describe('T-Kassa protocol boundary', () => {
  const settings = { TKASSA_TERMINAL_KEY: 'test-terminal', TKASSA_PASSWORD: 'synthetic-password', TKASSA_SEND_REQUESTS: 'true' };
  const transport = jest.fn();
  const provider = (changes = {}) => new TkassaProvider(new ConfigService({ ...settings, ...changes }), transport);
  beforeEach(() => transport.mockReset());

  it('matches the official UTF8 signing vector (public documentation test data)', () => {
    // https://www.tbank.ru/kassa/dev/webview/#section/Token
    expect(tkassaToken({ TerminalKey: 'MerchantTerminalKey', Amount: 19200, OrderId: '21090', Description: 'Подарочная карта на 1000 рублей', Receipt: { any: true }, DATA: [1] }, 'usaf8fw8fsw21g'))
      .toBe('0024a00af7c350a3a67ca168ce06502aa72772456662e38696d48b56ee9c97d9');
  });
  it('ignores the existing token and nested values, preserving root booleans', () => {
    expect(tkassaToken({ Success: true, Amount: 100, DATA: { secret: 'ignored' }, Token: 'old' }, 'test'))
      .toBe(tkassaToken({ Amount: 100, Success: true }, 'test'));
  });
  it('rejects forged notification signatures and a different terminal', () => {
    const payload = { TerminalKey: settings.TKASSA_TERMINAL_KEY, Amount: 100, Success: true };
    const signed = { ...payload, Token: tkassaToken(payload, settings.TKASSA_PASSWORD) };
    expect(provider().verifyNotification(signed)).toBe(true);
    expect(provider().verifyNotification({ ...signed, Amount: 101 })).toBe(false);
    expect(provider().verifyNotification({ ...signed, TerminalKey: 'foreign-terminal' })).toBe(false);
    expect(provider().verifyNotification({ ...signed, Token: 'x' })).toBe(false);
  });
  it('performs no network request while external delivery is disabled', async () => {
    await expect(provider({ TKASSA_SEND_REQUESTS: 'false' }).request('Init', {})).rejects.toThrow(ServiceUnavailableException);
    expect(transport).not.toHaveBeenCalled();
  });
  it('requires separate live approval and otherwise uses the fixed sandbox endpoint', async () => {
    await expect(provider({ TKASSA_LIVE: 'true' }).request('Init', {})).rejects.toThrow(ServiceUnavailableException);
    transport.mockResolvedValue(new Response(JSON.stringify({ Success: true, TerminalKey: settings.TKASSA_TERMINAL_KEY })));
    await provider().request('GetState', { PaymentId: '123' });
    expect(transport.mock.calls[0][0]).toBe('https://rest-api-test.tinkoff.ru/v2/GetState');
    expect(transport.mock.calls[0][1].redirect).toBe('error');
  });
  it('rejects provider failures without exposing bank payload or secrets', async () => {
    transport.mockResolvedValue(new Response(JSON.stringify({ Success: false, Message: 'private bank detail' })));
    await expect(provider().request('Init', {})).rejects.toThrow(BadGatewayException);
  });
  it.each(['http://securepay.tinkoff.ru/x', 'https://evil.test/x', 'https://user:password@securepay.tinkoff.ru/x'])('rejects unsafe confirmation URL %s', value => {
    expect(() => provider().confirmationUrl(value)).toThrow(BadGatewayException);
  });
  it('preserves completed payment states across late notifications', () => {
    expect(advancePaymentState('succeeded', 'pending')).toBe('succeeded');
    expect(advancePaymentState('refunded', 'succeeded')).toBe('refunded');
    expect(advancePaymentState('partially_refunded', 'pending')).toBe('partially_refunded');
    expect(advancePaymentState('unknown', 'succeeded')).toBe('succeeded');
    expect(() => normalizeTkassaStatus('unrecognized')).toThrow();
  });
});
