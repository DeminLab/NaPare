import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('absences')
@Index('IDX_absences_university_student_created_at', [
  'universityId',
  'studentId',
  'createdAt',
])
@Index('IDX_absences_university_start_date', ['universityId', 'startDate'])
@Index('IDX_absences_university_created_at', ['universityId', 'createdAt'])
export class Absence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: ['learning', 'sick', 'work', 'other_city', 'other'],
    default: 'other',
  })
  type: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ nullable: true })
  comment: string;

  @Column({ default: false })
  isSensitive: boolean;

  @Column({ default: true })
  confirmationRequired: boolean;

  @Column('uuid', { array: true, nullable: true })
  affectedLessonIds: string[];

  @Column({ type: 'int', default: 0 })
  affectedLessonsCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
