import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebPushConsent1700000000043 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS "webPushConsentedAt" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "webPushConsentVersion" varchar NULL,
      ADD COLUMN IF NOT EXISTS "webPushRevokedAt" timestamp NULL`);
  }
  async down(): Promise<void> { throw new Error('WebPush consent history requires an explicit retention migration'); }
}
