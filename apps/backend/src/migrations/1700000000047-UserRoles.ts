import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-0009 expand step: `user_role` memberships.
 *
 *  - creates the membership table (canonical "organizationId", wider role check
 *    constraint than the backend enum, unique per user/organization/role) with
 *    FORCE row security and the migration-29 policy shape;
 *  - backfills exactly one membership per existing account with an
 *    organization, so no legacy role is lost (TZ 15.1 expand/migrate);
 *  - down() restores `users.role` from the memberships first (they are the
 *    source of truth on the dual-write window) and only then drops the table.
 *
 * Idempotent: CREATE ... IF NOT EXISTS, ON CONFLICT DO NOTHING and
 * DROP POLICY IF EXISTS, so dev/test may execute it after synchronize.
 * `users.role` itself is the contract step of a later release (ADR-0009).
 */
const ROLE_VALUES = [
  'student', 'group_leader', 'teacher', 'curator', 'registrar', 'dorm_manager',
  'practice_supervisor', 'parent', 'faculty_dean', 'department_head',
  'university_admin', 'developer', 'superadmin',
  'employer', 'career_staff', 'career_admin',
].map(role => `'${role}'`).join(',');

export class UserRoles1700000000047 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_role" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "organizationId" uuid NOT NULL REFERENCES universities(id),
        "role" varchar NOT NULL CHECK ("role" IN (${ROLE_VALUES})),
        "scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_role_membership" UNIQUE ("userId", "organizationId", "role")
      );
    `);

    await queryRunner.query(`
      DO $block$
      DECLARE had_rls boolean; had_force boolean; role_rls boolean; role_force boolean;
      BEGIN
        -- The backfill selects from users, and migration 29 forces row security
        -- on it: a migration session has no tenant GUC, so every row would be
        -- hidden and the backfill would silently lose all roles. Suspend row
        -- security for the backfill only and restore its prior state (on a
        -- re-run user_role itself is already covered by FORCE row security).
        SELECT cls.relrowsecurity, cls.relforcerowsecurity INTO had_rls, had_force
          FROM pg_catalog.pg_class cls WHERE cls.oid = to_regclass('users');
        IF had_rls THEN
          ALTER TABLE users DISABLE ROW LEVEL SECURITY;
        END IF;
        SELECT cls.relrowsecurity, cls.relforcerowsecurity INTO role_rls, role_force
          FROM pg_catalog.pg_class cls WHERE cls.oid = to_regclass('user_role');
        IF role_rls THEN
          ALTER TABLE "user_role" DISABLE ROW LEVEL SECURITY;
        END IF;
        INSERT INTO "user_role" ("userId", "organizationId", role)
        SELECT id, "organizationId", role::text FROM users
        WHERE "organizationId" IS NOT NULL AND role IS NOT NULL
        ON CONFLICT DO NOTHING;
        IF role_rls THEN
          ALTER TABLE "user_role" ENABLE ROW LEVEL SECURITY;
          IF role_force THEN
            ALTER TABLE "user_role" FORCE ROW LEVEL SECURITY;
          END IF;
        END IF;
        IF had_rls THEN
          ALTER TABLE users ENABLE ROW LEVEL SECURITY;
          IF had_force THEN
            ALTER TABLE users FORCE ROW LEVEL SECURITY;
          END IF;
        END IF;
      END $block$;
    `);

    await queryRunner.query(`
      ALTER TABLE "user_role" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "user_role" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS napare_tenant_base ON "user_role";
      DROP POLICY IF EXISTS napare_tenant_select ON "user_role";
      DROP POLICY IF EXISTS napare_tenant_insert ON "user_role";
      DROP POLICY IF EXISTS napare_tenant_update ON "user_role";
      DROP POLICY IF EXISTS napare_tenant_delete ON "user_role";
      CREATE POLICY napare_tenant_base ON "user_role" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY napare_tenant_select ON "user_role" AS RESTRICTIVE FOR SELECT
        USING (public.napare_tenant_allows('user_role', "organizationId"::text, false));
      CREATE POLICY napare_tenant_insert ON "user_role" AS RESTRICTIVE FOR INSERT
        WITH CHECK (public.napare_tenant_allows('user_role', "organizationId"::text, true));
      CREATE POLICY napare_tenant_update ON "user_role" AS RESTRICTIVE FOR UPDATE
        USING (public.napare_tenant_allows('user_role', "organizationId"::text, false))
        WITH CHECK (public.napare_tenant_allows('user_role', "organizationId"::text, true));
      CREATE POLICY napare_tenant_delete ON "user_role" AS RESTRICTIVE FOR DELETE
        USING (public.napare_tenant_allows('user_role', "organizationId"::text, true));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $block$
      DECLARE had_rls boolean; had_force boolean;
      BEGIN
        IF to_regclass('user_role') IS NULL THEN
          RETURN;
        END IF;
        -- The memberships are the source of truth during the dual-write
        -- window: restore the legacy mirror before dropping them. Row security
        -- would hide every user row from this migration session.
        SELECT cls.relrowsecurity, cls.relforcerowsecurity INTO had_rls, had_force
          FROM pg_catalog.pg_class cls WHERE cls.oid = to_regclass('users');
        IF had_rls THEN
          ALTER TABLE users DISABLE ROW LEVEL SECURITY;
        END IF;
        UPDATE users u SET role = (
          SELECT ur.role::text::users_role_enum FROM user_role ur
          WHERE ur."userId" = u.id
            AND (u."organizationId" IS NULL OR ur."organizationId" = u."organizationId")
          ORDER BY (ur."organizationId" = u."organizationId") DESC, ur."updatedAt" DESC
          LIMIT 1
        )
        WHERE EXISTS (SELECT 1 FROM user_role ur WHERE ur."userId" = u.id);
        IF had_rls THEN
          ALTER TABLE users ENABLE ROW LEVEL SECURITY;
          IF had_force THEN
            ALTER TABLE users FORCE ROW LEVEL SECURITY;
          END IF;
        END IF;
        DROP TABLE "user_role";
      END $block$;
    `);
  }
}
