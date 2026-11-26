import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformAcademicStructureArchive1700000000060 implements MigrationInterface {
  name = 'PlatformAcademicStructureArchive1700000000060';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE faculties ADD COLUMN IF NOT EXISTS "archivedAt" timestamp NULL');
    await queryRunner.query('ALTER TABLE groups ADD COLUMN IF NOT EXISTS "archivedAt" timestamp NULL');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_faculties_archivedAt" ON faculties ("archivedAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_groups_archivedAt" ON groups ("archivedAt")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [state] = await queryRunner.query(`
      SELECT
        (SELECT count(*) FROM faculties WHERE "archivedAt" IS NOT NULL)::int AS faculties,
        (SELECT count(*) FROM groups WHERE "archivedAt" IS NOT NULL)::int AS groups
    `);
    if (state.faculties || state.groups) {
      throw new Error('Cannot remove academic structure archive metadata while archived faculties or groups exist');
    }
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_groups_archivedAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_faculties_archivedAt"');
    await queryRunner.query('ALTER TABLE groups DROP COLUMN IF EXISTS "archivedAt"');
    await queryRunner.query('ALTER TABLE faculties DROP COLUMN IF EXISTS "archivedAt"');
  }
}
