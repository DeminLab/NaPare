import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { PairSpace } from './pair-space.entity';

@Entity('homeworks')
export class Homework {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pairSpaceId: string;

  @ManyToOne(() => PairSpace, (pairSpace) => pairSpace.homeworks)
  @JoinColumn({ name: 'pairSpaceId' })
  pairSpace: PairSpace;

  @Column({ type: 'uuid' })
  authorId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
