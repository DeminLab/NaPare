import { MigrationInterface, QueryRunner } from 'typeorm';

export class CuratorAssignments1700000000020 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE curator_assignments (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "universityId" uuid NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
      "groupId" uuid NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      "grantedBy" uuid REFERENCES users(id) ON DELETE RESTRICT,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "revokedAt" timestamp,
      "revokedBy" uuid REFERENCES users(id) ON DELETE RESTRICT
    )`);
    await runner.query(`CREATE UNIQUE INDEX "UQ_curator_assignment_active" ON curator_assignments ("groupId", "userId") WHERE "revokedAt" IS NULL`);
    await runner.query(`CREATE INDEX "IDX_curator_assignment_user" ON curator_assignments ("universityId", "userId")`);
    // Only validated existing accounts in the same university are transferred.
    await runner.query(`INSERT INTO curator_assignments ("universityId", "groupId", "userId")
      SELECT g."universityId", g.id, u.id FROM groups g JOIN users u ON u.id = g."curatorId"
      WHERE u."universityId" = g."universityId" AND u."isActive" = true
      AND u.role IN ('student', 'teacher', 'curator', 'faculty_dean', 'department_head', 'university_admin')`);
  }
  async down(): Promise<void> {
    throw new Error('Curator assignment history must be preserved; an explicit data migration is required.');
  }
}
