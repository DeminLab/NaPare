import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public portfolio read path.
 *
 * `/career/accounts/portfolio/:studentId[/cases]` is deliberately anonymous:
 * the student published the case and the employer allowed publication.
 * Migration 29 turned `users` and `career_task` into FORCE RLS tenant tables,
 * so without a scoped capability those two reads return no rows and the
 * published portfolio answers 404 for everybody, including its author.
 *
 * The service reads the unguarded portfolio/work/review chain first, then
 * grants a relation capability for exactly the student id and the task ids it
 * is about to render. This migration teaches the select policies to honour that
 * capability. It only appends to the existing predicate text, so every later
 * migration that widened `users` (erasure, moderation) keeps working.
 *
 * Idempotent: the predicate is appended only when absent. Reversible: down()
 * removes exactly the appended clause.
 */
export class PublicPortfolioRead1700000000053 implements MigrationInterface {
  private readonly tables: Array<{ table: 'users' | 'career_task'; key: string }> = [
    { table: 'users', key: 'id' },
    { table: 'career_task', key: 'id' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, key } of this.tables) {
      await queryRunner.query(`
        DO $block$
        DECLARE definition text;
        BEGIN
          SELECT pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) INTO definition
          FROM pg_catalog.pg_policy pol
          JOIN pg_catalog.pg_class rel ON rel.oid = pol.polrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace
          WHERE n.nspname = current_schema() AND rel.relname = '${table}' AND pol.polname = 'napare_tenant_select';
          IF definition IS NOT NULL AND position('napare_relation_allows' in definition) = 0 THEN
            EXECUTE format(
              'ALTER POLICY napare_tenant_select ON %I USING ((%s) OR public.napare_relation_allows(%L, %L, ${key}::text, false))',
              '${table}', definition, '${table}', '${key}'
            );
          END IF;
        END $block$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, key } of this.tables) {
      await queryRunner.query(`
        DO $block$
        DECLARE definition text;
        BEGIN
          SELECT pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) INTO definition
          FROM pg_catalog.pg_policy pol
          JOIN pg_catalog.pg_class rel ON rel.oid = pol.polrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace
          WHERE n.nspname = current_schema() AND rel.relname = '${table}' AND pol.polname = 'napare_tenant_select';
          IF definition IS NOT NULL THEN
            definition := regexp_replace(
              definition,
              '\\s+OR\\s+public\\.napare_relation_allows\\(''${table}''::text, ''${key}''::text, ${key}::text, false\\)',
              '', 'g'
            );
            EXECUTE format('ALTER POLICY napare_tenant_select ON %I USING (%s)', '${table}', definition);
          END IF;
        END $block$;
      `);
    }
  }
}
