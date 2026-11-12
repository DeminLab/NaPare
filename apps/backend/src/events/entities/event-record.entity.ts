import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { JsonObject } from '../../common/types/json-value.type';
import { EventActor, EventPriority, EventTarget, NapareEventType } from '../event.types';

@Entity('event_records')
@Index('IDX_event_records_university_timestamp', ['organizationId', 'timestamp'])
@Index('IDX_event_records_type_timestamp', ['type', 'timestamp'])
@Index('UQ_event_records_organization_idempotency_key', ['organizationId', 'idempotencyKey'], { unique: true, where: '\"idempotencyKey\" IS NOT NULL' })
export class EventRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: NapareEventType;

  @Column({ type: 'jsonb' })
  actor: EventActor;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'jsonb' })
  target: EventTarget;

  @Column({ type: 'jsonb' })
  payload: JsonObject;

  @Column({ type: 'varchar', default: 'normal' })
  priority: EventPriority;

  @Column({ type: 'jsonb', nullable: true })
  recipients: string[] | null;
}
