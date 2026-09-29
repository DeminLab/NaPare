import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const FAVORITE_KINDS = ['group', 'teacher'] as const;
export type FavoriteKind = typeof FAVORITE_KINDS[number];

@Entity('user_favorites')
@Index('UQ_user_favorites_owner_kind_external', ['userId', 'universityId', 'kind', 'externalId'], { unique: true })
@Index('IDX_user_favorites_tenant_owner', ['universityId', 'userId'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'varchar', length: 16 })
  kind: FavoriteKind;

  @Column({ type: 'varchar', length: 220 })
  externalId: string;

  @Column({ type: 'varchar', length: 220 })
  label: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
