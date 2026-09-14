import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Lesson } from './lesson.entity';
import { JsonObject } from '../../common/types/json-value.type';

@Entity('lesson_changes')
@Index('IDX_lesson_changes_lesson_created_at', ['lessonId', 'createdAt'])
export class LessonChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;

  @Column({
    type: 'enum',
    enum: ['moved', 'cancelled', 'room_changed', 'teacher_changed', 'added'],
  })
  changeType: string;

  @Column({ type: 'jsonb' })
  oldValues: JsonObject;

  @Column({ type: 'jsonb' })
  newValues: JsonObject;

  @Column({ type: 'uuid', nullable: true })
  changedBy: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
