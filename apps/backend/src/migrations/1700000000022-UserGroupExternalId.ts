import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserGroupExternalId1700000000022 implements MigrationInterface {
  name = 'UserGroupExternalId1700000000022';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "groupId" TYPE varchar
      USING "groupId"::text
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    const [{ count }] = await runner.query(`
      SELECT count(*)::int AS count
      FROM "users"
      WHERE "groupId" IS NOT NULL
        AND "groupId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);
    if (count > 0) {
      throw new Error('Cannot restore UUID user group ids while external group ids are assigned.');
    }
    await runner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "groupId" TYPE uuid
      USING NULLIF("groupId", '')::uuid
    `);
  }
}
