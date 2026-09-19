import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { MoreThan, Repository } from 'typeorm';

import { JsonObject } from '../common/types/json-value.type';
import { EventRecord } from './entities/event-record.entity';
import {
  EventEnvelope,
  EventStreamMessage,
  PublishEventInput,
} from './event.types';

interface EventStream {
  userId: string;
  universityId: string;
  subscriber: (message: EventStreamMessage) => void;
  heartbeat: ReturnType<typeof setInterval>;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly streams = new Set<EventStream>();

  constructor(
    @InjectRepository(EventRecord)
    private readonly eventRepository: Repository<EventRecord>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async publish<TPayload extends JsonObject>(input: PublishEventInput<TPayload>): Promise<EventEnvelope<TPayload>> {
    if (input.idempotencyKey) {
      const existing = await this.eventRepository.findOne({
        where: { universityId: input.universityId, idempotencyKey: input.idempotencyKey },
      });
      if (existing) return this.toEnvelope(existing) as EventEnvelope<TPayload>;
    }

    const timestamp = new Date();
    const envelope: EventEnvelope<TPayload> = {
      id: randomUUID(),
      type: input.type,
      actor: input.actor ?? { type: 'system' },
      timestamp: timestamp.toISOString(),
      university: { id: input.universityId },
      target: input.target,
      payload: input.payload,
      priority: input.priority ?? 'normal',
      ...(input.recipients?.length ? { recipients: input.recipients } : {}),
    };

    await this.eventRepository.save(this.eventRepository.create({
      id: envelope.id,
      type: envelope.type,
      actor: envelope.actor,
      timestamp,
      universityId: input.universityId,
      idempotencyKey: input.idempotencyKey ?? null,
      target: envelope.target,
      payload: envelope.payload,
      priority: envelope.priority,
      recipients: envelope.recipients ?? null,
    }));

    this.dispatch(envelope);
    this.eventEmitter.emit('napare.event', envelope);
    return envelope;
  }

  async listSince(
    userId: string,
    universityId: string,
    since?: Date,
    limit = 100,
  ): Promise<EventEnvelope[]> {
    const records = await this.eventRepository.find({
      where: { universityId, ...(since ? { timestamp: MoreThan(since) } : {}) },
      order: { timestamp: 'ASC' },
      take: Math.min(Math.max(limit, 1), 500),
    });

    return records
      .filter((record) => !record.recipients?.length || record.recipients.includes(userId))
      .map((record) => this.toEnvelope(record));
  }

  stream(userId: string, universityId: string, since?: Date): Observable<EventStreamMessage> {
    return new Observable<EventStreamMessage>((subscriber) => {
      const seenEventIds = new Set<string>();
      const stream: EventStream = {
        userId,
        universityId,
        subscriber: (message) => {
          if (message.type !== 'heartbeat' && seenEventIds.has(message.id)) return;
          if (message.type !== 'heartbeat') seenEventIds.add(message.id);
          subscriber.next(message);
        },
        heartbeat: setInterval(() => subscriber.next({
          id: `heartbeat-${Date.now()}`,
          type: 'heartbeat',
          data: { type: 'heartbeat', timestamp: new Date().toISOString() },
        }), 30000),
      };
      this.streams.add(stream);

      void this.listSince(userId, universityId, since, 100).then((events) => {
        for (const event of events) {
          stream.subscriber({ id: event.id, type: event.type, data: event });
        }
      }).catch((error: unknown) => {
        this.logger.error('Failed to replay events for SSE stream', error);
        subscriber.error(error);
      });

      return () => {
        clearInterval(stream.heartbeat);
        this.streams.delete(stream);
      };
    });
  }

  private dispatch(event: EventEnvelope): void {
    for (const stream of this.streams) {
      if (stream.universityId !== event.university.id) continue;
      if (event.recipients?.length && !event.recipients.includes(stream.userId)) continue;
      stream.subscriber({ id: event.id, type: event.type, data: event });
    }
  }

  private toEnvelope(record: EventRecord): EventEnvelope {
    return {
      id: record.id,
      type: record.type,
      actor: record.actor,
      timestamp: record.timestamp.toISOString(),
      university: { id: record.universityId },
      target: record.target,
      payload: record.payload,
      priority: record.priority,
      ...(record.recipients?.length ? { recipients: record.recipients } : {}),
    };
  }
}
