import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { PairSpace } from './pair-space.entity';

@Entity('file_attachments')
@Index('IDX_file_attachments_pair_space_id', ['pairSpaceId'])
export class FileAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pairSpaceId: string;

  @ManyToOne(() => PairSpace)
  @JoinColumn({ name: 'pairSpaceId' })
  pairSpace: PairSpace;

  @Column({ type: 'uuid' })
  uploadedBy: string;

  @Column()
  fileUrl: string;

  @Column()
  fileName: string;

  @Column({
    type: 'enum',
    enum: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'png'],
  })
  fileType: string;

  @Column({ type: 'int' })
  size: number;

  @CreateDateColumn()
  createdAt: Date;
}
