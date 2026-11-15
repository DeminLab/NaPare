'use client';

import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from 'react';
import { ApiError, apiFetch, apiFetchText } from '@/lib/api';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, RequestState, Table, type BadgeVariant } from '@/components/ui';

type Step = 1 | 2 | 3 | 4 | 5;
interface PreviewRow { date: string; startTime: string; endTime: string; pairNumber: number; subject: string; teacher?: string; group: string; room?: string; }
type PlanOutcome = 'created' | 'updated' | 'deleted' | 'unchanged' | 'error';
interface RowIssue { row: number; message: string; externalId?: string }
interface PlanRow { row: number; externalId: string; groupName: string; date: string; subject: string; outcome: PlanOutcome; message?: string }
interface PlanSummary { imported: number; updated: number; deleted: number; unchanged: number; errors: number }
/** Server dry-run answer (FR-IMP-04): a stored plan with no job queued. */
interface DryRunPlan {
  runId: string;
  dryRun: boolean;
  summary: PlanSummary;
  rows: PlanRow[];
  warnings: RowIssue[];
  errors: RowIssue[];
  confirmationWarnings: string[];
  existingActive: number;
  changedRatio: number;
  threshold: number;
  requiresConfirmation: boolean;
  confirmationReasons: string[];
}
interface ApplyResult extends PlanSummary { jobId?: string; status?: string; runId?: string | null }
interface RollbackResult { restored: number; conflicts: Array<{ lessonId: string; externalId: string; reason: string }>; rolledBackAt: string }
interface HistoryItem { id: string; date: string; file: string; imported: number; updated: number; runId?: string; rolledBack?: boolean }
interface RollbackState { busy?: boolean; note?: string; error?: string }
const steps = ['Файл', 'Схема', 'Проверка', 'Просмотр', 'Применение'];
/** Rows rendered inline; the CSV report always carries the complete list. */
const PREVIEW_LIMIT = 100;
const ISSUE_LIMIT = 50;
const headerAliases: Record<keyof PreviewRow, string[]> = {
  date: ['дата', 'date', 'startdate'], startTime: ['начало', 'время начала', 'starttime', 'start'], endTime: ['конец', 'время окончания', 'endtime', 'end'], pairNumber: ['номер пары', 'пара', 'pairnumber', 'pair'], subject: ['предмет', 'дисциплина', 'subject', 'title'], teacher: ['преподаватель', 'teacher', 'teachername'], group: ['группа', 'group', 'groupname'], room: ['аудитория', 'room'],
};
const fieldLabels: Array<{ key: keyof PreviewRow; label: string; required?: boolean }> = [
  { key: 'date', label: 'Дата', required: true }, { key: 'startTime', label: 'Начало', required: true },
  { key: 'endTime', label: 'Конец', required: true }, { key: 'pairNumber', label: 'Номер пары', required: true },
  { key: 'subject', label: 'Предмет', required: true }, { key: 'group', label: 'Группа', required: true },
  { key: 'teacher', label: 'Преподаватель' }, { key: 'room', label: 'Аудитория' },
];
const outcomeMeta: Record<PlanOutcome, { label: string; variant: BadgeVariant }> = {
  created: { label: 'создано', variant: 'green' },
  updated: { label: 'изменено', variant: 'sky' },
  deleted: { label: 'отменено', variant: 'red' },
  unchanged: { label: 'без изменений', variant: 'slate' },
  error: { label: 'ошибка', variant: 'red' },
};

const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('ru-RU');
const dateOnly = (value: unknown) => String(value ?? '').trim().slice(0, 10);
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isSupportedFile = (file: File) => ['csv', 'json'].includes(file.name.split('.').pop()?.toLowerCase() || '');
const formatOf = (name: string) => (name.toLowerCase().endsWith('.csv') ? 'csv' : 'json');
const issueLabel = (row: number) => (row ? `Строка ${row}` : 'Файл');

function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === delimiter && !quoted) { values.push(value.trim()); value = ''; } else value += character;
  }
  values.push(value.trim());
  return values;
}

function rowFromRecord(record: Record<string, unknown>, mapping: Partial<Record<keyof PreviewRow, string>> = {}): PreviewRow {
  const value = (field: keyof PreviewRow) => {
    if (Object.prototype.hasOwnProperty.call(mapping, field)) return mapping[field] ? record[mapping[field]!] : undefined;
    const key = Object.keys(record).find((candidate) => headerAliases[field].includes(normalize(candidate)));
    return key ? record[key] : undefined;
  };
  return { date: dateOnly(value('date')), startTime: String(value('startTime') ?? '').trim(), endTime: String(value('endTime') ?? '').trim(), pairNumber: Number(value('pairNumber')), subject: String(value('subject') ?? '').trim(), teacher: String(value('teacher') ?? '').trim() || undefined, group: String(value('group') ?? '').trim(), room: String(value('room') ?? '').trim() || undefined };
}

function parseCsvRecords(value: string): { headers: string[]; records: Record<string, unknown>[] } {
  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { headers: [], records: [] };
  const delimiter = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter);
  const records = lines.slice(1, 1002).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
  return { headers, records };
}

function parseJsonRecords(value: string): Record<string, unknown>[] {
  const parsed = JSON.parse(value) as unknown;
  const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { lessons?: unknown[] }).lessons) ? (parsed as { lessons: unknown[] }).lessons : [];
  return items.slice(0, 1001).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

export default function ScheduleImportPage() {
  const [step, setStep] = useState<Step>(1); const [file, setFile] = useState<File | null>(null); const [rows, setRows] = useState<PreviewRow[]>([]); const [sourceRecords, setSourceRecords] = useState<Record<string, unknown>[]>([]); const [headers, setHeaders] = useState<string[]>([]); const [mapping, setMapping] = useState<Partial<Record<keyof PreviewRow, string>>>({}); const [dragging, setDragging] = useState(false); const [history, setHistory] = useState<HistoryItem[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<DryRunPlan | null>(null); const [dryRunning, setDryRunning] = useState(false); const [gate, setGate] = useState(false); const [reportLoading, setReportLoading] = useState<string | null>(null); const [lastRunId, setLastRunId] = useState<string | null>(null); const [rollbackState, setRollbackState] = useState<Record<string, RollbackState>>({});
  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem('napare:import-history') || '[]')); } catch { setHistory([]); } }, []);
  const chooseFile = useCallback(async (selected: File) => {
    if (!isSupportedFile(selected)) { setError('Сейчас доступны CSV и JSON. Excel подключается после серверного детектора.'); return; }
    setError(''); setMessage(''); setFile(selected); setStep(2); setPlan(null); setGate(false);
    try {
      const content = await selected.text();
      const csv = selected.name.toLowerCase().endsWith('.csv');
      const csvData = csv ? parseCsvRecords(content) : null;
      const records = csvData?.records || parseJsonRecords(content);
      const columns = csvData?.headers || Object.keys(records[0] || {});
      if (records.length > 1000) throw new Error('В файле больше 1 000 занятий. Разделите его на несколько файлов: строки не будут обрезаны автоматически.');
      const nextMapping = Object.fromEntries(fieldLabels.map(({ key }) => [key, columns.find((column) => headerAliases[key].includes(normalize(column))) || ''])) as Partial<Record<keyof PreviewRow, string>>;
      setSourceRecords(records); setHeaders(columns); setMapping(nextMapping); setRows(records.map((record) => rowFromRecord(record, nextMapping)));
    } catch (reason) { setSourceRecords([]); setHeaders([]); setRows([]); setError(reason instanceof Error ? reason.message : 'Не удалось прочитать файл. Проверьте формат и кодировку.'); }
  }, []);
  const updateMapping = (field: keyof PreviewRow, column: string) => {
    const next = { ...mapping, [field]: column };
    setMapping(next); setRows(sourceRecords.map((record) => rowFromRecord(record, next))); setPlan(null);
  };
  const onFileDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void chooseFile(dropped);
  };
  const validation = useMemo(() => {
    const slots = new Map<string, number>(); let conflicts = 0; let incomplete = 0;
    const issues: Array<{ row: number; fields: string[] }> = [];
    rows.forEach((row, index) => {
      const fields = [!validDate(row.date) && 'Дата: нужен формат ГГГГ-ММ-ДД и существующая дата', !validTime(row.startTime) && 'Начало: время от 00:00 до 23:59', !validTime(row.endTime) && 'Конец: время от 00:00 до 23:59', validTime(row.startTime) && validTime(row.endTime) && row.endTime <= row.startTime && 'Конец должен быть позже начала', (!Number.isInteger(row.pairNumber) || row.pairNumber < 1) && 'Номер пары: положительное целое число', !row.subject && 'Предмет не указан', !row.group && 'Группа не указана'].filter((field): field is string => typeof field === 'string');
      if (fields.length) incomplete += 1;
      const slot = `${row.date}|${row.group}|${row.pairNumber}`;
      if (slots.has(slot)) { conflicts += 1; fields.push(`Повтор занятия из строки ${slots.get(slot)}`); } else slots.set(slot, index + (file?.name.toLowerCase().endsWith('.csv') ? 2 : 1));
      if (fields.length) issues.push({ row: index + (file?.name.toLowerCase().endsWith('.csv') ? 2 : 1), fields });
    });
    return { conflicts, incomplete, valid: rows.length - issues.length, issues };
  }, [rows, file]);
  /** FR-IMP-04: server dry-run — a stored plan (summary, warnings, diff) with no job queued. */
  const runDryRun = useCallback(async () => {
    if (!file) return;
    setDryRunning(true); setError(''); setGate(false); setPlan(null);
    try {
      const result = await apiFetch<DryRunPlan>('/admin/schedule/upload', { method: 'POST', body: JSON.stringify({ fileName: file.name, format: formatOf(file.name), rows, dryRun: true }) });
      setPlan(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Предпросмотр не выполнен.'); }
    finally { setDryRunning(false); }
  }, [file, rows]);
  /** Apply runs only after the preview; a mass change answers 409 and opens the gate. */
  const apply = async (confirmMassChange = false) => {
    if (!file || validation.conflicts || validation.incomplete) return;
    setLoading(true); setError(''); setMessage(''); setGate(false); setStep(5);
    try {
      const result = await apiFetch<ApplyResult>('/admin/schedule/upload', { method: 'POST', body: JSON.stringify({ fileName: file.name, format: formatOf(file.name), rows, ...(confirmMassChange ? { confirmMassChange: true } : {}) }) });
      const item: HistoryItem = { id: result.runId || String(Date.now()), date: new Date().toISOString(), file: file.name, imported: result.imported, updated: result.updated, runId: result.runId ?? undefined };
      const next = [item, ...history].slice(0, 10); setHistory(next); localStorage.setItem('napare:import-history', JSON.stringify(next));
      setLastRunId(result.runId ?? null);
      setMessage(`Импорт завершён: добавлено ${result.imported}, обновлено ${result.updated}${result.deleted ? `, отменено ${result.deleted}` : ''}${result.errors ? `, пропущено строк с ошибками: ${result.errors}` : ''}.`);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && reason.code === 'IMPORT_NEEDS_CONFIRMATION') setGate(true);
      else setError(reason instanceof Error ? reason.message : 'Импорт не выполнен.');
    } finally { setLoading(false); }
  };
  /** FR-IMP-04: CSV report of any stored run (dry-run preview or applied import). */
  const downloadReport = async (runId: string) => {
    setReportLoading(runId);
    try {
      const csv = await apiFetchText(`/admin/import-runs/${runId}/report`);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `import-run-${runId}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Отчёт не скачан.'); }
    finally { setReportLoading(null); }
  };
  /** FR-IMP-05: compensating rollback of one applied run (≤30 days, conflicts reported). */
  const rollbackRun = async (item: HistoryItem) => {
    if (!item.runId) return;
    setRollbackState((prev) => ({ ...prev, [item.runId!]: { busy: true } }));
    try {
      const result = await apiFetch<RollbackResult>(`/admin/import-runs/${item.runId}/rollback`, { method: 'POST' });
      const conflicts = result.conflicts.length ? `, конфликтов (занятия не тронуты): ${result.conflicts.length}` : '';
      setRollbackState((prev) => ({ ...prev, [item.runId!]: { note: `Восстановлено занятий: ${result.restored}${conflicts}` } }));
      const next = history.map((entry) => (entry.runId === item.runId ? { ...entry, rolledBack: true } : entry));
      setHistory(next); localStorage.setItem('napare:import-history', JSON.stringify(next));
    } catch (reason) {
      setRollbackState((prev) => ({ ...prev, [item.runId!]: { error: reason instanceof Error ? reason.message : 'Откат не выполнен.' } }));
    } finally {
      setRollbackState((prev) => ({ ...prev, [item.runId!]: { ...prev[item.runId!], busy: false } }));
    }
  };
  const reset = () => { setStep(1); setFile(null); setRows([]); setSourceRecords([]); setHeaders([]); setMapping({}); setError(''); setMessage(''); setPlan(null); setGate(false); setLastRunId(null); };
  const retry = () => { if (step === 5) void apply(); else if (step === 4) void runDryRun(); else if (file) void chooseFile(file); else reset(); };
  const changedPercent = plan ? Math.round(plan.changedRatio * 1000) / 10 : 0;
  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
    <PageHeader title="Импорт расписания" description="CSV или JSON · серверный dry-run и подтверждение перед применением" />
    <Card padding="sm" className="overflow-hidden">
      <p className="mb-3 text-sm font-semibold text-[var(--color-brand)] sm:hidden" role="status">Шаг {step} из 5 · {steps[step - 1]}</p>
      <ol aria-label="Этапы импорта" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {steps.map((label, index) => {
          const complete = step > index + 1;
          const current = step === index + 1;
          return <li key={label} aria-current={current ? 'step' : undefined} className={`flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold sm:flex-col sm:items-start sm:gap-3 sm:px-3 sm:py-3 ${current ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : complete ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${current ? 'bg-[var(--color-brand)] text-white' : complete ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : 'bg-slate-100 text-[var(--color-text-secondary)]'}`}>{complete ? '✓' : index + 1}</span>
            <span className="truncate sm:whitespace-normal">{label}</span>
          </li>;
        })}
      </ol>
    </Card>
    {error && <RequestState title="Импорт остановлен" description={error} onRetry={retry} />}
    {message && <Alert tone="success" title="Расписание обновлено">{message}</Alert>}
    {step === 1 && <Card className={`border-2 border-dashed p-6 text-center transition-colors sm:p-12 ${dragging ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-[var(--color-brand)]/25 bg-[var(--color-brand-soft)]/30'}`}><div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={onFileDrop}><input id="schedule-file" type="file" accept=".csv,.json" onClick={(event) => { event.currentTarget.value = ''; }} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void chooseFile(selected); }} className="sr-only" /><label htmlFor="schedule-file" className="mx-auto flex max-w-3xl cursor-pointer flex-col items-center rounded-[var(--radius-md)] py-4 focus-within:outline-none focus-within:ring-4 focus-within:ring-[var(--color-focus-ring)]"><span aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-[var(--color-brand)] shadow-sm">↑</span><span className="ds-card-title">Перетащите файл сюда или выберите на устройстве</span><span className="mt-2 max-w-lg text-sm leading-6 text-[var(--color-text-secondary)]">CSV или JSON до 1 000 занятий. Группы должны быть заранее заведены в структуре ВУЗа.</span><span className="mt-5 inline-flex min-h-[var(--control-height-md)] items-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-white shadow-sm">Выбрать файл</span></label></div></Card>}
    {step === 2 && <Card padding="lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="ds-card-title">Сопоставление полей</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Проверьте, какие столбцы файла соответствуют полям расписания.</p></div><Button variant="secondary" onClick={reset}>Выбрать другой файл</Button></div><p className="mt-1 break-all text-sm text-[var(--color-text-secondary)]">{file?.name} · {file ? (file.size / 1024).toFixed(1) : 0} КБ</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{fieldLabels.map(({ key, label, required }) => <label key={key} className="block text-sm font-medium text-[var(--color-text)]">{label}{required && <span className="ml-1 text-[var(--color-danger)]" aria-hidden="true">*</span>}<select value={mapping[key] || ''} onChange={(event) => updateMapping(key, event.target.value)} className="ds-input mt-2 h-11 w-full px-3 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><option value="">Не сопоставлено</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="mt-5"><Alert tone={rows.length ? 'info' : 'warning'} title={rows.length ? 'Схема готова к проверке' : 'Нет строк в файле'}>Отмеченные поля обязательны для импорта. Необязательные: преподаватель и аудитория.</Alert></div><Button className="mt-5" onClick={() => setStep(3)} disabled={!rows.length || fieldLabels.some(({ key, required }) => required && !mapping[key])}>Проверить записи</Button></Card>}
    {step === 3 && <Card padding="lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="ds-card-title">Проверка записей</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Конфликты определяются по дате, группе и номеру пары.</p></div><Badge variant={validation.conflicts || validation.incomplete ? 'amber' : 'green'}>{validation.conflicts || validation.incomplete ? 'Требует проверки' : 'Готово к просмотру'}</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[{ label: 'Корректные строки', value: validation.valid, tone: 'success' }, { label: 'Неполные строки', value: validation.incomplete, tone: 'warning' }, { label: 'Дубли занятий', value: validation.conflicts, tone: 'danger' }].map((item) => <Alert key={item.label} tone={item.tone as 'success' | 'warning' | 'danger'} title={item.label}>{item.value}</Alert>)}</div>{validation.issues.length > 0 && <div className="mt-5"><h3 className="text-sm font-semibold">Исправьте строки файла</h3><ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">{validation.issues.map(issue => <li key={issue.row} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Строка {issue.row}</strong><ul className="mt-1 list-inside list-disc">{issue.fields.map(field => <li key={field}>{field}</li>)}</ul></li>)}</ul><Button variant="secondary" className="mt-4" onClick={reset}>Выбрать исправленный файл</Button></div>}<Button className="mt-5" onClick={() => { setStep(4); void runDryRun(); }} disabled={validation.conflicts > 0 || validation.incomplete > 0}>Открыть предпросмотр</Button></Card>}
    {step === 4 && <Card padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div><h2 className="ds-card-title">Предпросмотр изменений</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Серверный dry-run: план рассчитан по текущему расписанию, ничего не применено.</p></div>
        <Badge variant="slate">{plan ? `dry-run · ${plan.runId.slice(0, 8)}` : 'расчёт…'}</Badge>
      </div>
      {dryRunning && <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Сервер рассчитывает план импорта: сверяет группы, существующие занятия и порог массового изменения…</p>}
      {!dryRunning && !plan && !error && <div className="mt-4"><EmptyState title="План не рассчитан" description="Нажмите «Рассчитать план», чтобы получить сводку, предупреждения и отчёт." action={<Button onClick={() => void runDryRun()}>Рассчитать план</Button>} /></div>}
      {plan && <div className="mt-4 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[{ label: 'Создано', value: plan.summary.imported, tone: 'success' as const }, { label: 'Обновлено', value: plan.summary.updated, tone: 'info' as const }, { label: 'Отменено', value: plan.summary.deleted, tone: 'danger' as const }, { label: 'Без изменений', value: plan.summary.unchanged, tone: 'info' as const }, { label: 'Ошибки строк', value: plan.summary.errors, tone: 'warning' as const }].map((item) => <Alert key={item.label} tone={item.tone} title={item.label}>{item.value}</Alert>)}
        </div>
        {plan.summary.errors > 0 && <Alert tone="warning" title="Будут применены только корректные строки">Строк с ошибками: {plan.summary.errors} — они не попадут в импорт. Исправьте файл и повторите dry-run: ошибочные строки доступны в отчёте.</Alert>}
        {plan.requiresConfirmation && <Alert tone="warning" title="Импорт потребует явного подтверждения">
          <ul className="list-inside list-disc space-y-1">{plan.confirmationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <p className="mt-1">Изменяется {changedPercent}% активных занятий вуза при пороге {plan.threshold}%.</p>
        </Alert>}
        {(plan.warnings.length > 0 || plan.errors.length > 0) && <div className="grid gap-4 lg:grid-cols-2">
          {plan.warnings.length > 0 && <section aria-label="Предупреждения"><h3 className="text-sm font-semibold">Предупреждения ({plan.warnings.length})</h3><ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">{plan.warnings.slice(0, ISSUE_LIMIT).map((warning, index) => <li key={`${warning.row}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>{issueLabel(warning.row)}</strong> — {warning.message}</li>)}{plan.warnings.length > ISSUE_LIMIT && <li className="text-xs text-[var(--color-text-secondary)]">… и ещё {plan.warnings.length - ISSUE_LIMIT} — они есть в отчёте.</li>}</ul></section>}
          {plan.errors.length > 0 && <section aria-label="Ошибки"><h3 className="text-sm font-semibold">Ошибки ({plan.errors.length})</h3><ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">{plan.errors.slice(0, ISSUE_LIMIT).map((issue, index) => <li key={`${issue.row}-${index}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"><strong>{issueLabel(issue.row)}</strong> — {issue.message}</li>)}{plan.errors.length > ISSUE_LIMIT && <li className="text-xs text-[var(--color-text-secondary)]">… и ещё {plan.errors.length - ISSUE_LIMIT} — они есть в отчёте.</li>}</ul></section>}
        </div>}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">План по строкам ({plan.rows.length})</h3>
            <Button variant="secondary" size="sm" loading={reportLoading === plan.runId} onClick={() => void downloadReport(plan.runId)}>Скачать отчёт (CSV)</Button>
          </div>
          {plan.rows.length ? <div className="mt-3">
            <div className="max-h-[50vh] space-y-3 overflow-y-auto lg:hidden">{plan.rows.slice(0, PREVIEW_LIMIT).map((row, index) => <article key={`${row.row}-${index}`} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[var(--color-text-secondary)]">{row.row ? `Строка ${row.row}` : 'Занятие вне файла'}</span><Badge variant={outcomeMeta[row.outcome].variant}>{outcomeMeta[row.outcome].label}</Badge></div><h3 className="mt-1 text-sm font-semibold">{row.subject}</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{row.date} · {row.groupName}</p>{row.message && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{row.message}</p>}</article>)}</div>
            <div className="hidden lg:block"><Table className="min-w-[52rem]"><thead><tr>{['Строка', 'Дата', 'Группа', 'Предмет', 'Результат', 'Сообщение'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{plan.rows.slice(0, PREVIEW_LIMIT).map((row, index) => <tr key={`${row.row}-${index}`}><td>{row.row || '—'}</td><td>{row.date}</td><td>{row.groupName}</td><td className="font-medium">{row.subject}</td><td><Badge variant={outcomeMeta[row.outcome].variant}>{outcomeMeta[row.outcome].label}</Badge></td><td className="text-[var(--color-text-secondary)]">{row.message || '—'}</td></tr>)}</tbody></Table></div>
            {plan.rows.length > PREVIEW_LIMIT && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Показаны первые {PREVIEW_LIMIT} строк из {plan.rows.length}. Полный список — в отчёте CSV.</p>}
          </div> : <div className="mt-3"><EmptyState title="Нет строк для предпросмотра" description="Все строки источника отклонены — исправьте файл и повторите dry-run." /></div>}
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="secondary" onClick={() => setStep(3)}>Назад</Button>
          <Button loading={loading} disabled={!rows.length} onClick={() => void apply()}>Подтвердить и применить</Button>
        </div>
      </div>}
    </Card>}
    {step === 5 && <Card padding="lg">
      <h2 className="ds-card-title">Применение изменений</h2>
      {loading ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Проверяем группы ВУЗа и сохраняем расписание…</p>
        : gate ? <div className="mt-3 space-y-4">
          <Alert tone="warning" title="Требуется явное подтверждение">
            <p>Массовое изменение расписания не применяется без подтверждения. Проверьте расшифровку и решите, продолжить ли.</p>
            <ul className="mt-2 list-inside list-disc space-y-1">{(plan?.confirmationWarnings.length ? plan.confirmationWarnings : ['Импорт существенно изменяет расписание вуза.']).map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </Alert>
          {plan && <div className="rounded-[var(--radius-md)] border bg-[var(--color-surface-secondary)] p-4 text-sm">
            <p className="font-semibold">Что изменится</p>
            <p className="mt-1 text-[var(--color-text-secondary)]">Создано {plan.summary.imported}, обновлено {plan.summary.updated}, отменено {plan.summary.deleted}, без изменений {plan.summary.unchanged}. Активных занятий вуза: {plan.existingActive}, затронуто {changedPercent}% при пороге {plan.threshold}%.</p>
            {plan.summary.errors > 0 && <p className="mt-1 text-[var(--color-text-secondary)]">Строк с ошибками: {plan.summary.errors} — они не будут применены.</p>}
          </div>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setGate(false); setStep(4); }}>Вернуться к предпросмотру</Button>
            <Button onClick={() => void apply(true)}>Применить с подтверждением</Button>
          </div>
        </div>
        : message ? <><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Импорт завершён. Внешняя синхронизация запускается отдельно в разделе коннекторов.</p><div className="mt-4 flex flex-wrap gap-2">{lastRunId && <Button variant="secondary" loading={reportLoading === lastRunId} onClick={() => void downloadReport(lastRunId)}>Скачать отчёт (CSV)</Button>}<Button variant="secondary" onClick={reset}>Новый импорт</Button></div></>
          : <><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Импорт не завершён. Исправьте указанные выше ошибки и повторите попытку.</p><Button variant="secondary" className="mt-5" onClick={reset}>Выбрать другой файл</Button></>}
    </Card>}
    <Card padding="sm"><div className="flex items-center justify-between gap-3 border-b pb-3"><div><h2 className="ds-card-title">История импорта на устройстве</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Последние файлы, применённые в этом браузере</p></div><Badge variant="slate">{history.length}</Badge></div>{history.length ? <div className="divide-y">{history.map((item) => <div key={item.id} className="py-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-sm font-semibold text-[var(--color-text)]">{item.file}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{new Date(item.date).toLocaleString('ru-RU')} · добавлено {item.imported}, обновлено {item.updated}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant={item.rolledBack ? 'slate' : 'green'}>{item.rolledBack ? 'Откачен' : 'Применён'}</Badge>{item.runId && !item.rolledBack && <Button variant="secondary" size="sm" loading={rollbackState[item.runId]?.busy} onClick={() => void rollbackRun(item)}>Откатить</Button>}</div></div>{item.runId && rollbackState[item.runId] && <p className={`mt-2 text-xs ${rollbackState[item.runId].error ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`} role="status">{rollbackState[item.runId].error || rollbackState[item.runId].note}</p>}</div>)}</div> : <div className="flex flex-col items-center gap-2 py-7 text-center"><span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-lg text-[var(--color-text-secondary)]">▤</span><p className="text-sm font-semibold text-[var(--color-text)]">Импортов на этом устройстве ещё не было</p><p className="text-sm text-[var(--color-text-secondary)]">Завершённые импорты появятся здесь.</p></div>}</Card>
  </div>;
}
