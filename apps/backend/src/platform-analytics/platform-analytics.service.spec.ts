import { BadRequestException } from '@nestjs/common';

import { PlatformAnalyticsService } from './platform-analytics.service';

type QueryCall = { sql: string; params: unknown[] };

function create(queryResult: (sql: string, params: unknown[]) => unknown[]) {
  const calls: QueryCall[] = [];
  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return queryResult(sql, params);
    },
    getRepository: () => ({ save: jest.fn(), find: jest.fn().mockResolvedValue([]) }),
  };
  const platform = {
    require: jest.fn().mockResolvedValue({ owner: true, permissions: ['analytics.read', 'telemetry.read'], universityIds: null, actorId: 'actor-1' }),
    assertUniversityScope: jest.fn(),
  };
  const telemetry = { revokeSession: jest.fn(), revokeAllForUser: jest.fn(), recordEvent: jest.fn() };
  return { service: new PlatformAnalyticsService(db as never, platform as never, telemetry as never), calls };
}

describe('PlatformAnalyticsService', () => {
  it('rejects an inverted period instead of guessing a range', async () => {
    const { service } = create(() => []);
    await expect(service.overview({ from: '2026-05-10T00:00:00.000Z', to: '2026-05-01T00:00:00.000Z' })).rejects.toThrow(BadRequestException);
  });

  it('keeps a whole calendar day when the period end is a date without time', async () => {
    const { service, calls } = create(sql => sql.includes('count(*)::int AS total') ? [{ total: 0 }] : []);
    await service.events({ page: 1, limit: 25, from: '2026-05-01T00:00:00.000Z', to: '2026-05-02' } as never);
    const params = calls[0].params;
    const from = new Date(params[0] as string).getTime();
    const to = new Date(params[1] as string).getTime();
    expect(to - from).toBe(2 * 86_400_000);
  });

  it('binds search text as a parameter and escapes LIKE wildcards', async () => {
    const { service, calls } = create(() => [{ total: 0 }]);
    await service.events({ page: 1, limit: 25, q: '40%_\\' } as never);
    const params = calls[0].params;
    expect(params).toContain('%40\\%\\_\\\\%');
    expect(calls[0].sql).toContain('ESCAPE');
  });

  it('reports missing measurement sources instead of inventing values', async () => {
    const { service } = create(sql => {
      if (sql.includes('AS "totalUsers"')) {
        return [{ totalUsers: 0, activeUsers: 0, blockedUsers: 0, newUsers: 0, sessions: 0, sessionUsers: 0, activeNow: 0, logins: 0, failedLogins: 0, logouts: 0, loginUsers: 0, events: 0, errors: 0, requests: 0, avgDurationMs: 0, installs: 0, appOpens: 0, mobileUsers: 0 }];
      }
      if (sql.includes('AS cohort')) return [{ cohort: 0, logged: 0, activated: 0, oldCohort: 0, retained: 0 }];
      if (sql.includes('min("createdAt") FROM platform_events')) return [{ events: null, auth: null }];
      return [];
    });

    const result = await service.overview({ granularity: 'day' } as never);
    expect(result.totals.users.total).toBe(0);
    expect(result.totals.auth.successRate).toBeNull();
    expect(result.funnel.retention.available).toBe(false);
    expect(result.availability.find(item => item.key === 'downloads')?.available).toBe(false);
    expect(result.availability.find(item => item.key === 'ip_geography')?.available).toBe(false);
    expect(result.collectionStartedAt).toBeNull();
  });
});
