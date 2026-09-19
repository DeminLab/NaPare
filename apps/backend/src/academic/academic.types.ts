import { JsonObject } from '../common/types/json-value.type';

export const ACADEMIC_EVENT_TYPES = [
  'lesson',
  'homework',
  'exam',
  'announcement',
  'schedule_change',
  'absence',
  'university_event',
  'personal_task',
] as const;
export type AcademicEventType = (typeof ACADEMIC_EVENT_TYPES)[number];

export const LESSON_OCCURRENCE_STATUSES = ['scheduled', 'cancelled', 'rescheduled', 'completed'] as const;
export type LessonOccurrenceStatus = (typeof LESSON_OCCURRENCE_STATUSES)[number];

export const PROVENANCE_SYNC_STATUSES = ['unknown', 'synced', 'stale', 'failed'] as const;
export type ProvenanceSyncStatus = (typeof PROVENANCE_SYNC_STATUSES)[number];

export interface AcademicProvenance {
  source?: string;
  lastSyncedAt?: Date | null;
  sourceVersion?: string | null;
  syncStatus?: ProvenanceSyncStatus;
}

export type AcademicEventPayload = JsonObject;
