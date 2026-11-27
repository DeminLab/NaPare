import { MigrationInterface, QueryRunner } from 'typeorm';

/** Permit teacher accounts created from a schedule source to have no contact email. */
export class NullableTeacherEmail1700000000062 implements MigrationInterface {
  name = 'NullableTeacherEmail1700000000062';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_email_or_linked_teacher"
        CHECK ("email" IS NOT NULL OR ("role" = 'teacher' AND "sourceTeacherId" IS NOT NULL));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query('SELECT count(*)::int AS count FROM "users" WHERE "email" IS NULL');
    if (count) throw new Error('Cannot restore NOT NULL on users.email while accounts without email exist');
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT "CHK_users_email_or_linked_teacher";
      ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
    `);
  }
}
