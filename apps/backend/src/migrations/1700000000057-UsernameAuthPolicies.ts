import { MigrationInterface, QueryRunner } from 'typeorm';

/** Keeps username authentication visible through the existing users RLS policies. */
export class UsernameAuthPolicies1700000000057 implements MigrationInterface {
  name = 'UsernameAuthPolicies1700000000057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $block$
      DECLARE
        policy record; policy_using text; policy_check text; statement text;
        legacy_pattern text := '(public\\.)?napare_auth_allows[[:space:]]*\\([[:space:]]*[(]*[[:space:]]*id[[:space:]]*[)]*[[:space:]]*::[[:space:]]*text[[:space:]]*[)]*[[:space:]]*,[[:space:]]*[(]*[[:space:]]*email[[:space:]]*[)]*[[:space:]]*::[[:space:]]*text[[:space:]]*[)]*[[:space:]]*,[[:space:]]*[(]*[[:space:]]*"maxUserId"[[:space:]]*[)]*[[:space:]]*::[[:space:]]*text[[:space:]]*[)]*[[:space:]]*,';
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_attribute
          WHERE attrelid = to_regclass(format('%I.users', current_schema()))
            AND attname = 'username' AND attnum > 0 AND NOT attisdropped
        ) OR to_regprocedure('public.napare_auth_allows(text,text,text,text,text,boolean)') IS NULL THEN
          RAISE EXCEPTION 'Username authentication prerequisites are missing';
        END IF;

        FOR policy IN
          SELECT schemaname, tablename, policyname, qual, with_check
          FROM pg_catalog.pg_policies
          WHERE schemaname = current_schema() AND tablename = 'users'
            AND (COALESCE(qual, '') ~ legacy_pattern OR COALESCE(with_check, '') ~ legacy_pattern)
        LOOP
          policy_using := regexp_replace(
            policy.qual,
            legacy_pattern,
            'public.napare_auth_allows(id::text, email::text, username::text, "maxUserId"::text,', 'g'
          );
          policy_check := regexp_replace(
            policy.with_check,
            legacy_pattern,
            'public.napare_auth_allows(id::text, email::text, username::text, "maxUserId"::text,', 'g'
          );

          statement := format('ALTER POLICY %I ON %I.%I', policy.policyname, policy.schemaname, policy.tablename);
          IF policy.qual IS NOT NULL THEN
            statement := statement || format(' USING (%s)', policy_using);
          END IF;
          IF policy.with_check IS NOT NULL THEN
            statement := statement || format(' WITH CHECK (%s)', policy_check);
          END IF;
          EXECUTE statement;
        END LOOP;

        IF EXISTS (
          SELECT 1 FROM pg_catalog.pg_policies
          WHERE schemaname = current_schema() AND tablename = 'users'
            AND (COALESCE(qual, '') ~ legacy_pattern OR COALESCE(with_check, '') ~ legacy_pattern)
        ) THEN
          RAISE EXCEPTION 'Legacy email-only authentication remains in a users policy';
        END IF;
      END $block$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $block$
      DECLARE
        policy record; policy_using text; policy_check text; statement text;
        username_pattern text := '(public\\.)?napare_auth_allows[[:space:]]*\\([[:space:]]*[(]*[[:space:]]*id[[:space:]]*[)]*[[:space:]]*::[[:space:]]*text[[:space:]]*[)]*[[:space:]]*,[[:space:]]*[(]*[[:space:]]*email[[:space:]]*[)]*[[:space:]]*::[[:space:]]*text[[:space:]]*[)]*[[:space:]]*,[[:space:]]*[(]*[[:space:]]*username[[:space:]]*[)]*[[:space:]]*::[[:space:]]*text[[:space:]]*[)]*[[:space:]]*,[[:space:]]*[(]*[[:space:]]*"maxUserId"[[:space:]]*[)]*[[:space:]]*::[[:space:]]*text[[:space:]]*[)]*[[:space:]]*,';
      BEGIN
        IF to_regprocedure('public.napare_auth_allows(text,text,text,text,boolean)') IS NULL THEN
          RAISE EXCEPTION 'Legacy authentication function is missing';
        END IF;

        FOR policy IN
          SELECT schemaname, tablename, policyname, qual, with_check
          FROM pg_catalog.pg_policies
          WHERE schemaname = current_schema() AND tablename = 'users'
            AND (COALESCE(qual, '') ~ username_pattern OR COALESCE(with_check, '') ~ username_pattern)
        LOOP
          policy_using := regexp_replace(
            policy.qual,
            username_pattern,
            'public.napare_auth_allows(id::text, email::text, "maxUserId"::text,', 'g'
          );
          policy_check := regexp_replace(
            policy.with_check,
            username_pattern,
            'public.napare_auth_allows(id::text, email::text, "maxUserId"::text,', 'g'
          );

          statement := format('ALTER POLICY %I ON %I.%I', policy.policyname, policy.schemaname, policy.tablename);
          IF policy.qual IS NOT NULL THEN
            statement := statement || format(' USING (%s)', policy_using);
          END IF;
          IF policy.with_check IS NOT NULL THEN
            statement := statement || format(' WITH CHECK (%s)', policy_check);
          END IF;
          EXECUTE statement;
        END LOOP;
      END $block$;
    `);
  }
}
