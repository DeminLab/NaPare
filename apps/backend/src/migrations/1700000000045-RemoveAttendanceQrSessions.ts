import { MigrationInterface, QueryRunner } from 'typeorm';
import { AttendanceQrSessions1700000000012 } from './1700000000012-AttendanceQrSessions';

/** QR attendance check-in was removed by product decision; the table and its policies go with it. */
export class RemoveAttendanceQrSessions1700000000045 implements MigrationInterface {
  name = 'RemoveAttendanceQrSessions1700000000045';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_qr_sessions"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await new AttendanceQrSessions1700000000012().up(queryRunner);
  }
}
