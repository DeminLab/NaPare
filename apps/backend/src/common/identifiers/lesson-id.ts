export interface RaspLessonId {
  sourceLessonId: string;
  groupExternalId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedLessonId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseRaspLessonId(value: string): RaspLessonId | null {
  const match = /^rasp-(.+)-(\d+)$/.exec(value);
  return match
    ? { sourceLessonId: match[1], groupExternalId: match[2] }
    : null;
}
