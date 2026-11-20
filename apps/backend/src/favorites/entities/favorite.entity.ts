import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const FAVORITE_KINDS = ['group', 'teacher'] as const;
export type FavoriteKind = typeof FAVORITE_KINDS[number];
export const CAREER_FAVORITE_KIND = 'career_task' as const;

@Entity('user_favorites')
@Index('UQ_user_favorites_owner_kind_external', ['userId', 'organizationId', 'kind', 'externalId'], { unique: true })
@Index('IDX_user_favorites_tenant_owner', ['organizationId', 'userId'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 16 })
  kind: FavoriteKind | typeof CAREER_FAVORITE_KIND;

  @Column({ type: 'varchar', length: 220 })
  externalId: string;

  @Column({ type: 'varchar', length: 220 })
  label: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
