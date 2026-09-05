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
  universityId: string;

  @Column({ type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;

  @Column({ type: 'jsonb' })
  oldValue: any;

  @Column({ type: 'jsonb' })
  newValue: any;

  @Column()
  changeType: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ default: false })
  isApproved: boolean;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
