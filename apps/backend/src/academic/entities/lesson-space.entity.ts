import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('lesson_spaces')
@Index('UQ_lesson_spaces_occurrence_id', ['occurrenceId'], { unique: true })
@Index('IDX_lesson_spaces_university_course_space', ['universityId', 'courseSpaceId'])
export class LessonSpace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  courseSpaceId: string;

  @Column({ type: 'uuid' })
  occurrenceId: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
