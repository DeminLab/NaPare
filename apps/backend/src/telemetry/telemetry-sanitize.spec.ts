import { normalizePath, sanitizeMetadata } from './telemetry-sanitize';

describe('telemetry sanitization', () => {
  it('drops credentials, tokens and direct contact data from metadata', () => {
    const result = sanitizeMetadata({
      password: 'hunter2secret',
      newPassword: 'x',
      accessToken: 'jwt.value.here',
      refreshToken: 'jwt.value.here',
      authorization: 'Bearer token',
      cookie: 'session=1',
      api_key: 'sk-1',
      email: 'student@napare.ru',
      phone: '+79990000000',
      jwt: 'payload',
      secret: 's',
      userId: 'user-1',
      statusCode: 200,
      retry: true,
      installId: 'install-1',
    });

    expect(result).toEqual({ userId: 'user-1', statusCode: 200, retry: true, installId: 'install-1' });
  });

  it('ignores scalars, arrays and oversized payloads', () => {
    expect(sanitizeMetadata('password=plain')).toBeNull();
    expect(sanitizeMetadata(null)).toBeNull();
    expect(sanitizeMetadata({ items: Array.from({ length: 60 }, (_, index) => index) })?.items).toHaveLength(20);
    const wide = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`key${index}`, index]));
    expect(Object.keys(sanitizeMetadata(wide) ?? {})).toHaveLength(30);
    expect(sanitizeMetadata({ note: 'x'.repeat(900) })?.note).toHaveLength(300);
  });

  it('normalizes identifiers so routes group instead of exploding', () => {
    expect(normalizePath('/api/v1/pair-spaces/0f1e2d3c-4b5a-1678-9abc-def012345678/messages?after=10')).toBe('/api/v1/pair-spaces/:id/messages');
    expect(normalizePath('/api/v1/users/12345/schedule')).toBe('/api/v1/users/:n/schedule');
    expect(normalizePath('/api/v1/my-day')).toBe('/api/v1/my-day');
    expect(normalizePath('/api/v1/lessons/7')).toBe('/api/v1/lessons/7');
  });
});
