import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('product_activity_days')
@Index('UQ_product_activity_day_actor', ['universityId','userId','day'], {unique:true})
@Index('IDX_product_activity_day_scope', ['universityId','day'])
export class ProductActivityDay {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') userId: string;
  @Column('date') day: string;
  @Column('varchar') role: string;
}

@Entity('product_analytics_state')
export class ProductAnalyticsState {
  @PrimaryColumn('uuid') universityId: string;
  @Column('timestamp') collectionStartedAt: Date;
  @Column('timestamp',{nullable:true}) onboardingReadyAt: Date|null;
  @Column('timestamp',{nullable:true}) readinessPeriodStart: Date|null;
  @Column('timestamp',{nullable:true}) readinessPeriodEnd: Date|null;
}
