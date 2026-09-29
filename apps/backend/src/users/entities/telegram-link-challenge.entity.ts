import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("telegram_link_challenges")
@Index("IDX_telegram_link_challenges_token_hash", ["tokenHash"], { unique: true })
@Index("IDX_telegram_link_challenges_user_created", ["userId", "createdAt"])
export class TelegramLinkChallenge {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "varchar", length: 64 })
  tokenHash: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
