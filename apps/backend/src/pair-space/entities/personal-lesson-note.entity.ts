import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('personal_lesson_notes')
@Index('UQ_personal_lesson_notes_pair_space_user', ['pairSpaceId', 'userId'], { unique: true })
export class PersonalLessonNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  pairSpaceId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
