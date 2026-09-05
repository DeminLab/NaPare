import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { Announcement } from './announcement.entity';
import { Homework } from './homework.entity';

@Entity('pair_spaces')
export class PairSpace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  lessonId: string;

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

  @OneToMany(() => Announcement, (announcement) => announcement.pairSpace)
  announcements: Announcement[];

  @OneToMany(() => Homework, (homework) => homework.pairSpace)
  homeworks: Homework[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
