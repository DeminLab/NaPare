import { MigrationInterface, QueryRunner } from 'typeorm';

export class CareerTaskFavorites1700000000051 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user_favorites" DROP CONSTRAINT IF EXISTS "CHK_user_favorites_kind"');
    await queryRunner.query(`ALTER TABLE "user_favorites" ADD CONSTRAINT "CHK_user_favorites_kind" CHECK ("kind" IN ('group', 'teacher', 'career_task'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [row] = await queryRunner.query(`SELECT EXISTS (SELECT 1 FROM "user_favorites" WHERE "kind" = 'career_task') AS "hasCareerFavorites"`);
    if (row.hasCareerFavorites) throw new Error('Rollback would invalidate saved career tasks');
    await queryRunner.query('ALTER TABLE "user_favorites" DROP CONSTRAINT "CHK_user_favorites_kind"');
    await queryRunner.query(`ALTER TABLE "user_favorites" ADD CONSTRAINT "CHK_user_favorites_kind" CHECK ("kind" IN ('group', 'teacher'))`);
  }
}
