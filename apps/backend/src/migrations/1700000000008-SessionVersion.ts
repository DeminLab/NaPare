import { MigrationInterface, QueryRunner } from "typeorm";

export class SessionVersion1700000000008 implements MigrationInterface {
  name = "SessionVersion1700000000008";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "sessionVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sessionVersion"`);
  }
}
