import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-0008 expand step: canonical tenant alias.
 *
 * For every tenant table this migration runs in both directions:
 *  - production (legacy schema): adds "organizationId" ("organization_id" for
 *    snake_case tables) next to the legacy column and backfills it;
 *  - development/test (synchronize-created schema): adds the legacy column
 *    next to "organizationId" so historic migrations 20/29/31-34/36/37/40-44,
 *    which still hardcode the legacy names, keep working. The dev/test paths
 *    run this migration before and after their historic migration tail
 *    (ADR-0008 "dev/test paths" section).
 *
 * Both directions then:
 *  1. install a BEFORE INSERT OR UPDATE trigger keeping legacy and alias equal
 *     (direct legacy writes stay valid during the rollback window);
 *  2. duplicate single-column foreign keys and indexes that involve the legacy
 *     column so the new read path keeps integrity and index coverage;
 *  3. alias platform_grants."universityIds" (migration 28) to "organizationIds";
 *  4. re-creates tenant helper functions and policies with the text of the
 *     legacy column replaced (app.university_id -> app.organization_id,
 *     capability key universityIds -> organizationIds).
 *
 * The migration is idempotent: every step is guarded by IF NOT EXISTS /
 * column-existence checks, so dev/test may execute it more than once.
 * Legacy columns stay in place: dropping them is the contract step of a later
 * release (TZ 15.1). Reversible in the production shape only: down() drops the
 * alias column, its triggers, indexes and foreign keys, then restores functions
 * and policies to the legacy text.
 */
export class TenantOrganizationAlias1700000000046 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.napare_tenant_org_alias_sync() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW."organizationId" IS NULL THEN
            NEW."organizationId" := NEW."universityId";
          ELSIF NEW."universityId" IS DISTINCT FROM NEW."organizationId" THEN
            NEW."universityId" := NEW."organizationId";
          END IF;
        ELSE
          IF NEW."universityId" IS DISTINCT FROM OLD."universityId" AND NEW."universityId" IS NOT NULL
             AND NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
            NEW."organizationId" := NEW."universityId";
          ELSIF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" AND NEW."organizationId" IS NOT NULL THEN
            NEW."universityId" := NEW."organizationId";
          ELSIF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" AND NEW."organizationId" IS NULL THEN
            -- Explicit tenant clear on the canonical side: clear the alias as
            -- well and let row security decide whether the row may leave the
            -- tenant (without a wildcard capability the UPDATE policy rejects
            -- the NULL scope instead of silently restoring it).
            NEW."universityId" := NULL;
          ELSIF NEW."organizationId" IS NULL THEN
            NEW."organizationId" := COALESCE(NEW."universityId", OLD."organizationId");
            NEW."universityId" := NEW."organizationId";
          ELSIF NEW."universityId" IS DISTINCT FROM NEW."organizationId" THEN
            NEW."universityId" := NEW."organizationId";
          END IF;
        END IF;
        RETURN NEW;
      END $fn$;
      CREATE OR REPLACE FUNCTION public.napare_tenant_org_alias_sync_snake() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW."organization_id" IS NULL THEN
            NEW."organization_id" := NEW."university_id";
          ELSIF NEW."university_id" IS DISTINCT FROM NEW."organization_id" THEN
            NEW."university_id" := NEW."organization_id";
          END IF;
        ELSE
          IF NEW."university_id" IS DISTINCT FROM OLD."university_id" AND NEW."university_id" IS NOT NULL
             AND NEW."organization_id" IS DISTINCT FROM OLD."organization_id" THEN
            NEW."organization_id" := NEW."university_id";
          ELSIF NEW."organization_id" IS DISTINCT FROM OLD."organization_id" AND NEW."organization_id" IS NOT NULL THEN
            NEW."university_id" := NEW."organization_id";
          ELSIF NEW."organization_id" IS DISTINCT FROM OLD."organization_id" AND NEW."organization_id" IS NULL THEN
            -- Explicit tenant clear on the canonical side: clear the alias as
            -- well and let row security decide whether the row may leave the
            -- tenant (without a wildcard capability the UPDATE policy rejects
            -- the NULL scope instead of silently restoring it).
            NEW."university_id" := NULL;
          ELSIF NEW."organization_id" IS NULL THEN
            NEW."organization_id" := COALESCE(NEW."university_id", OLD."organization_id");
            NEW."university_id" := NEW."organization_id";
          ELSIF NEW."university_id" IS DISTINCT FROM NEW."organization_id" THEN
            NEW."university_id" := NEW."organization_id";
          END IF;
        END IF;
        RETURN NEW;
      END $fn$;
      CREATE OR REPLACE FUNCTION public.napare_tenant_org_alias_grants_sync() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW."organizationIds" IS NULL THEN
            NEW."organizationIds" := NEW."universityIds";
          ELSIF NEW."universityIds" IS DISTINCT FROM NEW."organizationIds" THEN
            NEW."universityIds" := NEW."organizationIds";
          END IF;
        ELSE
          IF NEW."universityIds" IS DISTINCT FROM OLD."universityIds" AND NEW."universityIds" IS NOT NULL
             AND NEW."organizationIds" IS DISTINCT FROM OLD."organizationIds" THEN
            NEW."organizationIds" := NEW."universityIds";
          ELSIF NEW."organizationIds" IS DISTINCT FROM OLD."organizationIds" AND NEW."organizationIds" IS NOT NULL THEN
            NEW."universityIds" := NEW."organizationIds";
          ELSIF NEW."organizationIds" IS NULL THEN
            NEW."organizationIds" := COALESCE(NEW."universityIds", OLD."organizationIds");
            NEW."universityIds" := NEW."organizationIds";
          ELSIF NEW."universityIds" IS DISTINCT FROM NEW."organizationIds" THEN
            NEW."universityIds" := NEW."organizationIds";
          END IF;
        END IF;
        RETURN NEW;
      END $fn$;
    `);

    await queryRunner.query(`
      DO $block$
      DECLARE t record; c record; idx record; fk record;
        cols text; colname text; v_attnum smallint; has_expr boolean;
        newdef text; newidx text; where_clause text; is_unique text;
        had_rls boolean; had_force boolean;
        trig_state "char"; trig_exists boolean;
      BEGIN
        FOR t IN
          SELECT DISTINCT tbl.oid AS table_oid, tbl.relname AS table_name,
            EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = tbl.oid AND a.attname = 'universityId' AND a.attnum > 0 AND NOT a.attisdropped) AS legacy_camel,
            EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = tbl.oid AND a.attname = 'organizationId' AND a.attnum > 0 AND NOT a.attisdropped) AS org_camel,
            EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = tbl.oid AND a.attname = 'university_id' AND a.attnum > 0 AND NOT a.attisdropped) AS legacy_snake,
            EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = tbl.oid AND a.attname = 'organization_id' AND a.attnum > 0 AND NOT a.attisdropped) AS org_snake
          FROM pg_class tbl
          JOIN pg_namespace n ON n.oid = tbl.relnamespace
          WHERE n.nspname = current_schema() AND tbl.relkind IN ('r', 'p')
            AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = tbl.oid
              AND a.attname IN ('universityId', 'university_id', 'organizationId', 'organization_id') AND a.attnum > 0 AND NOT a.attisdropped)
        LOOP
          -- The backfill UPDATEs below must see every row: migration 29
          -- enables FORCE ROW LEVEL SECURITY (even the table owner is
          -- subject to it) and migrations run without a tenant GUC, so the
          -- restrictive policy would silently hide all rows. Suspend row
          -- security for the backfill only and restore its prior state.
          SELECT cls.relrowsecurity, cls.relforcerowsecurity INTO had_rls, had_force
            FROM pg_catalog.pg_class cls WHERE cls.oid = t.table_oid;
          IF had_rls THEN
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t.table_name);
          END IF;
          -- Migration 38's napare_active_writer resolves the private-data
          -- recipient with a SELECT on users under FORCE row security, but a
          -- migration session has no tenant GUC, so every subject lookup
          -- misses and the backfill UPDATE raises "Private data recipient is
          -- unavailable" on any non-empty table. Suspend that guard for the
          -- backfill only (a schema rewrite never changes the recipient) and
          -- restore its prior enabled state.
          SELECT tg.tgenabled INTO trig_state
            FROM pg_catalog.pg_trigger tg
            WHERE tg.tgrelid = t.table_oid AND tg.tgname = 'napare_active_writer' AND NOT tg.tgisinternal;
          trig_exists := FOUND;
          IF trig_exists AND trig_state <> 'D' THEN
            EXECUTE format('ALTER TABLE %I DISABLE TRIGGER napare_active_writer', t.table_name);
          END IF;

          IF t.legacy_camel OR t.org_camel THEN
            IF t.legacy_camel AND NOT t.org_camel THEN
              EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "organizationId" uuid', t.table_name);
              EXECUTE format('UPDATE %I SET "organizationId" = "universityId" WHERE "organizationId" IS NULL AND "universityId" IS NOT NULL', t.table_name);
            ELSIF t.org_camel AND NOT t.legacy_camel THEN
              -- Dev/test synchronize shape: materialize the legacy column so
              -- historic migrations and rollback-window readers keep working.
              EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "universityId" uuid', t.table_name);
              EXECUTE format('UPDATE %I SET "universityId" = "organizationId" WHERE "universityId" IS NULL AND "organizationId" IS NOT NULL', t.table_name);
            END IF;
            EXECUTE format('DROP TRIGGER IF EXISTS napare_tenant_org_alias ON %I', t.table_name);
            EXECUTE format('CREATE TRIGGER napare_tenant_org_alias BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.napare_tenant_org_alias_sync()', t.table_name);
          ELSIF t.legacy_snake OR t.org_snake THEN
            IF t.legacy_snake AND NOT t.org_snake THEN
              EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "organization_id" uuid', t.table_name);
              EXECUTE format('UPDATE %I SET "organization_id" = "university_id" WHERE "organization_id" IS NULL AND "university_id" IS NOT NULL', t.table_name);
            ELSIF t.org_snake AND NOT t.legacy_snake THEN
              EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "university_id" uuid', t.table_name);
              EXECUTE format('UPDATE %I SET "university_id" = "organization_id" WHERE "university_id" IS NULL AND "organization_id" IS NOT NULL', t.table_name);
            END IF;
            EXECUTE format('DROP TRIGGER IF EXISTS napare_tenant_org_alias ON %I', t.table_name);
            EXECUTE format('CREATE TRIGGER napare_tenant_org_alias BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.napare_tenant_org_alias_sync_snake()', t.table_name);
          END IF;

          IF trig_exists AND trig_state <> 'D' THEN
            EXECUTE format('ALTER TABLE %I ENABLE TRIGGER napare_active_writer', t.table_name);
          END IF;

          IF had_rls THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
            IF had_force THEN
              EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.table_name);
            END IF;
          END IF;

        END LOOP;

        -- Indexes first: the foreign-key pass below needs the alias unique
        -- indexes to exist on the referenced side of each key.
        FOR idx IN
          SELECT ic.relname AS index_name, i.indkey, i.indpred, i.indrelid, i.indisunique,
            rel.relname AS table_name
          FROM pg_index i
          JOIN pg_class ic ON ic.oid = i.indexrelid
          JOIN pg_class rel ON rel.oid = i.indrelid
          JOIN pg_namespace n ON n.oid = rel.relnamespace
          WHERE n.nspname = current_schema()
            AND i.indisprimary = false
            AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = i.indrelid
              AND a.attnum = ANY (i.indkey::int2[]) AND a.attname IN ('universityId', 'university_id'))
        LOOP
          cols := ''; has_expr := false;
          FOR v_attnum IN SELECT unnest(idx.indkey::int2[]) LOOP
            IF v_attnum = 0 THEN has_expr := true; EXIT; END IF;
            SELECT a.attname INTO colname FROM pg_attribute a WHERE a.attrelid = idx.indrelid AND a.attnum = v_attnum;
            cols := cols || format('%I', CASE WHEN colname = 'universityId' THEN 'organizationId'
              WHEN colname = 'university_id' THEN 'organization_id' ELSE colname END) || ', ';
          END LOOP;
          IF NOT has_expr AND cols <> '' THEN
            newidx := left(idx.index_name || '_org_alias', 63);
            where_clause := '';
            IF idx.indpred IS NOT NULL THEN
              where_clause := ' WHERE ' || replace(replace(pg_get_expr(idx.indpred, idx.indrelid), '"universityId"', '"organizationId"'), 'university_id', 'organization_id');
            END IF;
            is_unique := '';
            IF idx.indisunique THEN is_unique := 'UNIQUE '; END IF;
            EXECUTE format('CREATE %sINDEX IF NOT EXISTS %I ON %I (%s)%s', is_unique, newidx, idx.table_name, left(cols, length(cols) - 2), where_clause);
          END IF;
        END LOOP;

        -- Foreign keys that involve the legacy column: duplicate with the alias column.
        FOR fk IN
          SELECT con.oid, rel.relname AS table_name, pg_get_constraintdef(con.oid) AS definition
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = rel.relnamespace
          WHERE con.contype = 'f' AND n.nspname = current_schema()
            AND (pg_get_constraintdef(con.oid) LIKE '%universityId%' OR pg_get_constraintdef(con.oid) LIKE '%university_id%')
            AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = con.conrelid
              AND a.attname IN ('organizationId', 'organization_id') AND a.attnum > 0 AND NOT a.attisdropped)
        LOOP
          newdef := replace(replace(fk.definition, '"universityId"', '"organizationId"'), 'university_id', 'organization_id');
          IF newdef <> fk.definition THEN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', fk.table_name, 'FK_org_alias_' || left(md5(fk.oid::text), 8));
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', fk.table_name, 'FK_org_alias_' || left(md5(fk.oid::text), 8), newdef);
          END IF;
        END LOOP;

        -- Helper functions whose body reads the legacy GUC/capability key:
        -- re-create with canonical text. Only string-literal contexts are
        -- replaced (GUC app.university_id, capability key 'universityIds'):
        -- input parameter names must stay untouched, otherwise CREATE OR
        -- REPLACE rejects the definition and historic migration 29 could no
        -- longer re-run unchanged (ADR-0008). The alias trigger functions of
        -- this migration deliberately keep both columns.
        FOR c IN
          SELECT p.proname, pg_get_functiondef(p.oid) AS definition
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = current_schema() AND p.prokind = 'f'
            AND p.proname NOT LIKE 'napare_tenant_org_alias%'
            AND (p.prosrc LIKE '%universityId%' OR p.prosrc LIKE '%university_id%')
        LOOP
          EXECUTE replace(replace(c.definition, 'app.university_id', 'app.organization_id'), '''universityIds''', '''organizationIds''');
        END LOOP;
      END $block$;
    `);

    // platform_grants carries the plural scope column from migration 28; it is
    // outside the singular tenant-column loop but needs the same alias so the
    // renamed entity reads/writes work on a production (legacy) schema.
    await queryRunner.query(`
      DO $block$
      DECLARE had_rls boolean; had_force boolean;
      BEGIN
        IF to_regclass('platform_grants') IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = to_regclass('platform_grants') AND a.attname = 'universityIds'
              AND a.attnum > 0 AND NOT a.attisdropped) THEN
            ALTER TABLE platform_grants ADD COLUMN IF NOT EXISTS "organizationIds" uuid[];
            -- Same backfill caveat as the tenant loop: forced row security
            -- would hide every row from the UPDATE below.
            SELECT cls.relrowsecurity, cls.relforcerowsecurity INTO had_rls, had_force
              FROM pg_catalog.pg_class cls WHERE cls.oid = to_regclass('platform_grants');
            IF had_rls THEN
              ALTER TABLE platform_grants DISABLE ROW LEVEL SECURITY;
            END IF;
            UPDATE platform_grants SET "organizationIds" = "universityIds" WHERE "organizationIds" IS NULL AND "universityIds" IS NOT NULL;
            IF had_rls THEN
              ALTER TABLE platform_grants ENABLE ROW LEVEL SECURITY;
              IF had_force THEN
                ALTER TABLE platform_grants FORCE ROW LEVEL SECURITY;
              END IF;
            END IF;
            DROP TRIGGER IF EXISTS napare_tenant_org_alias_grants ON platform_grants;
            CREATE TRIGGER napare_tenant_org_alias_grants BEFORE INSERT OR UPDATE ON platform_grants
              FOR EACH ROW EXECUTE FUNCTION public.napare_tenant_org_alias_grants_sync();
          ELSE
            -- The legacy column was removed (synchronize in dev/test): a stale
            -- trigger would fail every grant write, so drop it.
            DROP TRIGGER IF EXISTS napare_tenant_org_alias_grants ON platform_grants;
          END IF;
        END IF;
      END $block$;
    `);

    await queryRunner.query(`
      DO $block$
      DECLARE p record; newqual text; newcheck text; roles_text text;
      BEGIN
        FOR p IN
          SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
          FROM pg_policies
          WHERE schemaname = current_schema()
            AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ 'universityId|university_id|universityIds'
        LOOP
          newqual := NULLIF(replace(replace(replace(COALESCE(p.qual, ''), 'universityId', 'organizationId'), 'university_id', 'organization_id'), 'universityIds', 'organizationIds'), '');
          newcheck := NULLIF(replace(replace(replace(COALESCE(p.with_check, ''), 'universityId', 'organizationId'), 'university_id', 'organization_id'), 'universityIds', 'organizationIds'), '');
          roles_text := CASE WHEN p.roles = ARRAY['public']::name[] THEN 'PUBLIC' ELSE array_to_string(p.roles, ', ') END;
          EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
          EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
            p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, roles_text,
            CASE WHEN newqual IS NOT NULL THEN ' USING (' || newqual || ')' ELSE '' END,
            CASE WHEN newcheck IS NOT NULL THEN ' WITH CHECK (' || newcheck || ')' ELSE '' END);
        END LOOP;
      END $block$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $block$
      DECLARE t record; p record; c record; k record; x record; newqual text; newcheck text; roles_text text;
      BEGIN
        -- Restore legacy text first: policies/functions must not reference the
        -- alias column once the column loop below drops it.
        FOR c IN
          SELECT p.oid, pg_get_functiondef(p.oid) AS definition
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = current_schema() AND p.prokind = 'f'
            AND p.proname NOT LIKE 'napare_tenant_org_alias%'
            AND (p.prosrc LIKE '%organizationId%' OR p.prosrc LIKE '%organization_id%')
        LOOP
          EXECUTE replace(replace(c.definition, 'organizationId', 'universityId'), 'organization_id', 'university_id');
        END LOOP;

        FOR p IN
          SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
          FROM pg_policies
          WHERE schemaname = current_schema()
            AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ 'organizationId|organization_id|organizationIds'
        LOOP
          newqual := NULLIF(replace(replace(replace(COALESCE(p.qual, ''), 'organizationId', 'universityId'), 'organization_id', 'university_id'), 'organizationIds', 'universityIds'), '');
          newcheck := NULLIF(replace(replace(replace(COALESCE(p.with_check, ''), 'organizationId', 'universityId'), 'organization_id', 'university_id'), 'organizationIds', 'universityIds'), '');
          roles_text := CASE WHEN p.roles = ARRAY['public']::name[] THEN 'PUBLIC' ELSE array_to_string(p.roles, ', ') END;
          EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
          EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
            p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, roles_text,
            CASE WHEN newqual IS NOT NULL THEN ' USING (' || newqual || ')' ELSE '' END,
          CASE WHEN newcheck IS NOT NULL THEN ' WITH CHECK (' || newcheck || ')' ELSE '' END);
        END LOOP;

        FOR t IN
          SELECT DISTINCT tbl.relname AS table_name
          FROM pg_class tbl
          JOIN pg_namespace n ON n.oid = tbl.relnamespace
          WHERE n.nspname = current_schema() AND tbl.relkind IN ('r', 'p')
            AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = tbl.oid
              AND a.attname IN ('organizationId', 'organization_id') AND a.attnum > 0 AND NOT a.attisdropped)
        LOOP
          EXECUTE format('DROP TRIGGER IF EXISTS napare_tenant_org_alias ON %I', t.table_name);
          -- Aliases created by up(): their foreign keys and indexes still
          -- reference the alias column and would block the drop below.
          FOR k IN
            SELECT con.conname FROM pg_catalog.pg_constraint con
            WHERE con.conrelid = to_regclass(quote_ident(t.table_name)) AND con.conname LIKE 'FK_org_alias_%'
          LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t.table_name, k.conname);
          END LOOP;
          FOR x IN
            SELECT ic.relname FROM pg_index i
            JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
            WHERE i.indrelid = to_regclass(quote_ident(t.table_name)) AND ic.relname LIKE '%org_alias'
          LOOP
            EXECUTE format('DROP INDEX IF EXISTS %I', x.relname);
          END LOOP;
          EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "organizationId"', t.table_name);
          EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "organization_id"', t.table_name);
        END LOOP;

        -- Production (direction A) rollback only: drop the alias column when the
        -- legacy column is present; a dev/test schema keeps its original column.
        IF to_regclass('platform_grants') IS NOT NULL
           AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('platform_grants') AND a.attname = 'organizationIds' AND a.attnum > 0 AND NOT a.attisdropped)
           AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('platform_grants') AND a.attname = 'universityIds' AND a.attnum > 0 AND NOT a.attisdropped) THEN
          DROP TRIGGER IF EXISTS napare_tenant_org_alias_grants ON platform_grants;
          ALTER TABLE platform_grants DROP COLUMN IF EXISTS "organizationIds";
        END IF;
        DROP FUNCTION IF EXISTS public.napare_tenant_org_alias_sync();
        DROP FUNCTION IF EXISTS public.napare_tenant_org_alias_sync_snake();
        DROP FUNCTION IF EXISTS public.napare_tenant_org_alias_grants_sync();
      END $block$;
    `);
  }
}
