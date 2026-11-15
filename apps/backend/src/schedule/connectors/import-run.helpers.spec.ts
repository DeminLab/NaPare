import {
  buildImportReportCsv,
  confirmationWarnings,
  csvCell,
  journalCreatedRow,
  journalMatchesSnapshot,
  massChangeDecision,
  restoreFromJournal,
  rollbackConflict,
} from './import-run.helpers';
import { ScheduleImportPlan } from './schedule-connector';

const plan = (overrides: Partial<ScheduleImportPlan> = {}): ScheduleImportPlan => ({
  summary: { imported: 0, updated: 0, deleted: 0, unchanged: 0, errors: 0 },
  rows: [], warnings: [], errors: [], confirmationWarnings: [],
  existingActive: 10, changedRatio: 0, threshold: 30, requiresConfirmation: false, confirmationReasons: [],
  ...overrides,
});

describe('FR-IMP-08 mass-change decision', () => {
  it('never gates creations and compares updates/deletes against university-wide active lessons', () => {
    expect(massChangeDecision({ summary: { updated: 0, deleted: 0 }, existingActive: 10, threshold: 30, replace: false, validRows: 5 }))
      .toMatchObject({ requiresConfirmation: false, changedRatio: 0, reasons: [] });
    const decision = massChangeDecision({ summary: { updated: 3, deleted: 1 }, existingActive: 10, threshold: 30, replace: false, validRows: 5 });
    expect(decision).toMatchObject({ requiresConfirmation: true, reasons: ['mass-change'], changedRatio: 0.4 });
    // Exactly at the threshold stays allowed; only strictly above it gates.
    expect(massChangeDecision({ summary: { updated: 3, deleted: 0 }, existingActive: 10, threshold: 30, replace: false, validRows: 5 }).requiresConfirmation).toBe(false);
    expect(massChangeDecision({ summary: { updated: 4, deleted: 0 }, existingActive: 10, threshold: 30, replace: false, validRows: 5 }).requiresConfirmation).toBe(true);
  });
  it('caps the ratio, honors threshold 100 and always gates an empty snapshot', () => {
    expect(massChangeDecision({ summary: { updated: 50, deleted: 0 }, existingActive: 2, threshold: 100, replace: false, validRows: 3 }).requiresConfirmation).toBe(false);
    expect(massChangeDecision({ summary: { updated: 50, deleted: 0 }, existingActive: 2, threshold: 100, replace: false, validRows: 3 }).changedRatio).toBe(1);
    expect(massChangeDecision({ summary: { updated: 0, deleted: 0 }, existingActive: 10, threshold: 100, replace: true, validRows: 0 }))
      .toMatchObject({ requiresConfirmation: true, reasons: ['empty-snapshot'] });
    expect(massChangeDecision({ summary: { updated: 0, deleted: 0 }, existingActive: 0, threshold: 100, replace: true, validRows: 0 }).changedRatio).toBe(0);
    expect(massChangeDecision({ summary: { updated: 1, deleted: 1 }, existingActive: 5, threshold: 30, replace: true, validRows: 4 }).reasons).toEqual(['mass-change']);
  });
  it('spells out the plan-level warnings for errors, mass change and empty snapshot', () => {
    expect(confirmationWarnings([], { changed: 0, existingActive: 10, threshold: 30, errors: 2, validRows: 3 }))
      .toEqual(['Строк с ошибками: 2 — они не будут применены.']);
    const warnings = confirmationWarnings(['mass-change', 'empty-snapshot'], { changed: 4, existingActive: 10, threshold: 30, errors: 0, validRows: 0 });
    expect(warnings[0]).toContain('40%');
    expect(warnings[0]).toContain('пороге 30%');
    expect(warnings[1]).toContain('Пустой снимок');
    expect(confirmationWarnings(['mass-change'], { changed: 1, existingActive: 3, threshold: 30, errors: 0, validRows: 1 })[0]).toContain('33.3%');
  });
});

describe('FR-IMP-04 report CSV', () => {
  it('neutralizes spreadsheet formulas while keeping the value readable', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('line\r\nbreak')).toBe('"line break"');
    expect(csvCell(null)).toBe('""');
  });
  it('emits a BOM + CRLF table of rows, warnings and plan-level errors only', () => {
    const csv = buildImportReportCsv(plan({
      summary: { imported: 1, updated: 0, deleted: 0, unchanged: 0, errors: 1 },
      rows: [
        { row: 1, externalId: 'a', groupName: 'ИН-25', date: '2026-10-22', subject: 'Математика', outcome: 'created' },
        { row: 2, externalId: 'b', groupName: 'ИН-25', date: '2026-10-23', subject: 'Физика', outcome: 'error', message: 'Некорректная дата.' },
      ],
      warnings: [{ row: 1, message: 'Не указан преподаватель.' }],
      errors: [
        { row: 2, message: 'Некорректная дата.' },
        { row: 0, message: 'Пустой файл.' },
      ],
    }));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Тип;Строка;Внешний ID;Группа;Дата;Предмет;Результат;Сообщение\r\n');
    expect(csv).toContain('"Занятие";"1";"a";"ИН-25";"2026-10-22";"Математика";"создано";""');
    expect(csv).toContain('"ошибка"');
    expect(csv).toContain('"Предупреждение";"1"');
    // Row 2 already appears as an error outcome: only the plan-level entry is extra.
    expect(csv.match(/"Некорректная дата\."/g)).toHaveLength(1);
    expect(csv).toContain('"Ошибка";""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('FR-IMP-05 journal helpers', () => {
  const snapshot = {
    groupId: 'g1', groupName: 'ИН-25', subject: 'Математика',
    startDate: '2026-10-21T19:00:00.000Z', endDate: '2026-10-21T20:30:00.000Z',
    startTime: '01:00', endTime: '02:30', pairNumber: 1,
    teacherName: null, room: null, sourceTeacherId: null,
    source: 'university-import:x', externalId: 'a', deletedAt: null,
  };
  it('matches only against the state the import itself produced', () => {
    expect(journalMatchesSnapshot(snapshot, { ...snapshot, changeType: 'updated', importJobId: 'job' })).toBe(true);
    expect(journalMatchesSnapshot(snapshot, { ...snapshot, subject: 'Другой', changeType: 'updated' })).toBe(false);
    expect(journalMatchesSnapshot(snapshot, { ...snapshot, changeType: 'updated' })).toBe(true);
    // A journal without one of the snapshot keys can never be applied blindly.
    const { room: _room, ...withoutRoom } = snapshot;
    expect(journalMatchesSnapshot(snapshot, withoutRoom)).toBe(false);
    expect(journalMatchesSnapshot(snapshot, { ...snapshot, rollbackRunId: 'run', changeType: 'rollback' })).toBe(true);
  });
  it('rebuilds the pre-import lesson or refuses an unusable journal', () => {
    const restored = restoreFromJournal(snapshot);
    expect(restored).toMatchObject({ subject: 'Математика', pairNumber: 1, deletedAt: null, teacherName: null, room: null });
    expect(restored!.startDate).toBeInstanceOf(Date);
    expect(restoreFromJournal({ ...snapshot, startDate: 'вчера' })).toBeNull();
    expect(restoreFromJournal({ ...snapshot, pairNumber: 0 })).toBeNull();
    expect(restoreFromJournal({ subject: 'Математика' })).toBeNull();
    // null, not undefined: undefined would keep the imported value on restore.
    expect('room' in restoreFromJournal(snapshot)!).toBe(true);
    expect(restoreFromJournal(snapshot)!.room).toBeNull();
  });
  it('recognizes created rows and shapes rollback conflicts', () => {
    expect(journalCreatedRow({})).toBe(true);
    expect(journalCreatedRow(snapshot)).toBe(false);
    expect(rollbackConflict('lesson-1', 'a', 'changed')).toEqual({ lessonId: 'lesson-1', externalId: 'a', reason: 'changed' });
  });
});
