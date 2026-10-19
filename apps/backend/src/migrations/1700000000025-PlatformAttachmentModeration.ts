import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformAttachmentModeration1700000000025 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "file_attachments" ADD COLUMN "revokedAt" timestamp NULL`);
    await runner.query(`ALTER TABLE "file_attachments" ADD COLUMN "revokedBy" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL`);
    await runner.query(`ALTER TABLE "file_attachments" ADD COLUMN "revokeReason" varchar(500) NULL`);
    await runner.query(`CREATE INDEX "IDX_file_attachments_revoked_at" ON "file_attachments" ("revokedAt")`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP INDEX "IDX_file_attachments_revoked_at"`);
    await runner.query(`ALTER TABLE "file_attachments" DROP COLUMN "revokeReason"`);
    await runner.query(`ALTER TABLE "file_attachments" DROP COLUMN "revokedBy"`);
    await runner.query(`ALTER TABLE "file_attachments" DROP COLUMN "revokedAt"`);
  }
}
