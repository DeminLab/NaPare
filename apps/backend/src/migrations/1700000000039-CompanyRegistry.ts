import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyRegistry1700000000039 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE career_company
      ADD COLUMN IF NOT EXISTS inn varchar(12) NULL,
      ADD COLUMN IF NOT EXISTS "registryStatus" varchar NOT NULL DEFAULT 'not_checked',
      ADD COLUMN IF NOT EXISTS "registryCheckedAt" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "registryRequestedAt" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "registryLegalName" text NULL,
      ADD COLUMN IF NOT EXISTS "registryOgrn" varchar(15) NULL,
      ADD COLUMN IF NOT EXISTS "registryReason" varchar(80) NULL,
      ADD COLUMN IF NOT EXISTS "registryCheckVersion" integer NOT NULL DEFAULT 0`);
  }
  async down(runner: QueryRunner): Promise<void> {
    const [state] = await runner.query('SELECT count(*)::int AS count FROM career_company WHERE inn IS NOT NULL');
    if (state.count) throw new Error('Export and deliberately retire registry verification records before removing their columns');
    await runner.query(`ALTER TABLE career_company DROP COLUMN "registryCheckVersion", DROP COLUMN "registryReason", DROP COLUMN "registryOgrn",
      DROP COLUMN "registryLegalName", DROP COLUMN "registryRequestedAt", DROP COLUMN "registryCheckedAt", DROP COLUMN "registryStatus", DROP COLUMN inn`);
  }
}
