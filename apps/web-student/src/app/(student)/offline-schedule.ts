// Shared by the worker and its cold-start offline document. Never store auth headers.
export const OFFLINE_CACHE = 'napare-student-schedule-v1';
export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function offlineOwner(token: string | null): string | null {
  try {
    const encoded = token?.split('.')[1];
    if (!encoded) return null;
    const claims = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string' || claims.role !== 'student') return null;
    if (!/^[\w-]{1,80}$/.test(claims.sub) || !/^[\w-]{1,80}$/.test(claims.universityId)) return null;
    return `${claims.universityId}/${claims.sub}`;
  } catch { return null; }
}

export function offlinePayload(path: string, body: unknown) {
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 1000) : '';
  const pickLesson = (value: unknown) => {
    const row = record(value);
    return Object.fromEntries(['id', 'date', 'startDate', 'startTime', 'endTime', 'subject', 'teacherName', 'room', 'building', 'changeDescription'].map(key => [key, text(row[key])]));
  };
  const source = record(body);
  if (path === '/api/v1/schedule/range' || path === '/api/v1/my-day') {
    const rows = Array.isArray(source.data) ? source.data : Array.isArray(source.lessons) ? source.lessons : [];
    if (rows.length > 500) return null;
    return { kind: 'schedule', lessons: rows.map(pickLesson) };
  }
  if (/^\/api\/v1\/pair-spaces\/[\da-f-]{36}$/i.test(path)) {
    const notes = (value: unknown) => Array.isArray(value) ? value.slice(0, 30).map(item => {
      const row = record(item);
      return { title: text(row.title), description: text(row.description), deadline: text(row.deadline) };
    }) : [];
    return { kind: 'pair', ...pickLesson(source), lessonId: text(source.lessonId), homeworks: notes(source.homeworks) };
  }
  return null;
}
