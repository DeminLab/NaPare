import { clientFromHeader, parseUserAgent } from './user-agent';

describe('user agent parsing', () => {
  it('recognizes the Android application wrapper', () => {
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.0.0 Mobile Safari/537.36 NaPareAndroid/1.0'))
      .toEqual({ client: 'android', device: 'mobile', os: 'android', browser: 'webview' });
  });

  it('recognizes desktop browsers, tablets and bots', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'))
      .toEqual({ client: 'web', device: 'desktop', os: 'macos', browser: 'safari' });
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36').device).toBe('tablet');
    expect(parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1').device).toBe('tablet');
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0.0.0').browser).toBe('edge');
    expect(parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').device).toBe('bot');
    expect(parseUserAgent(undefined)).toEqual({ client: 'web', device: 'unknown', os: 'unknown', browser: 'unknown' });
  });

  it('prefers the explicit client header over the user agent', () => {
    expect(clientFromHeader('api', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe('api');
    expect(clientFromHeader('ANDROID', 'Mozilla/5.0')).toBe('android');
    expect(clientFromHeader('unknown-client', 'Mozilla/5.0 (Linux; Android 13) NaPareAndroid/1.0')).toBe('android');
    expect(clientFromHeader(undefined, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) MaxApp/1.0')).toBe('max');
  });
});
