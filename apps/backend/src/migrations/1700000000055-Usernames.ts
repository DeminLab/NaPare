import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds administrator-assigned sign-in names. Existing accounts deliberately
 * remain username-less so admins can choose identifiers instead of silently
 * deriving them from private email addresses. Such accounts cannot password
 * login until an admin assigns a username.
 */
export class Usernames1700000000055 implements MigrationInterface {
  name = 'Usernames1700000000055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(32)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_username_ci" ON "users" (LOWER("username")) WHERE "username" IS NOT NULL`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.napare_auth_allows(user_id text, email text, username text, max_id text, organization_id text, writing boolean)
      RETURNS boolean LANGUAGE sql STABLE AS $function$
        SELECT COALESCE(
          (user_id = NULLIF(current_setting('app.actor_id', true), '') AND (NOT writing OR (organization_id IS NULL AND NULLIF(current_setting('app.organization_id', true), '') IS NULL)))
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access', true), ''), '[]')::jsonb) capability
            WHERE capability ? 'authentication'
              AND (NOT writing OR capability->'authentication'->>'write' = 'true')
              AND (
                user_id = capability->'authentication'->>'id'
                OR (NOT writing AND email IS NOT NULL AND LOWER(email) = LOWER(capability->'authentication'->>'email'))
                OR (NOT writing AND username IS NOT NULL AND LOWER(username) = LOWER(capability->'authentication'->>'username'))
                OR (NOT writing AND max_id = capability->'authentication'->>'maxUserId')
              )
          ), false)
      $function$;

      DO $block$
      DECLARE policy record; policy_using text; policy_check text;
      BEGIN
        FOR policy IN
          SELECT policyname, cmd, qual, with_check
          FROM pg_policies
          WHERE schemaname = current_schema() AND tablename = 'users'
            AND policyname IN ('napare_tenant_select', 'napare_tenant_insert', 'napare_tenant_update', 'napare_tenant_delete')
        LOOP
          policy_using := replace(policy.qual,
            'napare_auth_allows(id::text, email::text, "maxUserId"::text,',
            'napare_auth_allows(id::text, email::text, username::text, "maxUserId"::text,');
          policy_check := replace(policy.with_check,
            'napare_auth_allows(id::text, email::text, "maxUserId"::text,',
            'napare_auth_allows(id::text, email::text, username::text, "maxUserId"::text,');
          EXECUTE format('DROP POLICY %I ON %I.users', policy.policyname, current_schema());
          IF policy.cmd = 'SELECT' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR SELECT USING (%s)', policy.policyname, current_schema(), policy_using);
          ELSIF policy.cmd = 'INSERT' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR INSERT WITH CHECK (%s)', policy.policyname, current_schema(), policy_check);
          ELSIF policy.cmd = 'UPDATE' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR UPDATE USING (%s) WITH CHECK (%s)', policy.policyname, current_schema(), policy_using, policy_check);
          ELSIF policy.cmd = 'DELETE' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR DELETE USING (%s)', policy.policyname, current_schema(), policy_using);
          END IF;
        END LOOP;
      END $block$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $block$
      DECLARE policy record; policy_using text; policy_check text;
      BEGIN
        FOR policy IN
          SELECT policyname, cmd, qual, with_check
          FROM pg_policies
          WHERE schemaname = current_schema() AND tablename = 'users'
            AND policyname IN ('napare_tenant_select', 'napare_tenant_insert', 'napare_tenant_update', 'napare_tenant_delete')
        LOOP
          policy_using := replace(policy.qual,
            'napare_auth_allows(id::text, email::text, username::text, "maxUserId"::text,',
            'napare_auth_allows(id::text, email::text, "maxUserId"::text,');
          policy_check := replace(policy.with_check,
            'napare_auth_allows(id::text, email::text, username::text, "maxUserId"::text,',
            'napare_auth_allows(id::text, email::text, "maxUserId"::text,');
          EXECUTE format('DROP POLICY %I ON %I.users', policy.policyname, current_schema());
          IF policy.cmd = 'SELECT' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR SELECT USING (%s)', policy.policyname, current_schema(), policy_using);
          ELSIF policy.cmd = 'INSERT' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR INSERT WITH CHECK (%s)', policy.policyname, current_schema(), policy_check);
          ELSIF policy.cmd = 'UPDATE' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR UPDATE USING (%s) WITH CHECK (%s)', policy.policyname, current_schema(), policy_using, policy_check);
          ELSIF policy.cmd = 'DELETE' THEN
            EXECUTE format('CREATE POLICY %I ON %I.users AS RESTRICTIVE FOR DELETE USING (%s)', policy.policyname, current_schema(), policy_using);
          END IF;
        END LOOP;
      END $block$;
      DROP FUNCTION IF EXISTS public.napare_auth_allows(text, text, text, text, text, boolean);
      DROP INDEX IF EXISTS "UQ_users_username_ci";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "username";
    `);
  }
}
