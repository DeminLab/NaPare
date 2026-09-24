import { createHmac } from 'crypto';

import { validateMaxInitData } from './max-init-data';

const BOT_TOKEN = '1234567890:TEST-BOT-TOKEN';

function buildDataCheckString(values: Record<string, string>): string {
  return Object.keys(values)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${values[key]}`)
    .join('\n');
}

function sign(dataCheckString: string, botToken: string): string {
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

function buildInitData(
  values: Record<string, string>,
  botToken = BOT_TOKEN,
  options: { encoded?: boolean } = {},
): string {
  const hash = sign(buildDataCheckString(values), botToken);
  const query = Object.entries(values)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  const initDataTable = `${query}&hash=${hash}`;

  if (!options.encoded) return initDataTable;
  return `#WebAppData=${encodeURIComponent(initDataTable)}&platform=android`;
}

function userValue(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 424242,
    first_name: 'Иван',
    last_name: 'Иванов',
    username: 'ivan',
    ...overrides,
  });
}

function validValues(authDate: number): Record<string, string> {
  return {
    auth_date: String(authDate),
    user: userValue(),
    query_id: 'AAE-test-query',
  };
}

describe('validateMaxInitData', () => {
  const now = new Date('2026-09-24T12:00:00Z');
  const nowSeconds = Math.floor(now.getTime() / 1000);

  it('accepts correctly signed initData', () => {
    const payload = validateMaxInitData(buildInitData(validValues(nowSeconds - 60)), BOT_TOKEN, {
      now,
    });

    expect(payload).not.toBeNull();
    expect(payload?.maxUserId).toBe('424242');
    expect(payload?.authDate.toISOString()).toBe(new Date((nowSeconds - 60) * 1000).toISOString());
    expect(payload?.user.first_name).toBe('Иван');
  });

  it('accepts initData wrapped into a WebAppData URL fragment', () => {
    const payload = validateMaxInitData(
      buildInitData(validValues(nowSeconds - 60), BOT_TOKEN, { encoded: true }),
      BOT_TOKEN,
      { now },
    );

    expect(payload?.maxUserId).toBe('424242');
  });

  it('rejects initData signed with a different bot token', () => {
    const initData = buildInitData(validValues(nowSeconds), 'other-bot-token');

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const initData = buildInitData(validValues(nowSeconds - 60)).replace(
      `auth_date=${nowSeconds - 60}`,
      `auth_date=${nowSeconds}`,
    );

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects initData without a hash', () => {
    const initData = `auth_date=${nowSeconds}&user=${encodeURIComponent(userValue())}`;

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects a non-hex hash', () => {
    const values = validValues(nowSeconds);
    const initData = `${Object.entries(values)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')}&hash=${'z'.repeat(64)}`;

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects a duplicated hash parameter', () => {
    const initData = `${buildInitData(validValues(nowSeconds))}&hash=${'0'.repeat(64)}`;

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects initData older than the configured max age', () => {
    const initData = buildInitData(validValues(nowSeconds - 3601));

    expect(
      validateMaxInitData(initData, BOT_TOKEN, { now, maxAgeSeconds: 3600 }),
    ).toBeNull();
  });

  it('accepts initData within the configured max age', () => {
    const initData = buildInitData(validValues(nowSeconds - 3600));

    expect(
      validateMaxInitData(initData, BOT_TOKEN, { now, maxAgeSeconds: 3600 }),
    ).not.toBeNull();
  });

  it('rejects initData issued too far in the future', () => {
    const initData = buildInitData(validValues(nowSeconds + 600));

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects initData without a user', () => {
    const initData = buildInitData({ auth_date: String(nowSeconds) });

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects a user value that is not a JSON object with an id', () => {
    const initData = buildInitData({
      auth_date: String(nowSeconds),
      user: JSON.stringify({ first_name: 'Без' }),
    });

    expect(validateMaxInitData(initData, BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects malformed and empty input', () => {
    expect(validateMaxInitData('', BOT_TOKEN, { now })).toBeNull();
    expect(validateMaxInitData('   ', BOT_TOKEN, { now })).toBeNull();
    expect(validateMaxInitData('=value-only-key&hash=abc', BOT_TOKEN, { now })).toBeNull();
    expect(validateMaxInitData('bad=%ZZ&hash=abc', BOT_TOKEN, { now })).toBeNull();
  });

  it('rejects validation when the bot token is not configured', () => {
    expect(validateMaxInitData(buildInitData(validValues(nowSeconds)), '', { now })).toBeNull();
  });
});
