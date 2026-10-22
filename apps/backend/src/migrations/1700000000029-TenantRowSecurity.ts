import { MigrationInterface, QueryRunner } from 'typeorm';

/** Database defence in depth; the application role must be NOSUPERUSER NOBYPASSRLS. */
export class TenantRowSecurity1700000000029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.napare_tenant_allows(table_name text, university_id text, writing boolean)
      RETURNS boolean LANGUAGE sql STABLE AS $function$
        SELECT COALESCE(
          university_id = NULLIF(current_setting('app.university_id', true), '')
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access', true), ''), '[]')::jsonb) capability
            WHERE capability->'tables' ? table_name
              AND (NOT writing OR capability->>'write' = 'true')
              AND (capability->'universityIds' = 'null'::jsonb OR capability->'universityIds' ? university_id)
          ), false)
      $function$;
      CREATE OR REPLACE FUNCTION public.napare_auth_allows(user_id text, email text, max_id text, university_id text, writing boolean)
      RETURNS boolean LANGUAGE sql STABLE AS $function$
        SELECT COALESCE(
          (user_id = NULLIF(current_setting('app.actor_id', true), '') AND (NOT writing OR (university_id IS NULL AND NULLIF(current_setting('app.university_id', true), '') IS NULL)))
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access', true), ''), '[]')::jsonb) capability
            WHERE capability ? 'authentication'
              AND (NOT writing OR capability->'authentication'->>'write' = 'true')
              AND (
                user_id = capability->'authentication'->>'id'
                OR (NOT writing AND LOWER(email) = LOWER(capability->'authentication'->>'email'))
                OR (NOT writing AND max_id = capability->'authentication'->>'maxUserId')
              )
          ), false)
      $function$;
      CREATE OR REPLACE FUNCTION public.napare_relation_allows(table_name text, column_name text, row_value text, writing boolean)
      RETURNS boolean LANGUAGE sql STABLE AS $function$
        SELECT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access', true), ''), '[]')::jsonb) capability
          WHERE capability->'relation'->>'table' = table_name
            AND capability->'relation'->>'column' = column_name
            AND capability->'relation'->>'value' = row_value
            AND (NOT writing OR capability->'relation'->>'write' = 'true')
        )
      $function$;
      DO $block$
      DECLARE target record; predicate text; read_predicate text; write_predicate text;
      BEGIN
        FOR target IN
          SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
          FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
            AND a.attname IN ('universityId', 'university_id') AND a.attnum > 0 AND NOT a.attisdropped
        LOOP
          predicate := format('public.napare_tenant_allows(%L, %I::text, %%L)', target.table_name, target.column_name);
          read_predicate := format(predicate, false);
          write_predicate := format(predicate, true);
          IF target.table_name = 'users' THEN
            read_predicate := read_predicate || format(' OR public.napare_auth_allows(id::text, email::text, "maxUserId"::text, %I::text, false)', target.column_name);
            write_predicate := write_predicate || format(' OR public.napare_auth_allows(id::text, email::text, "maxUserId"::text, %I::text, true)', target.column_name);
          END IF;
          -- Career companies deliberately span universities. Access follows a
          -- persisted, active company membership, never an employer role alone.
          IF target.table_name = 'career_membership' THEN
            read_predicate := read_predicate || ' OR "userId"::text = NULLIF(current_setting(''app.actor_id'', true), '''') OR public.napare_relation_allows(''career_membership'', ''companyId'', "companyId"::text, false)';
            write_predicate := write_predicate || ' OR public.napare_relation_allows(''career_membership'', ''companyId'', "companyId"::text, true) OR ("universityId" IS NULL AND role = ''company_owner'' AND "userId"::text = NULLIF(current_setting(''app.actor_id'', true), '''') AND EXISTS (SELECT 1 FROM career_company company WHERE company.id = "companyId" AND company."createdBy"::text = NULLIF(current_setting(''app.actor_id'', true), '''')))';
          END IF;
          IF target.table_name IN ('career_task', 'career_partnership') THEN
            predicate := format(' OR EXISTS (SELECT 1 FROM career_membership membership WHERE membership."companyId" = %I."companyId" AND membership."userId"::text = NULLIF(current_setting(''app.actor_id'', true), '''') AND membership."revokedAt" IS NULL AND membership.role IN (''company_owner'', ''company_member''))', target.table_name);
            read_predicate := read_predicate || predicate;
            write_predicate := write_predicate || predicate;
          END IF;
          IF target.table_name IN ('users', 'career_profile', 'career_admission') AND to_regclass('career_application') IS NOT NULL THEN
            -- Employers can inspect only students who applied to their tasks.
            predicate := format(' OR EXISTS (SELECT 1 FROM career_application application JOIN career_task task ON task.id = application."taskId" JOIN career_membership membership ON membership."companyId" = task."companyId" WHERE application."studentId" = %I.%I AND membership."userId"::text = NULLIF(current_setting(''app.actor_id'', true), '''') AND membership."revokedAt" IS NULL AND membership.role IN (''company_owner'', ''company_member''))', target.table_name, CASE WHEN target.table_name = 'users' THEN 'id' ELSE 'studentId' END);
            read_predicate := read_predicate || predicate;
          END IF;
          EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target.schema_name, target.table_name);
          EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', target.schema_name, target.table_name);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_select ON %I.%I', target.schema_name, target.table_name);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_insert ON %I.%I', target.schema_name, target.table_name);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_update ON %I.%I', target.schema_name, target.table_name);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_delete ON %I.%I', target.schema_name, target.table_name);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_base ON %I.%I', target.schema_name, target.table_name);
          -- A mandatory restrictive policy cannot be weakened by an unrelated
          -- permissive policy. PostgreSQL also requires a permissive baseline.
          EXECUTE format('CREATE POLICY napare_tenant_base ON %I.%I AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true)', target.schema_name, target.table_name);
          EXECUTE format('CREATE POLICY napare_tenant_select ON %I.%I AS RESTRICTIVE FOR SELECT USING (%s)', target.schema_name, target.table_name, read_predicate);
          EXECUTE format('CREATE POLICY napare_tenant_insert ON %I.%I AS RESTRICTIVE FOR INSERT WITH CHECK (%s)', target.schema_name, target.table_name, write_predicate);
          -- SELECT FOR SHARE/UPDATE needs UPDATE USING visibility too. Keeping
          -- writes in WITH CHECK allows read locks without granting mutation.
          EXECUTE format('CREATE POLICY napare_tenant_update ON %I.%I AS RESTRICTIVE FOR UPDATE USING (%s) WITH CHECK (%s)', target.schema_name, target.table_name, read_predicate, write_predicate);
          EXECUTE format('CREATE POLICY napare_tenant_delete ON %I.%I AS RESTRICTIVE FOR DELETE USING (%s)', target.schema_name, target.table_name, write_predicate);
        END LOOP;
      END $block$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $block$
      DECLARE target record;
      BEGIN
        FOR target IN SELECT DISTINCT schemaname, tablename FROM pg_policies WHERE policyname LIKE 'napare_tenant_%' AND schemaname = current_schema()
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_select ON %I.%I', target.schemaname, target.tablename);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_insert ON %I.%I', target.schemaname, target.tablename);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_update ON %I.%I', target.schemaname, target.tablename);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_delete ON %I.%I', target.schemaname, target.tablename);
          EXECUTE format('DROP POLICY IF EXISTS napare_tenant_base ON %I.%I', target.schemaname, target.tablename);
          EXECUTE format('ALTER TABLE %I.%I NO FORCE ROW LEVEL SECURITY', target.schemaname, target.tablename);
          EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', target.schemaname, target.tablename);
        END LOOP;
      END $block$;
      DROP FUNCTION IF EXISTS public.napare_auth_allows(text, text, text, text, boolean);
      DROP FUNCTION IF EXISTS public.napare_relation_allows(text, text, text, boolean);
      DROP FUNCTION IF EXISTS public.napare_tenant_allows(text, text, boolean);
    `);
  }
}
