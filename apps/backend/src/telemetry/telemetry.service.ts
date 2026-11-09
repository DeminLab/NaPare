import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { createHmac, randomUUID } from 'node:crypto';

import { JsonObject } from '../common/types/json-value.type';
import { TenantContext } from '../common/tenant/tenant-context';
import { User } from '../users/entities/user.entity';
import { AuthEvent, AuthEventType, PlatformEvent, TelemetryCategory, TelemetrySeverity, TelemetrySource, UserSession } from './telemetry.entities';
import { normalizePath, sanitizeMetadata } from './telemetry-sanitize';
import { clientFromHeader, parseUserAgent } from './user-agent';

export interface TelemetryRequestContext {
  ip?: string | null;
  userAgent?: string | null;
  client?: TelemetrySource;
}

export interface AuthEventInput extends TelemetryRequestContext {
  type: AuthEventType;
  userId?: string | null;
  universityId?: string | null;
  sessionId?: string | null;
  emailHash?: string | null;
  metadata?: unknown;
}

export interface PlatformEventInput extends TelemetryRequestContext {
  source: TelemetrySource;
  category: TelemetryCategory;
  name: string;
  severity?: TelemetrySeverity;
  userId?: string | null;
  universityId?: string | null;
  sessionId?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  metadata?: unknown;
  createdAt?: Date;
}

const EVENT_RETENTION_DAYS = 180;
const AUTH_RETENTION_DAYS = 400;
const SESSION_RETENTION_DAYS = 400;
const MAX_BUFFER = 1000;

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly sessions: Repository<UserSession>;
  private readonly authEvents: Repository<AuthEvent>;
  private readonly platformEvents: Repository<PlatformEvent>;
  private buffer: PlatformEventInput[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly tenant: TenantContext,
  ) {
    this.sessions = db.getRepository(UserSession);
    this.authEvents = db.getRepository(AuthEvent);
    this.platformEvents = db.getRepository(PlatformEvent);
  }

  onModuleInit(): void {
    this.flushTimer = setInterval(() => { void this.flush(); }, 2000);
    this.flushTimer.unref?.();
    this.cleanupTimer = setInterval(() => { void this.purgeExpired().catch(() => this.logger.warn('Telemetry retention cleanup failed')); }, 3600000);
    this.cleanupTimer.unref?.();
    void this.purgeExpired().catch(() => this.logger.warn('Telemetry retention cleanup failed'));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.flush();
  }

  private withWrite<T>(tables: string[], callback: () => Promise<T>): Promise<T> {
    return this.tenant.runWithDatabaseAccess({ tables, universityIds: null, write: true, replaceActor: true }, callback);
  }

  private withRead<T>(tables: string[], callback: () => Promise<T>): Promise<T> {
    return this.tenant.runWithDatabaseAccess({ tables, universityIds: null, replaceActor: true }, callback);
  }

  private refreshTtlMs(): number {
    const value = this.config.get<string>('auth.jwt.refreshExpiration') ?? '30d';
    const match = /^([1-9]\d*)([smhdwy])$/i.exec(value.trim());
    if (!match) return 30 * 86400000;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const factor = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : unit === 'd' ? 86400000 : unit === 'w' ? 7 * 86400000 : 365 * 86400000;
    return amount * factor;
  }

  private emailFingerprint(email: string): string {
    const secret = this.config.get<string>('auth.jwt.secret') ?? 'napare-telemetry';
    return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
  }

  async createSession(user: Pick<User, 'id' | 'universityId'>, context: TelemetryRequestContext = {}): Promise<string | null> {
    const id = randomUUID();
    const parsed = parseUserAgent(context.userAgent);
    const client = context.client ?? parsed.client;
    try {
      await this.withWrite(['user_sessions'], () => this.sessions.insert({
        id,
        userId: user.id,
        universityId: user.universityId ?? null,
        client,
        device: parsed.device,
        os: parsed.os,
        browser: parsed.browser,
        ip: context.ip?.slice(0, 64) ?? null,
        userAgent: context.userAgent?.slice(0, 512) ?? null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
        metadata: null,
      }));
      return id;
    } catch (error) {
      this.logger.warn(`Session record was not created: ${error instanceof Error ? error.name : 'unknown error'}`);
      return null;
    }
  }

  async recordAuth(input: AuthEventInput): Promise<void> {
    const parsed = parseUserAgent(input.userAgent);
    const client = input.client ?? parsed.client;
    try {
      // TypeORM's deep partial type explodes on this enum-heavy insert shape.
      const row = {
        userId: input.userId ?? null,
        universityId: input.universityId ?? null,
        type: input.type,
        emailHash: input.emailHash ?? null,
        sessionId: input.sessionId ?? null,
        client,
        ip: input.ip?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        metadata: sanitizeMetadata(input.metadata),
        createdAt: new Date(),
      } as never;
      await this.withWrite(['auth_events'], () => this.authEvents.insert(row));
    } catch (error) {
      this.logger.warn(`Auth event was not recorded: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  fingerprint(email: string): string {
    return this.emailFingerprint(email);
  }

  /** Updates the sliding "last activity" marker at most once per five minutes. */
  async touchSession(sessionId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE user_sessions SET "lastSeenAt"=now() WHERE id=$1 AND "revokedAt" IS NULL AND "lastSeenAt"<now()-interval \'5 minutes\'',
        [sessionId],
      );
    } catch (error) {
      this.logger.debug(`Session touch skipped: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  async isSessionActive(sessionId: string, userId: string): Promise<boolean> {
    try {
      const rows = await this.withRead(['user_sessions'], () => this.db.query(
        'SELECT 1 FROM user_sessions WHERE id=$1 AND "userId"=$2 AND "revokedAt" IS NULL AND "expiresAt">now() LIMIT 1',
        [sessionId, userId],
      ));
      return rows.length > 0;
    } catch (error) {
      this.logger.warn(`Session validation failed: ${error instanceof Error ? error.name : 'unknown error'}`);
      return false;
    }
  }

  async listOwnSessions(userId: string) {
    return this.db.query(
      `SELECT id, client, device, os, browser, ip, "userAgent", "createdAt", "lastSeenAt", "expiresAt", "revokedAt", "revokeReason"
       FROM user_sessions WHERE "userId"=$1 ORDER BY "lastSeenAt" DESC LIMIT 50`,
      [userId],
    );
  }

  async revokeOwnSession(sessionId: string, userId: string, reason = 'Выход с устройства'): Promise<boolean> {
    const rows = await this.db.query(
      `UPDATE user_sessions SET "revokedAt"=now(), "revokedBy"=$2, "revokeReason"=$3
       WHERE id=$1 AND "userId"=$2 AND "revokedAt" IS NULL RETURNING id`,
      [sessionId, userId, reason.slice(0, 200)],
    );
    return rows.length > 0;
  }

  async revokeSession(sessionId: string, actorId: string, reason: string): Promise<boolean> {
    const rows = await this.withWrite(['user_sessions'], () => this.db.query(
      `UPDATE user_sessions SET "revokedAt"=now(), "revokedBy"=$2, "revokeReason"=$3
       WHERE id=$1 AND "revokedAt" IS NULL RETURNING id`,
      [sessionId, actorId, reason.slice(0, 200)],
    ));
    return rows.length > 0;
  }

  async revokeAllForUser(userId: string, actorId: string, reason: string): Promise<number> {
    try {
      const result = await this.withWrite(['user_sessions'], () => this.db.query(
        `UPDATE user_sessions SET "revokedAt"=now(), "revokedBy"=$2, "revokeReason"=$3
         WHERE "userId"=$1 AND "revokedAt" IS NULL`,
        [userId, actorId, reason.slice(0, 200)],
      ));
      return Array.isArray(result) ? result.length : 0;
    } catch (error) {
      this.logger.warn(`Session revocation failed: ${error instanceof Error ? error.name : 'unknown error'}`);
      return 0;
    }
  }

  async recordEvent(input: PlatformEventInput): Promise<void> {
    try {
      await this.withWrite(['platform_events'], () => this.platformEvents.insert(this.toRow(input) as never));
    } catch (error) {
      this.logger.warn(`Platform event was not recorded: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  enqueueEvent(input: PlatformEventInput): void {
    if (this.buffer.length >= MAX_BUFFER) this.buffer.shift();
    this.buffer.push(input);
    if (this.buffer.length >= 50) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.buffer.length) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, 100);
    try {
      await this.withWrite(['platform_events'], () => this.platformEvents.insert(batch.map(input => this.toRow(input)) as never));
    } catch (error) {
      this.logger.warn(`Platform event batch was not recorded: ${error instanceof Error ? error.name : 'unknown error'}`);
    } finally {
      this.flushing = false;
      if (this.buffer.length >= 50) void this.flush();
    }
  }

  private toRow(input: PlatformEventInput): Partial<PlatformEvent> {
    return {
      source: input.source,
      category: input.category,
      name: input.name.slice(0, 120),
      severity: input.severity ?? 'info',
      userId: input.userId ?? null,
      universityId: input.universityId ?? null,
      sessionId: input.sessionId ?? null,
      method: input.method?.slice(0, 12) ?? null,
      path: input.path ? normalizePath(input.path) : null,
      statusCode: input.statusCode ?? null,
      durationMs: input.durationMs ?? null,
      ip: input.ip?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      metadata: sanitizeMetadata(input.metadata),
      createdAt: input.createdAt ?? new Date(),
    };
  }

  clientFrom(requested: string | undefined, userAgent: string | null | undefined): TelemetrySource {
    return clientFromHeader(requested, userAgent);
  }

  async purgeExpired(): Promise<void> {
    await this.withWrite(['platform_events', 'auth_events', 'user_sessions'], async () => {
      await this.db.query(`DELETE FROM platform_events WHERE "createdAt" < now() - interval '${EVENT_RETENTION_DAYS} days'`);
      await this.db.query(`DELETE FROM auth_events WHERE "createdAt" < now() - interval '${AUTH_RETENTION_DAYS} days'`);
      await this.db.query(`DELETE FROM user_sessions WHERE "createdAt" < now() - interval '${SESSION_RETENTION_DAYS} days' AND ("revokedAt" IS NOT NULL OR "expiresAt" < now())`);
    });
  }
}
