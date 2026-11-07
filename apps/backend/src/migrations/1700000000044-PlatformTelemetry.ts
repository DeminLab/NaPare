import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform-wide authentication sessions and technical event journal.
 *
 * These tables are written by the trusted telemetry service only. Tenant row
 * security still limits reads to the actor's university, while a user can
 * always read and revoke their own sessions.
 */
export class PlatformTelemetry1700000000044 implements MigrationInterface {
  name = 'PlatformTelemetry1700000000044';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id uuid PRIMARY KEY,
        "userId" uuid NOT NULL,
        "universityId" uuid NULL,
        client varchar NOT NULL DEFAULT 'web',
        device varchar NOT NULL DEFAULT 'unknown',
        os varchar NOT NULL DEFAULT 'unknown',
        browser varchar NOT NULL DEFAULT 'unknown',
        ip varchar(64) NULL,
        "userAgent" varchar(512) NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "lastSeenAt" timestamp NOT NULL DEFAULT now(),
        "expiresAt" timestamp NOT NULL,
        "revokedAt" timestamp NULL,
        "revokedBy" uuid NULL,
        "revokeReason" varchar(200) NULL,
        metadata jsonb NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_user_created" ON user_sessions ("userId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_scope_seen" ON user_sessions ("universityId", "lastSeenAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_active" ON user_sessions ("lastSeenAt") WHERE "revokedAt" IS NULL;

      CREATE TABLE IF NOT EXISTS auth_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NULL,
        "universityId" uuid NULL,
        type varchar NOT NULL,
        "emailHash" varchar(64) NULL,
        "sessionId" uuid NULL,
        client varchar NOT NULL DEFAULT 'web',
        ip varchar(64) NULL,
        "userAgent" varchar(512) NULL,
        metadata jsonb NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_auth_events_created" ON auth_events ("createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_auth_events_user_created" ON auth_events ("userId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_auth_events_type_created" ON auth_events (type, "createdAt" DESC);

      CREATE TABLE IF NOT EXISTS platform_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source varchar NOT NULL DEFAULT 'backend',
        category varchar NOT NULL DEFAULT 'system',
        name varchar NOT NULL,
        severity varchar NOT NULL DEFAULT 'info',
        "userId" uuid NULL,
        "universityId" uuid NULL,
        "sessionId" uuid NULL,
        method varchar(12) NULL,
        path varchar(300) NULL,
        "statusCode" integer NULL,
        "durationMs" integer NULL,
        ip varchar(64) NULL,
        "userAgent" varchar(512) NULL,
        metadata jsonb NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_platform_events_created" ON platform_events ("createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_platform_events_scope_created" ON platform_events ("universityId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_platform_events_category_created" ON platform_events (category, "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_platform_events_user_created" ON platform_events ("userId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_platform_events_name_created" ON platform_events (name, "createdAt" DESC);
    `);

    const foreignKeys: Array<[string, string, string, string, string]> = [
      ['user_sessions', 'userId', 'users', 'id', 'CASCADE'],
      ['user_sessions', 'universityId', 'universities', 'id', 'SET NULL'],
      ['user_sessions', 'revokedBy', 'users', 'id', 'SET NULL'],
      ['auth_events', 'userId', 'users', 'id', 'CASCADE'],
      ['auth_events', 'universityId', 'universities', 'id', 'SET NULL'],
      ['platform_events', 'userId', 'users', 'id', 'SET NULL'],
      ['platform_events', 'universityId', 'universities', 'id', 'SET NULL'],
    ];
    for (const [table, column, target, key, onDelete] of foreignKeys) {
      const name = `FK_${table}_${column}`;
      await runner.query(`DO $fk$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='${table}'::regclass AND conname='${name}') THEN
          ALTER TABLE ${table} ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES ${target}("${key}") ON DELETE ${onDelete};
        END IF;
      END $fk$;`);
    }

    for (const [table, selfPredicate] of [
      ['user_sessions', `("userId"::text = NULLIF(current_setting('app.actor_id', true), ''))`],
      ['auth_events', `("userId"::text = NULLIF(current_setting('app.actor_id', true), ''))`],
      ['platform_events', `("userId"::text = NULLIF(current_setting('app.actor_id', true), ''))`],
    ] as const) {
      await runner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS napare_tenant_base ON ${table};
        CREATE POLICY napare_tenant_base ON ${table} AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);`);
      for (const [name, verb] of [['select', 'SELECT'], ['insert', 'INSERT'], ['update', 'UPDATE'], ['delete', 'DELETE']] as const) {
        const ordinary = `public.napare_tenant_allows('${table}',"universityId"::text,${name !== 'select'})`;
        const predicate = name === 'select' ? `(${ordinary} OR ${selfPredicate})`
          : name === 'insert' ? ordinary
            : `(${ordinary} OR ${selfPredicate})`;
        const using = name === 'insert' ? '' : ` USING (${predicate})`;
        const check = name === 'insert' || name === 'update' ? ` WITH CHECK (${predicate})` : '';
        await runner.query(`DROP POLICY IF EXISTS napare_tenant_${name} ON ${table};
          CREATE POLICY napare_tenant_${name} ON ${table} AS RESTRICTIVE FOR ${verb}${using}${check}`);
      }
      await runner.query(`DROP TRIGGER IF EXISTS napare_active_writer ON ${table};
        CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer()`);
    }
  }

  async down(): Promise<void> {
    throw new Error('Session and event history require an explicit retention migration; automatic destructive rollback is disabled');
  }
}
