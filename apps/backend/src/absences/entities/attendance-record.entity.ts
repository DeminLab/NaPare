import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AttendanceStatus = 'present' | 'absent' | 'late';

@Entity('attendance_records')
@Index('UQ_attendance_records_lesson_student', ['lessonId', 'studentId'], { unique: true })
@Index('IDX_attendance_records_university_lesson', ['universityId', 'lessonId'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  lessonId: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: ['present', 'absent', 'late'],
    enumName: 'attendance_records_status_enum',
    default: 'present',
  })
  status: AttendanceStatus;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'uuid', nullable: true })
  markedById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
