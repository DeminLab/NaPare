import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeUserRole1700000000001 implements MigrationInterface {
  name = 'NormalizeUserRole1700000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const legacyRole = table?.findColumnByName('roles');
    const canonicalRole = table?.findColumnByName('role');

    if (legacyRole && !canonicalRole) {
      await queryRunner.renameColumn('users', 'roles', 'role');
    }

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE users_role_enum AS ENUM (
          'student', 'teacher', 'curator', 'faculty_dean',
          'department_head', 'university_admin', 'superadmin', 'developer'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" DROP DEFAULT,
      ALTER COLUMN "role" TYPE users_role_enum
      USING "role"::text::users_role_enum
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" SET DEFAULT 'student'::users_role_enum,
      ALTER COLUMN "role" SET NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" TYPE TEXT USING "role"::text
    `);
    await queryRunner.renameColumn('users', 'role', 'roles');
  }
}
