import { BadGatewayException, BadRequestException } from '@nestjs/common';

export interface SemesterPeriod { id: string; label: string; courseIds: number[] }
export function semesterPeriods(value: unknown): SemesterPeriod[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 30) throw new BadRequestException('Администратору нужно проверить список семестров Moodle.');
  const seen = new Set<string>();
  return value.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new BadRequestException('Некорректная настройка семестра.');
    const item = row as Record<string, unknown>;
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || seen.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 200 || !Array.isArray(item.courseIds) || !item.courseIds.length || item.courseIds.length > 200 || item.courseIds.some(id => !Number.isSafeInteger(id) || Number(id) < 1) || new Set(item.courseIds).size !== item.courseIds.length) throw new BadRequestException('Проверьте ID, название и 1–200 уникальных курсов семестра.');
    seen.add(item.id);
    return { id: item.id, label: item.label.trim(), courseIds: item.courseIds as number[] };
  });
}
export function objectRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadGatewayException('Moodle вернул некорректную учебную запись.');
  return value as Record<string, unknown>;
}
export const sourceFlag = (value: unknown) => {
  if (value === undefined || value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  throw new BadGatewayException('Moodle вернул некорректный признак видимости оценки.');
};
const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = (value: unknown, maximum = 500) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').slice(0, maximum) : null;
export function semesterGrade(value: unknown) {
  const item = objectRow(value);
  if (!Number.isSafeInteger(item.id) || Number(item.id) < 1 || typeof item.itemtype !== 'string') throw new BadGatewayException('Moodle вернул некорректный ID оценки.');
  const hidden = sourceFlag(item.gradeishidden) || sourceFlag(item.gradehiddenbydate), stale = sourceFlag(item.gradeneedsupdate);
  // No implicit pass threshold: Moodle's standard response is not a debt register.
  return {
    id: Number(item.id), name: text(item.itemname) ?? '', type: item.itemtype.slice(0, 40),
    hidden, stale, raw: hidden || stale ? null : numeric(item.graderaw),
    display: hidden || stale ? null : text(item.gradeformatted),
    minimum: hidden ? null : numeric(item.grademin), maximum: hidden ? null : numeric(item.grademax),
    gradedAt: hidden || !Number.isSafeInteger(item.gradedategraded) || Number(item.gradedategraded) <= 0 || Number(item.gradedategraded) > 8640000000000 ? null : new Date(Number(item.gradedategraded) * 1000).toISOString(),
  };
}
