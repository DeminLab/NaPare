import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Lesson } from './lesson.entity';

@Entity('lesson_changes')
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
  oldValues: Record<string, any>;

  @Column({ type: 'jsonb' })
  newValues: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  changedBy: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
