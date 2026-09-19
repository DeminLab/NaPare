import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { Announcement } from './announcement.entity';
import { Homework } from './homework.entity';
import { FileAttachment } from './file-attachment.entity';
import { DiscussionMessage } from './discussion-message.entity';

@Entity('pair_spaces')
@Index('UQ_pair_spaces_lesson_id', ['lessonId'], { unique: true })
export class PairSpace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  lessonId: string;

  @Column({ type: 'uuid', nullable: true })
  courseId: string | null;

  @Column({ type: 'uuid', nullable: true })
  lessonOccurrenceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  lessonSpaceId: string | null;

  @Column()
  subject: string;

  @Column()
  date: Date;

  @Column()
  pairNumber: number;

  @Column({ nullable: true })
  teacherName: string;

  @Column({ nullable: true })
  group: string;

  @Column({ nullable: true })
  room: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  source: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ nullable: true })
  sourceVersion: string | null;

  @Column({ type: 'varchar', default: 'unknown' })
  syncStatus: string;

  @Column({ type: 'timestamp', nullable: true })
  activeUntil: Date;

  @OneToMany(() => Announcement, (announcement) => announcement.pairSpace)
  announcements: Announcement[];

  @OneToMany(() => Homework, (homework) => homework.pairSpace)
  homeworks: Homework[];

  @OneToMany(() => FileAttachment, (file) => file.pairSpace)
  files: FileAttachment[];

  @OneToMany(() => DiscussionMessage, (message) => message.pairSpace)
  messages: DiscussionMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
