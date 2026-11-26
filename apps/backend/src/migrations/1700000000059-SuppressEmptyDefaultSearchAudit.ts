import { MigrationInterface, QueryRunner } from 'typeorm';

/** Avoid retaining a row for each automatic, empty default-list render. */
export class SuppressEmptyDefaultSearchAudit1700000000059 implements MigrationInterface {
  name = 'SuppressEmptyDefaultSearchAudit1700000000059';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION suppress_empty_default_platform_search_audit()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.action LIKE 'platform.%search'
          AND NEW."newValues" ->> 'queryEntered' = 'false'
          AND COALESCE(NEW."newValues" ->> 'total', '0') = '0'
          AND COALESCE(NEW."newValues" ->> 'resultCount', '0') = '0'
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_each(COALESCE(NEW."newValues", '{}'::jsonb)) AS field(key, value)
            WHERE field.key NOT IN ('queryEntered', 'page', 'limit', 'total', 'resultCount')
              AND field.key NOT LIKE 'result%Ids'
              AND field.value NOT IN ('null'::jsonb, '[]'::jsonb, '""'::jsonb)
          ) THEN
          RETURN NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_suppress_empty_default_platform_search_audit
      BEFORE INSERT ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION suppress_empty_default_platform_search_audit();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS trg_suppress_empty_default_platform_search_audit ON audit_logs');
    await queryRunner.query('DROP FUNCTION IF EXISTS suppress_empty_default_platform_search_audit()');
  }
}
