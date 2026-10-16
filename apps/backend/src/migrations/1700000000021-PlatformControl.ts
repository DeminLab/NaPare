import { MigrationInterface, QueryRunner } from 'typeorm';
export class PlatformControl1700000000021 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE platform_control (id varchar PRIMARY KEY DEFAULT 'platform' CHECK (id = 'platform'), "ownerId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, "platformName" varchar NOT NULL DEFAULT 'НаПаре', "supportEmail" varchar NOT NULL DEFAULT '', announcement text NOT NULL DEFAULT '', "readOnly" boolean NOT NULL DEFAULT false, "updatedAt" timestamp NOT NULL DEFAULT now())`);
    await runner.query(`CREATE TABLE platform_grants ("userId" uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT, permissions text[] NOT NULL DEFAULT '{}', "serviceIds" text[] NOT NULL DEFAULT '{}', "grantedBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`);
  }
  async down(): Promise<void> { throw new Error('Owner binding and permission audit require an explicit preservation migration.'); }
}
