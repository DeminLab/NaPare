import type { TelemetrySource } from './telemetry.entities';

export interface ParsedUserAgent {
  client: TelemetrySource;
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  os: 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'unknown';
  browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'opera' | 'yandex' | 'webview' | 'unknown';
}

const BOT = /bot|crawler|spider|crawling|preview|headless|lighthouse|monitoring/i;
const MOBILE = /mobile|iphone|ipod|android.+mobile|windows phone/i;
const TABLET = /ipad|tablet|android(?!.*mobile)|kindle|silk/i;
// The app marker is appended to the WebView UA; it must not look like a tablet "Android" token.
const APP_MARKER = /\s?(?:NaPareAndroid|MaxApp|MaxWebView)\/[\w.]+/gi;

/** Best-effort, deterministic parsing for diagnostics only. Never used for authorization. */
export function parseUserAgent(value?: string | null): ParsedUserAgent {
  const raw = (value ?? '').slice(0, 512);
  if (!raw.trim()) return { client: 'web', device: 'unknown', os: 'unknown', browser: 'unknown' };

  const androidApp = /NaPareAndroid\//i.test(raw);
  const ua = raw.replace(APP_MARKER, ' ');
  const client: TelemetrySource = androidApp ? 'android' : /MaxWebView|MaxApp\//i.test(raw) ? 'max' : 'web';
  const device = BOT.test(ua) ? 'bot' : TABLET.test(ua) ? 'tablet' : MOBILE.test(ua) ? 'mobile' : 'desktop';
  const os = /Windows NT/i.test(ua) ? 'windows'
    : /iPhone|iPad|iPod/i.test(ua) ? 'ios'
      : /Mac OS X|Macintosh/i.test(ua) ? 'macos'
        : /Android/i.test(ua) ? 'android'
          : /Linux|X11|CrOS/i.test(ua) ? 'linux'
            : 'unknown';
  const browser = androidApp || /; wv\)/i.test(ua) ? 'webview'
    : /Edg(?:e|A|iOS)?\//i.test(ua) ? 'edge'
      : /OPR\/|Opera/i.test(ua) ? 'opera'
        : /YaBrowser/i.test(ua) ? 'yandex'
          : /Firefox|FxiOS/i.test(ua) ? 'firefox'
            : /Chrome|CriOS/i.test(ua) ? 'chrome'
              : /Safari/i.test(ua) ? 'safari'
                : 'unknown';

  return { client, device, os, browser };
}

export function clientFromHeader(value: string | undefined, ua?: string | null): TelemetrySource {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'android' || normalized === 'web' || normalized === 'max' || normalized === 'api') return normalized;
  return parseUserAgent(ua).client;
}

export const CLIENT_LABELS: Record<string, string> = {
  backend: 'Сервер',
  web: 'Веб-браузер',
  android: 'Android-приложение',
  max: 'MAX',
  api: 'API-клиент',
  unknown: 'Не определено',
};
