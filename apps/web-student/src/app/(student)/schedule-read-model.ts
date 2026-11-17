import { apiFetch } from '@/lib/api';

/**
 * The student screens read one contract, `/schedule/v2`, which merges legacy
 * `lessons` with academic occurrences and keeps a single entry per slot. The
 * legacy paginated endpoint stays as a fallback so a stale deployment or a
 * transient failure never leaves the timetable empty.
 */
export const MAX_V2_RANGE_DAYS = 62;

export interface ScheduleLesson {
  id: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  subject: string;
  subjectType?: string;
  teacherName?: string;
  room?: string;
  building?: string;
  subgroup?: string;
  weekType?: 'odd' | 'even' | 'both';
  startTime: string;
  endTime: string;
  pairNumber?: number;
  isChanged?: boolean;
  changeDescription?: string;
}

export interface ScheduleV2Entry {
  id: string;
  source: 'lesson' | 'series';
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  subjectType?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
  building?: string | null;
  subgroup?: string | null;
  pairNumber?: number | null;
  state: 'scheduled' | 'changed' | 'cancelled';
  change?: { type: string; reason?: string | null } | null;
  lessonId?: string | null;
  seriesId?: string | null;
  occurrenceId?: string | null;
}

export interface ScheduleV2Response {
  range: { from: string; to: string; days: number };
  days: Array<{ date: string; lessons: ScheduleV2Entry[] }>;
}

/** Occurrences without a legacy row keep a prefixed id, so actions stay offline. */
export function entryToLesson(entry: ScheduleV2Entry): ScheduleLesson {
  const reason = entry.change?.reason || '';
  return {
    id: entry.lessonId || entry.id,
    date: entry.date,
    startDate: `${entry.date}T${entry.startTime}:00`,
    endDate: `${entry.date}T${entry.endTime}:00`,
    subject: entry.subject,
    subjectType: entry.subjectType || undefined,
    teacherName: entry.teacherName || undefined,
    room: entry.room || undefined,
    building: entry.building || undefined,
    subgroup: entry.subgroup || undefined,
    startTime: entry.startTime,
    endTime: entry.endTime,
    pairNumber: entry.pairNumber ?? undefined,
    isChanged: entry.state !== 'scheduled',
    changeDescription: entry.state === 'cancelled' ? `Отменено${reason ? `: ${reason}` : ''}` : reason || undefined,
  };
}

export function isScheduleLesson(value: unknown): value is ScheduleLesson {
  if (!value || typeof value !== 'object') return false;
  const lesson = value as Partial<ScheduleLesson>;
  return typeof lesson.id === 'string'
    && typeof lesson.subject === 'string'
    && typeof lesson.startTime === 'string'
    && typeof lesson.endTime === 'string';
}

async function fetchLegacyLessons(from: string, to: string): Promise<ScheduleLesson[]> {
  const lessons: ScheduleLesson[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ startDate: from, endDate: to, page: String(page), limit: '100' });
    const result = await apiFetch<{ data: ScheduleLesson[]; meta: { totalPages: number } }>(`/schedule/range?${query}`);
    lessons.push(...result.data);
    totalPages = result.meta.totalPages;
    page += 1;
  } while (page <= totalPages);
  return lessons;
}

export async function fetchScheduleLessons(from: string, to: string): Promise<ScheduleLesson[]> {
  try {
    const response = await apiFetch<ScheduleV2Response>(`/schedule/v2?from=${from}&to=${to}`);
    if (Array.isArray(response.days)) return response.days.flatMap(day => day.lessons.map(entryToLesson));
  } catch {
    // Fall through to the legacy endpoint.
  }
  return fetchLegacyLessons(from, to);
}
