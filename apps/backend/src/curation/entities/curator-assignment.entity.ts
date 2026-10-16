import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curator_assignments')
@Index('UQ_curator_assignment_active', ['groupId', 'userId'], { unique: true, where: '"revokedAt" IS NULL' })
@Index('IDX_curator_assignment_user', ['universityId', 'userId'])
export class CuratorAssignment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') groupId: string;
  @Column('uuid') userId: string;
  @Column({ type: 'uuid', nullable: true }) grantedBy: string | null;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'timestamp', nullable: true }) revokedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) revokedBy: string | null;
}
