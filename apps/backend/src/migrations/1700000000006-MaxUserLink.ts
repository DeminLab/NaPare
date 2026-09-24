import { MigrationInterface, QueryRunner } from 'typeorm';

export class MaxUserLink1700000000006 implements MigrationInterface {
  name = 'MaxUserLink1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "maxUserId" character varying`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_max_user_id" ON "users" ("maxUserId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_max_user_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "maxUserId"`);
  }
}
