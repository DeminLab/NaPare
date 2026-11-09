import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuditLog } from '../common/entities/audit-log.entity';
import { PlatformService } from '../platform/platform.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import {
  AnalyticsOverviewQueryDto,
  MonitoredUserQueryDto,
  SessionQueryDto,
  TelemetryEventQueryDto,
} from './platform-analytics.dto';

type Access = Awaited<ReturnType<PlatformService['access']>>;

const DAY = 86400000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface Range {
  from: Date;
  to: Date;
  displayTo: Date;
  granularity: 'day' | 'week' | 'month';
}

function parseDate(value: string, name: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${name} должен быть корректной датой`);
  return date;
}

function rangeOf(fromValue?: string, toValue?: string, granularity: 'day' | 'week' | 'month' = 'day'): Range {
  const now = new Date();
  const rawTo = toValue ? parseDate(toValue, 'to') : now;
  const dateOnly = !!toValue && DATE_ONLY.test(toValue);
  const displayTo = dateOnly ? new Date(rawTo.getTime() + DAY - 1) : rawTo;
  const from = fromValue ? parseDate(fromValue, 'from') : new Date(displayTo.getTime() - 29 * DAY);
  const to = new Date(rawTo.getTime() + (dateOnly ? DAY : 1));
  if (from >= to) throw new BadRequestException('Начало периода должно быть раньше конца');
  if (to.getTime() - from.getTime() > 400 * DAY) throw new BadRequestException('Период не может превышать 400 дней');
  return { from, to, displayTo, granularity };
}

const number = (value: unknown): number => Number(value ?? 0);
const iso = (value: unknown): string | null => value ? new Date(value as string).toISOString() : null;

@Injectable()
export class PlatformAnalyticsService {
  constructor(
    private readonly db: DataSource,
    private readonly platform: PlatformService,
    private readonly telemetry: TelemetryService,
  ) {}

  private async analyticsAccess(universityId?: string): Promise<Access> {
    const access = await this.platform.require('analytics.read');
    if (universityId) this.platform.assertUniversityScope(access, universityId);
    return access;
  }

  private async telemetryAccess(universityId?: string): Promise<Access> {
    const access = await this.platform.require('telemetry.read');
    if (universityId) this.platform.assertUniversityScope(access, universityId);
    return access;
  }

  async overview(query: AnalyticsOverviewQueryDto) {
    const access = await this.analyticsAccess(query.universityId);
    const range = rangeOf(query.from, query.to, query.granularity);
    const from = range.from, to = range.to, uni = query.universityId ?? null;
    const uniFilter = uni ? ' AND "universityId"=$3' : '';
    const base = [from, to, ...(uni ? [uni] : [])];
    const seriesParams = [from, to, range.granularity, ...(uni ? [uni] : [])];
    const seriesUni = uni ? ' AND "universityId"=$4' : '';

    const [series, totals, dimensions, roles, universities, features, paths, categories, funnel, collection] = await Promise.all([
      this.db.query(`
        WITH buckets AS (
          SELECT generate_series(date_trunc($3::text, $1::timestamp), date_trunc($3::text, ($2::timestamp - interval '1 microsecond')), ('1 ' || $3::text)::interval) AS bucket
        ), regs AS (
          SELECT date_trunc($3::text, "createdAt") AS bucket, count(*)::int AS value FROM users
          WHERE "createdAt">=$1 AND "createdAt"<$2${seriesUni} GROUP BY 1
        ), logins AS (
          SELECT date_trunc($3::text, "createdAt") AS bucket,
            count(*) FILTER (WHERE type='login_success')::int AS logins,
            count(*) FILTER (WHERE type='login_failed')::int AS failed
          FROM auth_events WHERE "createdAt">=$1 AND "createdAt"<$2${seriesUni} GROUP BY 1
        ), active AS (
          SELECT date_trunc($3::text, "createdAt") AS bucket, count(DISTINCT "userId")::int AS value
          FROM platform_events WHERE "createdAt">=$1 AND "createdAt"<$2 AND "userId" IS NOT NULL${seriesUni} GROUP BY 1
        ), events AS (
          SELECT date_trunc($3::text, "createdAt") AS bucket, count(*)::int AS total,
            count(*) FILTER (WHERE severity='error')::int AS errors
          FROM platform_events WHERE "createdAt">=$1 AND "createdAt"<$2${seriesUni} GROUP BY 1
        )
        SELECT to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS bucket,
          COALESCE(r.value,0)::int AS registrations, COALESCE(l.logins,0)::int AS logins,
          COALESCE(l.failed,0)::int AS "failedLogins", COALESCE(a.value,0)::int AS "activeUsers",
          COALESCE(e.total,0)::int AS events, COALESCE(e.errors,0)::int AS errors
        FROM buckets b
        LEFT JOIN regs r ON r.bucket=b.bucket
        LEFT JOIN logins l ON l.bucket=b.bucket
        LEFT JOIN active a ON a.bucket=b.bucket
        LEFT JOIN events e ON e.bucket=b.bucket
        ORDER BY b.bucket`, seriesParams),
      this.db.query(`
        SELECT
          (SELECT count(*) FROM users WHERE true${uniFilter})::int AS "totalUsers",
          (SELECT count(*) FROM users WHERE "isActive"${uniFilter})::int AS "activeUsers",
          (SELECT count(*) FROM users WHERE NOT "isActive"${uniFilter})::int AS "blockedUsers",
          (SELECT count(*) FROM users WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS "newUsers",
          (SELECT count(*) FROM user_sessions WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS sessions,
          (SELECT count(DISTINCT "userId") FROM user_sessions WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS "sessionUsers",
          (SELECT count(*) FROM user_sessions WHERE "revokedAt" IS NULL AND "expiresAt">now() AND "lastSeenAt">now()-interval '15 minutes'${uniFilter})::int AS "activeNow",
          (SELECT count(*) FROM auth_events WHERE type='login_success' AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS logins,
          (SELECT count(*) FROM auth_events WHERE type='login_failed' AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS "failedLogins",
          (SELECT count(*) FROM auth_events WHERE type IN ('logout','logout_all') AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS logouts,
          (SELECT count(DISTINCT "userId") FROM auth_events WHERE type='login_success' AND "userId" IS NOT NULL AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS "loginUsers",
          (SELECT count(*) FROM platform_events WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS events,
          (SELECT count(*) FROM platform_events WHERE severity='error' AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS errors,
          (SELECT count(*) FROM platform_events WHERE category='request' AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS requests,
          (SELECT COALESCE(round(avg("durationMs"))::int,0) FROM platform_events WHERE category='request' AND "durationMs" IS NOT NULL AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS "avgDurationMs",
          (SELECT count(DISTINCT metadata->>'installId') FROM platform_events WHERE source='android' AND metadata ? 'installId' AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS installs,
          (SELECT count(*) FROM platform_events WHERE source='android' AND name='app.open' AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS "appOpens",
          (SELECT count(DISTINCT "userId") FROM user_sessions WHERE client='android' AND "createdAt">=$1 AND "createdAt"<$2${uniFilter})::int AS "mobileUsers"`, base),
      this.db.query(`
        SELECT 'client' AS dimension, client AS key, count(*)::int AS sessions, count(DISTINCT "userId")::int AS users
        FROM user_sessions WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter} GROUP BY client
        UNION ALL
        SELECT 'device', device, count(*)::int, count(DISTINCT "userId")::int
        FROM user_sessions WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter} GROUP BY device
        UNION ALL
        SELECT 'os', os, count(*)::int, count(DISTINCT "userId")::int
        FROM user_sessions WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter} GROUP BY os
        UNION ALL
        SELECT 'browser', browser, count(*)::int, count(DISTINCT "userId")::int
        FROM user_sessions WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter} GROUP BY browser
        ORDER BY dimension, sessions DESC`, base),
      this.db.query(`SELECT role AS key, count(*)::int AS users FROM users WHERE true${uniFilter} GROUP BY role ORDER BY users DESC`, base),
      this.db.query(`
        SELECT u.id, u.name, u.city, count(DISTINCT s."userId")::int AS users, count(s.id)::int AS sessions,
          max(s."lastSeenAt") AS "lastSeenAt"
        FROM universities u
        LEFT JOIN user_sessions s ON s."universityId"=u.id AND s."createdAt">=$1 AND s."createdAt"<$2
        WHERE ($3::uuid IS NULL OR u.id=$3)
        GROUP BY u.id, u.name, u.city HAVING count(s.id)>0
        ORDER BY sessions DESC LIMIT 50`, [from, to, uni]),
      this.db.query(`
        SELECT name AS key, count(*)::int AS events, count(DISTINCT "userId")::int AS users
        FROM platform_events WHERE "createdAt">=$1 AND "createdAt"<$2 AND category IN ('ui','feature')${uniFilter}
        GROUP BY name ORDER BY events DESC LIMIT 15`, base),
      this.db.query(`
        SELECT path AS key, count(*)::int AS requests, count(DISTINCT "userId")::int AS users
        FROM platform_events WHERE "createdAt">=$1 AND "createdAt"<$2 AND category='request' AND path IS NOT NULL${uniFilter}
        GROUP BY path ORDER BY requests DESC LIMIT 15`, base),
      this.db.query(`
        SELECT category AS key, count(*)::int AS events, count(*) FILTER (WHERE severity='error')::int AS errors
        FROM platform_events WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter}
        GROUP BY category ORDER BY events DESC`, base),
      this.db.query(`
        WITH cohort AS (
          SELECT id, "createdAt" FROM users WHERE "createdAt">=$1 AND "createdAt"<$2${uniFilter}
        ), logged AS (
          SELECT DISTINCT a."userId" FROM auth_events a JOIN cohort c ON c.id=a."userId"
          WHERE a.type='login_success' AND a."createdAt">=c."createdAt" AND a."createdAt"<c."createdAt"+interval '7 days'
        ), activated AS (
          SELECT DISTINCT e."userId" FROM platform_events e JOIN cohort c ON c.id=e."userId"
          WHERE e.category<>'auth' AND e."createdAt">=c."createdAt" AND e."createdAt"<c."createdAt"+interval '7 days'
        ), old_cohort AS (
          SELECT id, "createdAt" FROM cohort WHERE "createdAt"<now()-interval '30 days'
        ), retained AS (
          SELECT DISTINCT e."userId" FROM platform_events e JOIN old_cohort c ON c.id=e."userId"
          WHERE e."createdAt">=c."createdAt"+interval '7 days' AND e."createdAt"<c."createdAt"+interval '30 days'
        )
        SELECT (SELECT count(*) FROM cohort)::int AS cohort, (SELECT count(*) FROM logged)::int AS logged,
          (SELECT count(*) FROM activated)::int AS activated, (SELECT count(*) FROM old_cohort)::int AS "oldCohort",
          (SELECT count(*) FROM retained)::int AS retained`, base),
      this.db.query(`SELECT (SELECT min("createdAt") FROM platform_events) AS events, (SELECT min("createdAt") FROM auth_events) AS auth`),
    ]);

    const t = totals[0] ?? {};
    const f = funnel[0] ?? {};
    const collectionStart = [collection[0]?.events, collection[0]?.auth].filter(Boolean).sort()[0] ?? null;
    const breakdown = (dimension: string) => dimensions
      .filter((row: { dimension: string }) => row.dimension === dimension)
      .map((row: { key: string; sessions: number; users: number }) => ({ key: row.key, sessions: number(row.sessions), users: number(row.users) }));
    const cohort = number(f.cohort), logged = number(f.logged), activated = number(f.activated);
    const oldCohort = number(f.oldCohort), retained = number(f.retained);
    const rate = (value: number, denominator: number) => denominator > 0 ? Math.round((value / denominator) * 1000) / 10 : null;

    return {
      version: 'napare-platform-analytics-v1',
      generatedAt: new Date().toISOString(),
      range: { from: from.toISOString(), to: range.displayTo.toISOString(), granularity: range.granularity },
      collectionStartedAt: collectionStart ? iso(collectionStart) : null,
      totals: {
        users: { total: number(t.totalUsers), active: number(t.activeUsers), blocked: number(t.blockedUsers), new: number(t.newUsers) },
        sessions: { total: number(t.sessions), users: number(t.sessionUsers), activeNow: number(t.activeNow) },
        auth: { logins: number(t.logins), failedLogins: number(t.failedLogins), logouts: number(t.logouts), loginUsers: number(t.loginUsers), successRate: rate(number(t.logins), number(t.logins) + number(t.failedLogins)) },
        events: { total: number(t.events), errors: number(t.errors), requests: number(t.requests), avgDurationMs: number(t.avgDurationMs) },
        mobile: { installs: number(t.installs), appOpens: number(t.appOpens), users: number(t.mobileUsers) },
      },
      series: series.map((row: Record<string, unknown>) => ({
        bucket: row.bucket,
        registrations: number(row.registrations),
        logins: number(row.logins),
        failedLogins: number(row.failedLogins),
        activeUsers: number(row.activeUsers),
        events: number(row.events),
        errors: number(row.errors),
      })),
      breakdowns: {
        clients: breakdown('client'), devices: breakdown('device'), os: breakdown('os'), browsers: breakdown('browser'),
        roles: roles.map((row: { key: string; users: number }) => ({ key: row.key, users: number(row.users) })),
        universities: universities.map((row: Record<string, unknown>) => ({
          id: row.id, name: row.name, city: row.city, users: number(row.users), sessions: number(row.sessions), lastSeenAt: iso(row.lastSeenAt),
        })),
        features: features.map((row: { key: string; events: number; users: number }) => ({ key: row.key, events: number(row.events), users: number(row.users) })),
        paths: paths.map((row: { key: string; requests: number; users: number }) => ({ key: row.key, requests: number(row.requests), users: number(row.users) })),
        categories: categories.map((row: { key: string; events: number; errors: number }) => ({ key: row.key, events: number(row.events), errors: number(row.errors) })),
      },
      funnel: {
        cohort,
        steps: [
          { key: 'registered', label: 'Регистрация', value: cohort, rate: cohort ? 100 : null },
          { key: 'first_login', label: 'Первый вход за 7 дней', value: logged, rate: rate(logged, cohort) },
          { key: 'activated', label: 'Действие в продукте за 7 дней', value: activated, rate: rate(activated, cohort) },
        ],
        retention: { cohort: oldCohort, retained, rate: rate(retained, oldCohort), available: oldCohort > 0 },
      },
      availability: [
        { key: 'sessions', available: true, reason: null },
        { key: 'installs', available: true, reason: 'Наблюдаемые установки Android-приложения по локальному installId; очистка данных браузера создаёт новую установку.' },
        { key: 'downloads', available: false, reason: 'Нет подключённого источника RuStore/Google Play. Скачивания магазинов не измеряются.' },
        { key: 'ip_geography', available: false, reason: 'Геолокация по IP не подключена. География построена по городам университетов.' },
        { key: 'retention', available: oldCohort > 0, reason: oldCohort > 0 ? null : 'Нужна когорта пользователей старше 30 дней и накопленные события.' },
      ],
      limitations: [
        'Учитываются только события, записанные после подключения телеметрии; история до этого момента не восстанавливается.',
        'Активность — это обращения к API и клиентские события, а не время за экраном и не подтверждение внимания.',
        'Удаление аккаунта удаляет его сессии и технические события; агрегаты прошлых периодов могут измениться.',
        'Технические события хранятся 180 дней, входы и сессии — 400 дней, затем удаляются автоматически.',
      ],
      scope: { universityIds: access.universityIds },
    };
  }

  async events(query: TelemetryEventQueryDto) {
    await this.telemetryAccess(query.universityId);
    const range = rangeOf(query.from, query.to);
    const params: unknown[] = [range.from, range.to];
    const filters: string[] = ['e."createdAt">=$1', 'e."createdAt"<$2'];
    if (query.universityId) { params.push(query.universityId); filters.push(`e."universityId"=$${params.length}`); }
    for (const [column, value] of [['category', query.category], ['source', query.source], ['severity', query.severity], ['name', query.name], ['userId', query.userId]] as const) {
      if (!value) continue;
      params.push(value);
      filters.push(`e."${column}"=$${params.length}`);
    }
    if (query.q?.trim()) {
      params.push(`%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`);
      filters.push(`(e.name ILIKE $${params.length} ESCAPE E'\\\\' OR e.path ILIKE $${params.length} ESCAPE E'\\\\' OR e."userId"::text ILIKE $${params.length} ESCAPE E'\\\\' OR e.ip ILIKE $${params.length} ESCAPE E'\\\\')`);
    }
    const where = filters.join(' AND ');
    const countParams = [...params];
    const totalRows = await this.db.query(`SELECT count(*)::int AS total FROM platform_events e WHERE ${where}`, countParams);
    params.push(query.limit, (query.page - 1) * query.limit);
    const rows = await this.db.query(`
      SELECT e.id, e.source, e.category, e.name, e.severity, e."userId", e."universityId", e."sessionId",
        e.method, e.path, e."statusCode", e."durationMs", e.ip, e."userAgent", e.metadata, e."createdAt",
        u.email, u."firstName", u."lastName", u.role
      FROM platform_events e LEFT JOIN users u ON u.id=e."userId"
      WHERE ${where}
      ORDER BY e."createdAt" DESC, e.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return {
      data: rows.map((row: Record<string, unknown>) => ({
        id: row.id, source: row.source, category: row.category, name: row.name, severity: row.severity,
        userId: row.userId, universityId: row.universityId, sessionId: row.sessionId,
        method: row.method, path: row.path, statusCode: row.statusCode, durationMs: row.durationMs,
        ip: row.ip, userAgent: row.userAgent, metadata: row.metadata, createdAt: iso(row.createdAt),
        user: row.email ? { id: row.userId, email: row.email, firstName: row.firstName, lastName: row.lastName, role: row.role } : null,
      })),
      meta: { page: query.page, limit: query.limit, total: number(totalRows[0]?.total), totalPages: Math.ceil(number(totalRows[0]?.total) / query.limit) },
    };
  }

  async eventFacets(query: TelemetryEventQueryDto) {
    await this.telemetryAccess(query.universityId);
    const range = rangeOf(query.from, query.to);
    const params: unknown[] = [range.from, range.to];
    const filters = ['"createdAt">=$1', '"createdAt"<$2'];
    if (query.universityId) { params.push(query.universityId); filters.push(`"universityId"=$${params.length}`); }
    const where = filters.join(' AND ');
    const [categories, sources, severities, names] = await Promise.all([
      this.db.query(`SELECT category AS key, count(*)::int AS count FROM platform_events WHERE ${where} GROUP BY category ORDER BY count DESC`, params),
      this.db.query(`SELECT source AS key, count(*)::int AS count FROM platform_events WHERE ${where} GROUP BY source ORDER BY count DESC`, params),
      this.db.query(`SELECT severity AS key, count(*)::int AS count FROM platform_events WHERE ${where} GROUP BY severity ORDER BY count DESC`, params),
      this.db.query(`SELECT name AS key, count(*)::int AS count FROM platform_events WHERE ${where} GROUP BY name ORDER BY count DESC LIMIT 25`, params),
    ]);
    return { categories, sources, severities, names };
  }

  async users(query: MonitoredUserQueryDto) {
    const access = await this.telemetryAccess(query.universityId);
    const params: unknown[] = [];
    const filters: string[] = ['1=1'];
    if (query.q?.trim()) {
      params.push(`%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`);
      filters.push(`(u.email ILIKE $${params.length} ESCAPE E'\\\\' OR u."firstName" ILIKE $${params.length} ESCAPE E'\\\\' OR u."lastName" ILIKE $${params.length} ESCAPE E'\\\\' OR u.phone ILIKE $${params.length} ESCAPE E'\\\\' OR u.id::text ILIKE $${params.length} ESCAPE E'\\\\')`);
    }
    if (query.role) { params.push(query.role); filters.push(`u.role=$${params.length}`); }
    if (query.status) filters.push(query.status === 'active' ? 'u."isActive"' : 'NOT u."isActive"');
    if (query.universityId) { params.push(query.universityId); filters.push(`u."universityId"=$${params.length}`); }
    if (access.universityIds !== null) {
      if (!access.universityIds.length) filters.push('1=0');
      else { params.push(access.universityIds); filters.push(`u."universityId"=ANY($${params.length}::uuid[])`); }
    }
    const where = filters.join(' AND ');
    const countRows = await this.db.query(`SELECT count(*)::int AS total FROM users u WHERE ${where}`, params);
    const listParams = [...params, query.limit, (query.page - 1) * query.limit];
    const rows = await this.db.query(`
      SELECT u.id, u.email, u."firstName", u."lastName", u.phone, u.role, u."universityId", u."isActive",
        u."lastLoginAt", u."createdAt", un.name AS "universityName", un.city AS "universityCity",
        s."lastSeenAt", COALESCE(s."activeSessions",0)::int AS "activeSessions", COALESCE(s."sessionCount",0)::int AS "sessionCount",
        COALESCE(a."loginCount",0)::int AS "loginCount", a."lastAuthAt"
      FROM users u
      LEFT JOIN universities un ON un.id=u."universityId"
      LEFT JOIN LATERAL (
        SELECT max("lastSeenAt") AS "lastSeenAt",
          count(*) FILTER (WHERE "revokedAt" IS NULL AND "expiresAt">now())::int AS "activeSessions",
          count(*)::int AS "sessionCount"
        FROM user_sessions WHERE "userId"=u.id
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS "loginCount", max("createdAt") AS "lastAuthAt"
        FROM auth_events WHERE "userId"=u.id AND type='login_success'
      ) a ON true
      WHERE ${where}
      ORDER BY COALESCE(s."lastSeenAt", u."lastLoginAt", u."createdAt") DESC, u.id ASC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
    const total = number(countRows[0]?.total);
    return {
      data: rows.map((row: Record<string, unknown>) => ({
        id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, phone: row.phone,
        role: row.role, universityId: row.universityId, isActive: row.isActive,
        lastLoginAt: iso(row.lastLoginAt), createdAt: iso(row.createdAt),
        university: row.universityName ? { name: row.universityName, city: row.universityCity } : null,
        lastSeenAt: iso(row.lastSeenAt), lastAuthAt: iso(row.lastAuthAt),
        activeSessions: number(row.activeSessions), sessionCount: number(row.sessionCount), loginCount: number(row.loginCount),
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async userActivity(id: string) {
    const access = await this.telemetryAccess();
    const [user] = await this.db.query(`
      SELECT u.id, u.email, u."firstName", u."lastName", u.phone, u.role, u."universityId", u."isActive",
        u."lastLoginAt", u."createdAt", u."updatedAt", un.name AS "universityName", un.city AS "universityCity"
      FROM users u LEFT JOIN universities un ON un.id=u."universityId" WHERE u.id=$1`, [id]);
    if (!user) throw new NotFoundException('Аккаунт не найден.');
    this.platform.assertUniversityScope(access, user.universityId);
    const [sessions, authEvents, events, summary] = await Promise.all([
      this.db.query(`SELECT id, client, device, os, browser, ip, "userAgent", "createdAt", "lastSeenAt", "expiresAt", "revokedAt", "revokeReason"
        FROM user_sessions WHERE "userId"=$1 ORDER BY "lastSeenAt" DESC LIMIT 50`, [id]),
      this.db.query(`SELECT id, type, client, ip, "userAgent", "sessionId", metadata, "createdAt"
        FROM auth_events WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, [id]),
      this.db.query(`SELECT id, source, category, name, severity, method, path, "statusCode", "durationMs", metadata, "createdAt"
        FROM platform_events WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, [id]),
      this.db.query(`SELECT
        (SELECT count(*) FROM user_sessions WHERE "userId"=$1)::int AS sessions,
        (SELECT count(*) FROM user_sessions WHERE "userId"=$1 AND "revokedAt" IS NULL AND "expiresAt">now())::int AS "activeSessions",
        (SELECT count(*) FROM auth_events WHERE "userId"=$1 AND type='login_success')::int AS logins,
        (SELECT count(*) FROM auth_events WHERE "userId"=$1 AND type='login_failed')::int AS "failedLogins",
        (SELECT count(*) FROM platform_events WHERE "userId"=$1)::int AS events,
        (SELECT count(*) FROM platform_events WHERE "userId"=$1 AND severity='error')::int AS errors,
        (SELECT max("createdAt") FROM platform_events WHERE "userId"=$1) AS "lastActivity"`, [id]),
    ]);
    const audit = access.owner || access.permissions.includes('audit.read')
      ? await this.db.getRepository(AuditLog).find({ where: { entity: 'platform', entityId: id }, order: { createdAt: 'DESC', id: 'DESC' }, take: 20 })
      : [];
    return {
      user: {
        id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone,
        role: user.role, universityId: user.universityId, isActive: user.isActive,
        lastLoginAt: iso(user.lastLoginAt), createdAt: iso(user.createdAt), updatedAt: iso(user.updatedAt),
        university: user.universityName ? { name: user.universityName, city: user.universityCity } : null,
      },
      summary: {
        sessions: number(summary[0]?.sessions), activeSessions: number(summary[0]?.activeSessions),
        logins: number(summary[0]?.logins), failedLogins: number(summary[0]?.failedLogins),
        events: number(summary[0]?.events), errors: number(summary[0]?.errors),
        lastActivity: iso(summary[0]?.lastActivity) ?? iso(sessions[0]?.lastSeenAt) ?? iso(user.lastLoginAt),
      },
      sessions: sessions.map((row: Record<string, unknown>) => ({ ...row, createdAt: iso(row.createdAt), lastSeenAt: iso(row.lastSeenAt), expiresAt: iso(row.expiresAt), revokedAt: iso(row.revokedAt) })),
      authEvents: authEvents.map((row: Record<string, unknown>) => ({ ...row, createdAt: iso(row.createdAt) })),
      events: events.map((row: Record<string, unknown>) => ({ ...row, createdAt: iso(row.createdAt) })),
      audit: audit.map(entry => ({ id: entry.id, action: entry.action, actorId: entry.userId, createdAt: entry.createdAt, oldValues: entry.oldValues, newValues: entry.newValues })),
    };
  }

  async sessions(query: SessionQueryDto) {
    const access = await this.telemetryAccess(query.universityId);
    const params: unknown[] = [];
    const filters = ['1=1'];
    if (query.userId) { params.push(query.userId); filters.push(`s."userId"=$${params.length}`); }
    if (query.client) { params.push(query.client); filters.push(`s.client=$${params.length}`); }
    if (query.universityId) { params.push(query.universityId); filters.push(`s."universityId"=$${params.length}`); }
    if (query.active === 'true') filters.push(`s."revokedAt" IS NULL AND s."expiresAt">now()`);
    if (query.active === 'false') filters.push(`(s."revokedAt" IS NOT NULL OR s."expiresAt"<=now())`);
    if (access.universityIds !== null) {
      if (!access.universityIds.length) filters.push('1=0');
      else { params.push(access.universityIds); filters.push(`s."universityId"=ANY($${params.length}::uuid[])`); }
    }
    const where = filters.join(' AND ');
    const countRows = await this.db.query(`SELECT count(*)::int AS total FROM user_sessions s WHERE ${where}`, params);
    const listParams = [...params, query.limit, (query.page - 1) * query.limit];
    const rows = await this.db.query(`
      SELECT s.id, s."userId", s.client, s.device, s.os, s.browser, s.ip, s."userAgent", s."createdAt",
        s."lastSeenAt", s."expiresAt", s."revokedAt", s."revokeReason",
        u.email, u."firstName", u."lastName", u.role
      FROM user_sessions s LEFT JOIN users u ON u.id=s."userId"
      WHERE ${where} ORDER BY s."lastSeenAt" DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
    const total = number(countRows[0]?.total);
    return {
      data: rows.map((row: Record<string, unknown>) => ({
        ...row,
        createdAt: iso(row.createdAt), lastSeenAt: iso(row.lastSeenAt), expiresAt: iso(row.expiresAt), revokedAt: iso(row.revokedAt),
        user: row.email ? { id: row.userId, email: row.email, firstName: row.firstName, lastName: row.lastName, role: row.role } : null,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async revokeSession(id: string, reason: string, context: { ip?: string; userAgent?: string }) {
    const access = await this.platform.require('accounts.write');
    const [session] = await this.db.query('SELECT id, "userId", "universityId" FROM user_sessions WHERE id=$1', [id]);
    if (!session) throw new NotFoundException('Сессия не найдена.');
    this.platform.assertUniversityScope(access, session.universityId);
    const changed = await this.telemetry.revokeSession(id, access.actorId, reason);
    if (changed) {
      await this.db.getRepository(AuditLog).save({
        userId: access.actorId, action: 'platform.session.revoked', entity: 'platform', entityId: session.userId,
        newValues: { sessionId: id, targetUserId: session.userId, universityId: session.universityId ?? null, reason: reason.trim(), result: 'session_revoked' },
        ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
      });
      await this.telemetry.recordEvent({
        source: 'backend', category: 'admin', name: 'admin.session_revoked', severity: 'warning',
        userId: access.actorId, universityId: session.universityId ?? null, sessionId: id,
        ip: context.ip ?? null, userAgent: context.userAgent ?? null,
        metadata: { targetUserId: session.userId, reason: reason.trim() },
      });
    }
    return { changed };
  }

  async revokeUserSessions(userId: string, reason: string, context: { ip?: string; userAgent?: string }) {
    const access = await this.platform.require('accounts.write');
    const [user] = await this.db.query('SELECT id, "universityId" FROM users WHERE id=$1', [userId]);
    if (!user) throw new NotFoundException('Аккаунт не найден.');
    this.platform.assertUniversityScope(access, user.universityId);
    const revoked = await this.telemetry.revokeAllForUser(userId, access.actorId, reason);
    await this.db.getRepository(AuditLog).save({
      userId: access.actorId, action: 'platform.account.sessions_revoked', entity: 'platform', entityId: userId,
      newValues: { targetUserId: userId, universityId: user.universityId ?? null, reason: reason.trim(), result: 'sessions_revoked', revoked },
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    });
    await this.telemetry.recordEvent({
      source: 'backend', category: 'admin', name: 'admin.sessions_revoked', severity: 'warning',
      userId: access.actorId, universityId: user.universityId ?? null,
      ip: context.ip ?? null, userAgent: context.userAgent ?? null,
      metadata: { targetUserId: userId, reason: reason.trim(), revoked },
    });
    return { changed: true, revoked };
  }
}
