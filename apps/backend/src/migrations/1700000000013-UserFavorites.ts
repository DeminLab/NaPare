import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserFavorites1700000000013 implements MigrationInterface {
  name = 'UserFavorites1700000000013';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user_favorites" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "universityId" uuid NOT NULL,
      "kind" character varying(16) NOT NULL,
      "externalId" character varying(220) NOT NULL,
      "label" character varying(220) NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_user_favorites" PRIMARY KEY ("id"),
      CONSTRAINT "FK_user_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_user_favorites_university" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE,
      CONSTRAINT "CHK_user_favorites_kind" CHECK ("kind" IN ('group', 'teacher'))
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_user_favorites_owner_kind_external" ON "user_favorites" ("userId", "universityId", "kind", "externalId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_favorites_tenant_owner" ON "user_favorites" ("universityId", "userId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_favorites_tenant_owner"`);
    await queryRunner.query(`DROP INDEX "UQ_user_favorites_owner_kind_external"`);
    await queryRunner.query(`DROP TABLE "user_favorites"`);
  }
}
