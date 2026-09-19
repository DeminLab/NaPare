import { JsonObject } from '../common/types/json-value.type';

export const NAPARE_EVENT_TYPES = [
  'lesson.changed',
  'lesson.cancelled',
  'lesson.rescheduled',
  'room.changed',
  'homework.created',
  'homework.updated',
  'homework.deadline_soon',
  'announcement.created',
  'message.created',
  'absence.created',
  'absence.updated',
  'attendance.updated',
  'grade.created',
  'sync.completed',
  'sync.failed',
] as const;

export type NapareEventType = (typeof NAPARE_EVENT_TYPES)[number];
export type EventPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface EventActor {
  id?: string;
  type: 'user' | 'system';
  role?: string;
}

export interface EventTarget {
  type: string;
  id: string;
}

export interface EventUniversity {
  id: string;
}

export interface EventEnvelope<TPayload extends JsonObject = JsonObject> {
  id: string;
  type: NapareEventType;
  actor: EventActor;
  timestamp: string;
  university: EventUniversity;
  target: EventTarget;
  payload: TPayload;
  priority: EventPriority;
  recipients?: string[];
}

export interface PublishEventInput<TPayload extends JsonObject = JsonObject> {
  type: NapareEventType;
  /** Stable command/event key used to make retried publishes idempotent. */
  idempotencyKey?: string;
  actor?: EventActor;
  universityId: string;
  target: EventTarget;
  payload: TPayload;
  priority?: EventPriority;
  recipients?: string[];
}

export interface EventStreamMessage {
  id: string;
  type: string;
  data: EventEnvelope | { type: 'heartbeat'; timestamp: string };
}
