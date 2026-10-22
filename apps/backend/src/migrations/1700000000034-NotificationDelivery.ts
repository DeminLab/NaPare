import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantRowSecurity1700000000029 } from './1700000000029-TenantRowSecurity';

export class NotificationDelivery1700000000034 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS provider varchar(16) NOT NULL DEFAULT 'legacy';
      CREATE TABLE notification_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL, "notificationId" uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel varchar(16) NOT NULL, "targetId" uuid NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
        "lastError" varchar(64), history jsonb NOT NULL DEFAULT '[]',
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_notification_delivery_target" UNIQUE ("notificationId",channel,"targetId"),
        CONSTRAINT notification_delivery_status CHECK (status IN ('pending','queued','sending','delivered','suppressed','dead')),
        CONSTRAINT notification_delivery_channel CHECK (channel IN ('webpush','rustore','telegram','max'))
      );
      CREATE INDEX "IDX_notification_delivery_dispatch" ON notification_deliveries(status,"updatedAt");
    `);
    await new TenantRowSecurity1700000000029().up(runner);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE notification_deliveries');
    await runner.query('ALTER TABLE device_tokens DROP COLUMN provider');
  }
}
