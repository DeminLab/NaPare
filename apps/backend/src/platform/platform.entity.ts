import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_control')
export class PlatformControl {
  @PrimaryColumn({ type: 'varchar', default: 'platform' }) id: string;
  @Column('uuid') ownerId: string;
  @Column({ default: 'НаПаре' }) platformName: string;
  @Column({ default: '' }) supportEmail: string;
  @Column({ type: 'text', default: '' }) announcement: string;
  @Column({ default: false }) readOnly: boolean;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('platform_grants')
export class PlatformGrant {
  @PrimaryColumn('uuid') userId: string;
  @Column('text', { array: true, default: '{}' }) permissions: string[];
  @Column('text', { array: true, default: '{}' }) serviceIds: string[];
  /** NULL keeps legacy global grants; [] denies university data; IDs limit access to those universities. */
  @Column('uuid', { array: true, nullable: true }) universityIds: string[] | null;
  @Column('uuid') grantedBy: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
