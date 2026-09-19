import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { JsonObject } from '../../common/types/json-value.type';

@Entity('academic_schedule_changes')
@Index('IDX_academic_schedule_changes_occurrence_timestamp', ['occurrenceId', 'timestamp'])
@Index('IDX_academic_schedule_changes_university_timestamp', ['universityId', 'timestamp'])
export class ScheduleChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid', nullable: true })
  occurrenceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  legacyLessonId: string | null;

  @Column({ type: 'jsonb' })
  originalValue: JsonObject;

  @Column({ type: 'jsonb' })
  newValue: JsonObject;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ nullable: true })
  source: string | null;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
