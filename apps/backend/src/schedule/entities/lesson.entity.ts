import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lessons')
@Index(['universityId', 'groupId', 'dayOfWeek'])
@Index(['universityId', 'teacherId', 'dayOfWeek'])
@Index('IDX_lessons_university_start_date_pair_number', [
  'universityId',
  'startDate',
  'pairNumber',
])
@Index('IDX_lessons_university_group_start_date_pair_number', [
  'universityId',
  'groupId',
  'startDate',
  'pairNumber',
])
@Index('IDX_lessons_university_teacher_start_date_pair_number', [
  'universityId',
  'teacherId',
  'startDate',
  'pairNumber',
])
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  groupId: string;

  @Column({ type: 'uuid', nullable: true })
  teacherId: string;

  @Column()
  subject: string;

  @Column({ nullable: true })
  subjectType: string;

  @Column({ nullable: true })
  room: string;

  @Column({ nullable: true })
  building: string;

  @Column({ type: 'int' })
  dayOfWeek: number;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @Column({ type: 'int' })
  pairNumber: number;

  @Column({
    type: 'enum',
    enum: ['odd', 'even', 'both'],
    default: 'both',
  })
  weekType: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ nullable: true })
  teacherName: string;

  @Column({ nullable: true })
  groupName: string;

  @Column({ nullable: true })
  subgroup: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  faculty: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: false })
  isChanged: boolean;

  @Column({ nullable: true })
  changeDescription: string;

  @Column({ nullable: true })
  source: string;

  @Column({ nullable: true })
  externalId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
