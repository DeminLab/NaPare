import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantRowSecurity1700000000029 } from './1700000000029-TenantRowSecurity';

export class OfficeAssignments1700000000031 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE office_assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id),
      "userId" uuid NOT NULL REFERENCES users(id), duty varchar NOT NULL CHECK (duty IN ('office','methodologist','dispatcher')),
      "facultyIds" uuid[] NOT NULL DEFAULT '{}', "groupIds" uuid[] NOT NULL DEFAULT '{}',
      "canCreateForStudents" boolean NOT NULL DEFAULT false, "assignedBy" uuid NOT NULL REFERENCES users(id),
      "revokedAt" timestamp NULL, "revokedBy" uuid NULL REFERENCES users(id), "createdAt" timestamp NOT NULL DEFAULT now()
    ); CREATE INDEX "IDX_office_assignment_actor" ON office_assignments ("universityId","userId");
    CREATE TABLE office_routes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id),
      "groupId" uuid NOT NULL REFERENCES groups(id), type varchar NOT NULL CHECK (type IN ('absence','transfer','retake')),
      "assigneeIds" uuid[] NOT NULL, version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      "dueDays" integer NOT NULL DEFAULT 5 CHECK ("dueDays" BETWEEN 1 AND 90),
      "configuredBy" uuid NOT NULL REFERENCES users(id), "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_office_route_group_type" UNIQUE ("universityId","groupId",type)
    )`);
    await new TenantRowSecurity1700000000029().up(runner);
  }
  async down(runner: QueryRunner): Promise<void> { await runner.query('DROP TABLE office_routes; DROP TABLE office_assignments'); }
}
