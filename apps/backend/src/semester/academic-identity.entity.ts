import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('academic_identities')
@Index('UQ_academic_identity_student', ['organizationId', 'userId'], { unique: true })
@Index('UQ_academic_identity_source_user', ['organizationId', 'sourceBaseUrl', 'externalUserId'], { unique: true })
export class AcademicIdentity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organizationId: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 1024 }) sourceBaseUrl: string;
  @Column({ type: 'varchar', length: 20 }) externalUserId: string;
  @Column({ type: 'uuid' }) linkedBy: string;
  @UpdateDateColumn() linkedAt: Date;
}
