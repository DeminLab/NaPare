import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { AcademicEventPayload, AcademicEventType } from '../academic.types';

@Entity('academic_events')
@Index('IDX_academic_events_university_starts_at', ['universityId', 'startsAt'])
@Index('IDX_academic_events_university_type', ['universityId', 'type'])
@Index('IDX_academic_events_context', ['universityId', 'courseId', 'groupId'])
export class AcademicEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'varchar' })
  type: AcademicEventType;

  @Column({ type: 'uuid', nullable: true })
  courseId: string | null;

  @Column({ type: 'uuid', nullable: true })
  groupId: string | null;

  @Column({ type: 'uuid', nullable: true })
  occurrenceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'varchar', default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ type: 'jsonb', nullable: true })
  payload: AcademicEventPayload | null;

  @Column({ nullable: true })
  source: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ nullable: true })
  sourceVersion: string | null;

  @Column({ type: 'varchar', default: 'unknown' })
  syncStatus: string;

  @CreateDateColumn()
  createdAt: Date;
}
