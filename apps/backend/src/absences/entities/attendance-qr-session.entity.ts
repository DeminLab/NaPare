import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('attendance_qr_sessions')
@Index('UQ_attendance_qr_sessions_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_attendance_qr_sessions_lesson_expiry', ['universityId', 'lessonId', 'expiresAt'])
@Index('IDX_attendance_qr_sessions_university_expiry', ['universityId', 'expiresAt'])
export class AttendanceQrSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  lessonId: string;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
