import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantRowSecurity1700000000029 } from './1700000000029-TenantRowSecurity';

export class AcademicIdentities1700000000036 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE academic_identities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id),
      "userId" uuid NOT NULL REFERENCES users(id), "sourceBaseUrl" varchar(1024) NOT NULL,
      "externalUserId" varchar(20) NOT NULL CHECK ("externalUserId" ~ '^[1-9][0-9]{0,14}$'),
      "linkedBy" uuid NOT NULL REFERENCES users(id), "linkedAt" timestamp NOT NULL DEFAULT now()
    )`);
    await runner.query('CREATE UNIQUE INDEX "UQ_academic_identity_student" ON academic_identities ("universityId", "userId")');
    await runner.query('CREATE UNIQUE INDEX "UQ_academic_identity_source_user" ON academic_identities ("universityId", "sourceBaseUrl", "externalUserId")');
    await new TenantRowSecurity1700000000029().up(runner);
  }
  async down(runner: QueryRunner): Promise<void> { await runner.query('DROP TABLE academic_identities'); }
}
