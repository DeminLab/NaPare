import { MigrationInterface, QueryRunner } from 'typeorm';

export class CareerMembershipRevocation1700000000027 implements MigrationInterface {
  name = 'CareerMembershipRevocation1700000000027';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "career_membership" ADD COLUMN "revokedAt" timestamptz NULL');
    await runner.query('ALTER TABLE "career_membership" ADD COLUMN "revokedBy" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL');
    await runner.query('CREATE INDEX "IDX_career_membership_revokedAt" ON "career_membership" ("revokedAt")');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX "IDX_career_membership_revokedAt"');
    await runner.query('ALTER TABLE "career_membership" DROP COLUMN "revokedBy"');
    await runner.query('ALTER TABLE "career_membership" DROP COLUMN "revokedAt"');
  }
}
