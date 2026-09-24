import { createHmac, timingSafeEqual } from 'crypto';

export interface MaxInitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface MaxInitDataPayload {
  maxUserId: string;
  authDate: Date;
  user: MaxInitDataUser;
}

export interface MaxInitDataOptions {
  maxAgeSeconds?: number;
  now?: Date;
}

const MAX_SECRET_KEY = 'WebAppData';
const MAX_FUTURE_SKEW_SECONDS = 300;
const HASH_PATTERN = /^[0-9a-f]{64}$/i;

function decodeInitData(initData: string): Record<string, string> | null {
  const params: Record<string, string> = {};

  for (const pair of initData.split('&')) {
    if (!pair) continue;
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) return null;

    const key = pair.slice(0, separatorIndex);
    if (key in params) return null;

    try {
      params[key] = decodeURIComponent(pair.slice(separatorIndex + 1));
    } catch {
      return null;
    }
  }

  return Object.keys(params).length > 0 ? params : null;
}

function parseInitData(initData: string): Record<string, string> | null {
  const trimmed = initData.trim();
  if (!trimmed) return null;

  const params = decodeInitData(trimmed);
  if (params && 'hash' in params) return params;

  let candidate = trimmed.replace(/^[?#]/, '');
  const fragmentPrefix = 'WebAppData=';
  if (candidate.startsWith(fragmentPrefix)) {
    const ampIndex = candidate.indexOf('&');
    candidate =
      ampIndex === -1
        ? candidate.slice(fragmentPrefix.length)
        : candidate.slice(fragmentPrefix.length, ampIndex);
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return params;
  }

  return decodeInitData(candidate) ?? params;
}

function buildDataCheckString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== 'hash')
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${params[key]}`)
    .join('\n');
}

function computeHash(dataCheckString: string, botToken: string): string {
  const secretKey = createHmac('sha256', MAX_SECRET_KEY).update(botToken).digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

function hashesMatch(expected: string, actual: string): boolean {
  if (!HASH_PATTERN.test(actual)) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual.toLowerCase(), 'hex');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function validateMaxInitData(
  initData: string,
  botToken: string,
  options: MaxInitDataOptions = {},
): MaxInitDataPayload | null {
  if (!botToken) return null;

  const params = parseInitData(initData);
  if (!params) return null;

  const providedHash = params.hash;
  if (!providedHash) return null;

  const expectedHash = computeHash(buildDataCheckString(params), botToken);
  if (!hashesMatch(expectedHash, providedHash)) return null;

  const authDateSeconds = Number(params.auth_date);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) return null;

  const now = options.now ?? new Date();
  const maxAgeSeconds = options.maxAgeSeconds ?? 3600;
  const ageSeconds = now.getTime() / 1000 - authDateSeconds;
  if (ageSeconds > maxAgeSeconds) return null;
  if (ageSeconds < -MAX_FUTURE_SKEW_SECONDS) return null;

  if (!params.user) return null;

  let user: MaxInitDataUser;
  try {
    user = JSON.parse(params.user) as MaxInitDataUser;
  } catch {
    return null;
  }
  if (!user || typeof user !== 'object' || typeof user.id !== 'number') return null;

  return {
    maxUserId: String(user.id),
    authDate: new Date(authDateSeconds * 1000),
    user,
  };
}
