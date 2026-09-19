import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { ProvenanceSyncStatus } from '../academic.types';

@Entity('lesson_series')
@Index('IDX_lesson_series_university_course', ['universityId', 'courseId'])
@Index('IDX_lesson_series_university_group', ['universityId', 'groupId'])
@Index('IDX_lesson_series_university_teacher', ['universityId', 'teacherId'])
export class LessonSeries {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  courseId: string;

  @Column({ type: 'uuid' })
  groupId: string;

  @Column({ type: 'uuid', nullable: true })
  teacherId: string | null;

  @Column({ nullable: true })
  title: string | null;

  @Column({ nullable: true })
  subjectType: string | null;

  @Column({ type: 'varchar', default: 'weekly' })
  recurrenceRule: string;

  @Column({ type: 'int' })
  dayOfWeek: number;

  @Column({ length: 5 })
  startTime: string;

  @Column({ length: 5 })
  endTime: string;

  @Column({ type: 'int' })
  pairNumber: number;

  @Column({ type: 'varchar', default: 'both' })
  weekType: string;

  @Column({ nullable: true })
  room: string | null;

  @Column({ nullable: true })
  building: string | null;

  @Column({ type: 'timestamp' })
  validFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  validTo: Date | null;

  @Column({ nullable: true })
  source: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ nullable: true })
  sourceVersion: string | null;

  @Column({ type: 'varchar', default: 'unknown' })
  syncStatus: ProvenanceSyncStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
