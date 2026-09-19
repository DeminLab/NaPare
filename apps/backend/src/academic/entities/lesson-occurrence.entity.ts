import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { LessonOccurrenceStatus, ProvenanceSyncStatus } from '../academic.types';

@Entity('lesson_occurrences')
@Index('UQ_lesson_occurrences_series_starts_at', ['seriesId', 'startsAt'], { unique: true })
@Index('IDX_lesson_occurrences_university_starts_at', ['universityId', 'startsAt'])
@Index('IDX_lesson_occurrences_university_group_starts_at', ['universityId', 'groupId', 'startsAt'])
@Index('IDX_lesson_occurrences_university_course_starts_at', ['universityId', 'courseId', 'startsAt'])
export class LessonOccurrence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  seriesId: string;

  @Column({ type: 'uuid' })
  courseId: string;

  @Column({ type: 'uuid' })
  groupId: string;

  @Column({ type: 'uuid', nullable: true })
  teacherId: string | null;

  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  endsAt: Date;

  @Column({ nullable: true })
  room: string | null;

  @Column({ nullable: true })
  building: string | null;

  @Column({ type: 'varchar', default: 'scheduled' })
  status: LessonOccurrenceStatus;

  @Column({ type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  legacyLessonId: string | null;

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
