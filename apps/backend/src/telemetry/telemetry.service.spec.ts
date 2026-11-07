import { TelemetryService } from './telemetry.service';

type QueryCall = { sql: string; params: unknown[] };
type InsertCall = { table: string; row: Record<string, unknown> };
type Call = QueryCall | InsertCall;

function create(options: { failQuery?: boolean; failInsert?: boolean; refreshExpiration?: string } = {}) {
  const calls: Call[] = [];
  const grants: Array<Record<string, unknown>> = [];
  const repository = (table: string) => ({
    insert: async (row: Record<string, unknown>) => {
      calls.push({ table, row });
      if (options.failInsert) throw new Error('insert rejected');
      return { identifiers: [{ id: row.id ?? 'row-1' }] };
    },
  });
  const db = {
    getRepository: (entity: { name: string }) => repository(entity.name),
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (options.failQuery) throw new Error('database unavailable');
      return /^(UPDATE|DELETE)/.test(sql) ? [{ id: 'row-1' }] : [];
    },
  };
  const config = {
    get: (key: string) => key === 'auth.jwt.refreshExpiration' ? options.refreshExpiration ?? '30d'
      : key === 'auth.jwt.secret' ? 'test-signing-secret' : undefined,
  };
  const tenant = {
    runWithDatabaseAccess: async (access: Record<string, unknown>, callback: () => Promise<unknown>) => {
      grants.push(access);
      return callback();
    },
  };
  return { service: new TelemetryService(db as never, config as never, tenant as never), calls, grants };
}

const queries = (calls: Call[]) => calls.filter((call): call is QueryCall => 'sql' in call);
const inserted = (calls: Call[], table: string) => {
  const call = calls.find((item): item is InsertCall => 'table' in item && item.table === table);
  if (!call) throw new Error(`Missing insert into ${table}`);
  return call.row;
};

describe('TelemetryService', () => {
  it('never persists a credential or contact value from auth metadata', async () => {
    const { service, calls } = create();
    await service.recordAuth({ type: 'login_failed', emailHash: 'hash', metadata: { password: 'p', refreshToken: 't', city: 'Омск' } } as never);
    const row = inserted(calls, 'AuthEvent');
    expect(JSON.stringify(row)).not.toMatch(/password|refreshToken/i);
    expect(row.metadata).toEqual({ city: 'Омск' });
  });

  it('bounds stored ip and user agent columns', async () => {
    const { service, calls } = create();
    await service.recordAuth({ type: 'login_success', ip: '9'.repeat(120), userAgent: 'u'.repeat(900) } as never);
    const row = inserted(calls, 'AuthEvent');
    expect(String(row.ip)).toHaveLength(64);
    expect(String(row.userAgent)).toHaveLength(512);
  });

  it('fingerprints an email case- and space-insensitively without keeping the address', () => {
    const { service } = create();
    expect(service.fingerprint('  Student@Example.COM ')).toBe(service.fingerprint('student@example.com'));
    expect(service.fingerprint('student@example.com')).not.toBe(service.fingerprint('student@other.example'));
    expect(service.fingerprint('student@example.com')).not.toContain('student@example.com');
  });

  it('keeps a failed session write from breaking the login itself', async () => {
    const { service } = create({ failInsert: true });
    await expect(service.createSession({ id: 'user-1', universityId: 'uni-1' }, { userAgent: 'NaPareAndroid/1.0' })).resolves.toBeNull();
  });

  it('derives the session lifetime from the configured refresh token expiry', async () => {
    const { service, calls } = create({ refreshExpiration: '12h' });
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T00:00:00.000Z'));
    await service.createSession({ id: 'user-1', universityId: 'uni-1' }, {});
    jest.useRealTimers();
    const row = inserted(calls, 'UserSession');
    expect(new Date(row.expiresAt as Date).getTime() - new Date(row.createdAt as Date).getTime()).toBe(12 * 3_600_000);
    expect(row.browser).toBe('unknown');
  });

  it('touches a session at most once per five minutes and stays silent on failure', async () => {
    const { service, calls } = create();
    await service.touchSession('session-1');
    expect(queries(calls)[0].sql).toContain('5 minutes');
    expect(queries(calls)[0].sql).toContain('"revokedAt" IS NULL');
    await expect(create({ failQuery: true }).service.touchSession('session-1')).resolves.toBeUndefined();
  });

  it('restricts self-service revocation to the owning account', async () => {
    const { service, calls } = create();
    await service.revokeOwnSession('session-1', 'user-1', 'Выход с устройства');
    const update = queries(calls)[0];
    expect(update.sql).toContain('id=$1');
    expect(update.sql).toContain('"userId"=$2');
    expect(update.sql).toContain('"revokedAt" IS NULL');
    expect(update.params).toEqual(['session-1', 'user-1', 'Выход с устройства']);
  });

  it('truncates a self-service revoke reason to the column limit', async () => {
    const { service, calls } = create();
    await service.revokeOwnSession('session-1', 'user-1', 'п'.repeat(400));
    expect(String(queries(calls)[0].params[2])).toHaveLength(200);
  });

  it('runs administrative revocation through an explicit write capability', async () => {
    const { service, grants } = create();
    await service.revokeSession('session-1', 'actor-1', 'Подозрительная активность');
    await service.revokeAllForUser('user-1', 'actor-1', 'Смена пароля');
    expect(grants).toHaveLength(2);
    for (const grant of grants) {
      expect(grant.tables).toEqual(['user_sessions']);
      expect(grant.write).toBe(true);
      expect(grant.replaceActor).toBe(true);
    }
  });

  it('fails closed when session activity cannot be verified', async () => {
    await expect(create({ failQuery: true }).service.isSessionActive('session-1', 'user-1')).resolves.toBe(false);
    await expect(create().service.isSessionActive('session-1', 'user-1')).resolves.toBe(false);
  });

  it('normalizes paths and sanitizes metadata for buffered client events', async () => {
    const { service, calls } = create();
    service.enqueueEvent({ source: 'web', category: 'ui', name: 'page.view', userId: 'user-1', universityId: 'uni-1', path: '/pair-space/11111111-1111-4111-8111-111111111111/notes?q=hello', metadata: { installId: 'install-1', token: 'secret-value' } } as never);
    await service.flush();
    const row = inserted(calls, 'PlatformEvent');
    // flush() writes the whole buffer as one batch insert.
    const [event] = Array.isArray(row) ? row as unknown as Array<Record<string, unknown>> : [row];
    expect(event.path).toBe('/pair-space/:id/notes');
    expect(event.metadata).toEqual({ installId: 'install-1' });
  });

  it('applies the documented retention windows for each journal', async () => {
    const { service, calls } = create();
    await service.purgeExpired();
    const statements = queries(calls).map(call => call.sql);
    expect(statements[0]).toContain('DELETE FROM platform_events');
    expect(statements[0]).toContain("interval '180 days'");
    expect(statements[1]).toContain('DELETE FROM auth_events');
    expect(statements[1]).toContain("interval '400 days'");
    expect(statements[2]).toContain('DELETE FROM user_sessions');
    expect(statements[2]).toContain("interval '400 days'");
    expect(statements[2]).toContain('"revokedAt" IS NOT NULL OR "expiresAt" < now()');
  });

  it('classifies only allowlisted beacon sources', () => {
    const { service } = create();
    expect(service.clientFrom('android', 'Mozilla/5.0')).toBe('android');
    expect(service.clientFrom('max', 'Mozilla/5.0')).toBe('max');
    // An unlisted header value never invents a source; the UA marker decides.
    expect(service.clientFrom('unknown-app', 'Mozilla/5.0 (Linux; Android 13) NaPareAndroid/1.2.0')).toBe('android');
    expect(service.clientFrom('unknown-app', 'Mozilla/5.0 (Linux; Android 13)')).toBe('web');
    expect(service.clientFrom('unknown-app', 'Mozilla/5.0 (Macintosh)')).toBe('web');
    expect(service.clientFrom(undefined, undefined)).toBe('web');
  });
});
