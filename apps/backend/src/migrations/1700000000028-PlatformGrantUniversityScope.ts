import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformGrantUniversityScope1700000000028 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE platform_grants ADD COLUMN "universityIds" uuid[] NULL');
    await runner.query('COMMENT ON COLUMN platform_grants."universityIds" IS \'NULL means legacy/global scope; empty array denies university data; otherwise allowed university IDs\'');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE platform_grants DROP COLUMN "universityIds"');
  }
}
