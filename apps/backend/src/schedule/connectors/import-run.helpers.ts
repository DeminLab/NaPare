import { Lesson } from '../entities/lesson.entity';
import { JsonObject } from '../../common/types/json-value.type';
import {
  ImportRollbackConflict,
  MassChangeReason,
  ScheduleImportPlan,
  ScheduleImportRowResult,
} from './schedule-connector';

/** Journal meta keys added by the importer on top of the lesson snapshot. */
const JOURNAL_META_KEYS = ['changeType', 'importJobId', 'rollbackRunId'];

/**
 * FR-IMP-08 decision for one import: mass changes need an explicit
 * confirmation, and an empty snapshot can never be exempted by the
 * organization threshold.
 */
export function massChangeDecision(input: {
  summary: { updated: number; deleted: number };
  existingActive: number;
  threshold: number;
  replace: boolean;
  validRows: number;
}): { requiresConfirmation: boolean; reasons: MassChangeReason[]; changedRatio: number } {
  const changed = input.summary.updated + input.summary.deleted;
  const changedRatio = input.existingActive > 0 ? Math.min(1, changed / input.existingActive) : 0;
  const reasons: MassChangeReason[] = [];
  if (input.existingActive > 0 && changed > 0 && changedRatio * 100 > input.threshold) reasons.push('mass-change');
  if (input.replace && input.validRows === 0) reasons.push('empty-snapshot');
  return { requiresConfirmation: reasons.length > 0, reasons, changedRatio };
}

/** Plan-level warnings that accompany the confirmation gate (FR-IMP-04). */
export function confirmationWarnings(
  reasons: MassChangeReason[],
  input: { changed: number; existingActive: number; threshold: number; errors: number; validRows: number },
): string[] {
  const warnings: string[] = [];
  if (input.errors > 0) warnings.push(`Строк с ошибками: ${input.errors} — они не будут применены.`);
  if (reasons.includes('mass-change')) {
    const percent = input.existingActive > 0 ? Math.round((input.changed / input.existingActive) * 1000) / 10 : 0;
    warnings.push(`Изменяется ${input.changed} занятий (${percent}% активных занятий вуза) при пороге ${input.threshold}% — требуется отдельное подтверждение.`);
  }
  if (reasons.includes('empty-snapshot')) {
    warnings.push('Пустой снимок: в файле нет занятий — подтверждение отменит занятия источника в указанном диапазоне. Порог организации это не отключает.');
  }
  return warnings;
}

const OUTCOME_LABELS: Record<ScheduleImportRowResult['outcome'], string> = {
  created: 'создано',
  updated: 'изменено',
  deleted: 'удалено',
  unchanged: 'без изменений',
  error: 'ошибка',
};

/** Neutralize CSV/formula injection while keeping the value readable. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  text = text.replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * FR-IMP-04 downloadable report: one flat table of row outcomes, warnings and
 * errors. BOM + CRLF so Excel opens Russian headers correctly.
 */
export function buildImportReportCsv(plan: ScheduleImportPlan): string {
  const lines = ['Тип;Строка;Внешний ID;Группа;Дата;Предмет;Результат;Сообщение'];
  for (const row of plan.rows) {
    lines.push(['Занятие', row.row || '', row.externalId, row.groupName, row.date, row.subject, OUTCOME_LABELS[row.outcome], row.message || ''].map(csvCell).join(';'));
  }
  for (const warning of plan.warnings) {
    lines.push(['Предупреждение', warning.row || '', warning.externalId || '', '', '', '', '', warning.message].map(csvCell).join(';'));
  }
  // Error rows already appear above with their outcome; keep only entries
  // that have no matching source row (plan-level errors).
  for (const error of plan.errors) {
    if (plan.rows.some(row => row.outcome === 'error' && row.row === error.row)) continue;
    lines.push(['Ошибка', error.row || '', error.externalId || '', '', '', '', '', error.message].map(csvCell).join(';'));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * FR-IMP-05 conflict rule: the lesson must still match the state the import
 * itself produced; anything newer (or a journal whose shape no longer matches
 * the snapshot) blocks the restore so newer data is never overwritten.
 */
export function journalMatchesSnapshot(currentSnapshot: JsonObject, journalValue: JsonObject): boolean {
  const expected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(journalValue)) if (!JOURNAL_META_KEYS.includes(key)) expected[key] = value;
  const current = currentSnapshot as Record<string, unknown>;
  const currentKeys = Object.keys(current);
  if (currentKeys.length !== Object.keys(expected).length) return false;
  for (const key of currentKeys) {
    if (!(key in expected)) return false;
    if (JSON.stringify(current[key] ?? null) !== JSON.stringify(expected[key] ?? null)) return false;
  }
  return true;
}

/**
 * Rebuild the pre-import lesson state from the journal's `originalValue`.
 * Returns null when the journal row is not a usable snapshot (treated as a
 * conflict by the caller, never as a guess).
 */
/**
 * A nullable journal field must come back as `null`, never `undefined`:
 * `undefined` in the restore spread would keep the imported value instead of
 * clearing it. The cast satisfies the entity, whose columns are typed as
 * plain strings despite being nullable.
 */
function nullableString(value: unknown): string {
  return (value === undefined || value === null ? null : String(value)) as string;
}

export function restoreFromJournal(original: JsonObject): Partial<Lesson> | null {
  const required = ['groupId', 'groupName', 'subject', 'startDate', 'endDate', 'startTime', 'endTime', 'pairNumber', 'source', 'externalId'];
  if (required.some(key => original[key] === undefined || original[key] === null)) return null;
  const startDate = new Date(String(original.startDate));
  const endDate = new Date(String(original.endDate));
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return null;
  const pairNumber = Number(original.pairNumber);
  if (!Number.isInteger(pairNumber) || pairNumber < 1) return null;
  return {
    groupId: String(original.groupId),
    groupName: String(original.groupName),
    subject: String(original.subject),
    startDate,
    endDate,
    startTime: String(original.startTime),
    endTime: String(original.endTime),
    pairNumber,
    teacherName: nullableString(original.teacherName),
    room: nullableString(original.room),
    sourceTeacherId: original.sourceTeacherId === undefined || original.sourceTeacherId === null ? null : String(original.sourceTeacherId),
    source: String(original.source),
    externalId: String(original.externalId),
    deletedAt: original.deletedAt === undefined || original.deletedAt === null ? null : new Date(String(original.deletedAt)),
  };
}

/** An empty `originalValue` means the import created the lesson (FR-IMP-05 compensation = remove it). */
export function journalCreatedRow(original: JsonObject): boolean {
  return Object.keys(original).length === 0;
}

export function rollbackConflict(lessonId: string, externalId: string, reason: ImportRollbackConflict['reason']): ImportRollbackConflict {
  return { lessonId, externalId, reason };
}
