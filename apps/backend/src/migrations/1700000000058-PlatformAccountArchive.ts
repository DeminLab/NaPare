import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformAccountArchive1700000000058 implements MigrationInterface {
  name = 'PlatformAccountArchive1700000000058';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "archivedAt" timestamp NULL');
    await queryRunner.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "archivedWasActive" boolean NULL');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_archivedAt" ON users ("archivedAt")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [state] = await queryRunner.query('SELECT count(*)::int AS count FROM users WHERE "archivedAt" IS NOT NULL');
    if (state.count) throw new Error('Cannot remove account archive metadata while archived accounts exist');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_archivedAt"');
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS "archivedWasActive"');
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS "archivedAt"');
  }
}
