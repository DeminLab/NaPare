'use client';

import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, RequestState, Table } from '@/components/ui';

type Step = 1 | 2 | 3 | 4 | 5;
interface PreviewRow { date: string; startTime: string; endTime: string; pairNumber: number; subject: string; teacher?: string; group: string; room?: string; }
interface HistoryItem { id: string; date: string; file: string; imported: number; updated: number; }
const steps = ['Файл', 'Схема', 'Проверка', 'Просмотр', 'Применение'];
const headerAliases: Record<keyof PreviewRow, string[]> = {
  date: ['дата', 'date', 'startdate'], startTime: ['начало', 'время начала', 'starttime', 'start'], endTime: ['конец', 'время окончания', 'endtime', 'end'], pairNumber: ['номер пары', 'пара', 'pairnumber', 'pair'], subject: ['предмет', 'дисциплина', 'subject', 'title'], teacher: ['преподаватель', 'teacher', 'teachername'], group: ['группа', 'group', 'groupname'], room: ['аудитория', 'room'],
};
const fieldLabels: Array<{ key: keyof PreviewRow; label: string; required?: boolean }> = [
  { key: 'date', label: 'Дата', required: true }, { key: 'startTime', label: 'Начало', required: true },
  { key: 'endTime', label: 'Конец', required: true }, { key: 'pairNumber', label: 'Номер пары', required: true },
  { key: 'subject', label: 'Предмет', required: true }, { key: 'group', label: 'Группа', required: true },
  { key: 'teacher', label: 'Преподаватель' }, { key: 'room', label: 'Аудитория' },
];

const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('ru-RU');
const dateOnly = (value: unknown) => String(value ?? '').trim().slice(0, 10);
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isSupportedFile = (file: File) => ['csv', 'json'].includes(file.name.split('.').pop()?.toLowerCase() || '');

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
  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem('napare:import-history') || '[]')); } catch { setHistory([]); } }, []);
  const chooseFile = useCallback(async (selected: File) => {
    if (!isSupportedFile(selected)) { setError('Сейчас доступны CSV и JSON. Excel подключается после серверного детектора.'); return; }
    setError(''); setMessage(''); setFile(selected); setStep(2);
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
    setMapping(next); setRows(sourceRecords.map((record) => rowFromRecord(record, next)));
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
  const apply = async () => {
    if (!file || validation.conflicts || validation.incomplete) return;
    setLoading(true); setError(''); setStep(5);
    try {
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
      const result = await apiFetch<{ imported: number; updated: number }>('/admin/schedule/upload', { method: 'POST', body: JSON.stringify({ fileName: file.name, format, rows }) });
      const item = { id: String(Date.now()), date: new Date().toISOString(), file: file.name, imported: result.imported, updated: result.updated };
      const next = [item, ...history].slice(0, 10); setHistory(next); localStorage.setItem('napare:import-history', JSON.stringify(next)); setMessage(`Импорт завершён: добавлено ${result.imported}, обновлено ${result.updated}.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Импорт не выполнен.'); } finally { setLoading(false); }
  };
  const reset = () => { setStep(1); setFile(null); setRows([]); setSourceRecords([]); setHeaders([]); setMapping({}); setError(''); setMessage(''); };
  const stats = [{ label: 'Занятия', value: rows.length }, { label: 'Группы', value: new Set(rows.map((row) => row.group).filter(Boolean)).size }, { label: 'Преподаватели', value: new Set(rows.map((row) => row.teacher).filter(Boolean)).size }, { label: 'Аудитории', value: new Set(rows.map((row) => row.room).filter(Boolean)).size }];
  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
    <PageHeader title="Импорт расписания" description="CSV или JSON · проверка перед применением" />
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
    {error && <RequestState title="Импорт остановлен" description={error} onRetry={() => { if (step === 5) void apply(); else if (file) void chooseFile(file); else reset(); }} />}
    {message && <Alert tone="success" title="Расписание обновлено">{message}</Alert>}
    {step === 1 && <Card className={`border-2 border-dashed p-6 text-center transition-colors sm:p-12 ${dragging ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-[var(--color-brand)]/25 bg-[var(--color-brand-soft)]/30'}`}><div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={onFileDrop}><input id="schedule-file" type="file" accept=".csv,.json" onClick={(event) => { event.currentTarget.value = ''; }} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void chooseFile(selected); }} className="sr-only" /><label htmlFor="schedule-file" className="mx-auto flex max-w-3xl cursor-pointer flex-col items-center rounded-[var(--radius-md)] py-4 focus-within:outline-none focus-within:ring-4 focus-within:ring-[var(--color-focus-ring)]"><span aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-[var(--color-brand)] shadow-sm">↑</span><span className="ds-card-title">Перетащите файл сюда или выберите на устройстве</span><span className="mt-2 max-w-lg text-sm leading-6 text-[var(--color-text-secondary)]">CSV или JSON до 1 000 занятий. Группы должны быть заранее заведены в структуре ВУЗа.</span><span className="mt-5 inline-flex min-h-[var(--control-height-md)] items-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-white shadow-sm">Выбрать файл</span></label></div></Card>}
    {step === 2 && <Card padding="lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="ds-card-title">Сопоставление полей</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Проверьте, какие столбцы файла соответствуют полям расписания.</p></div><Button variant="secondary" onClick={reset}>Выбрать другой файл</Button></div><p className="mt-1 break-all text-sm text-[var(--color-text-secondary)]">{file?.name} · {file ? (file.size / 1024).toFixed(1) : 0} КБ</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{fieldLabels.map(({ key, label, required }) => <label key={key} className="block text-sm font-medium text-[var(--color-text)]">{label}{required && <span className="ml-1 text-[var(--color-danger)]" aria-hidden="true">*</span>}<select value={mapping[key] || ''} onChange={(event) => updateMapping(key, event.target.value)} className="ds-input mt-2 h-11 w-full px-3 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><option value="">Не сопоставлено</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="mt-5"><Alert tone={rows.length ? 'info' : 'warning'} title={rows.length ? 'Схема готова к проверке' : 'Нет строк в файле'}>Отмеченные поля обязательны для импорта. Необязательные: преподаватель и аудитория.</Alert></div><Button className="mt-5" onClick={() => setStep(3)} disabled={!rows.length || fieldLabels.some(({ key, required }) => required && !mapping[key])}>Проверить записи</Button></Card>}
    {step === 3 && <Card padding="lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="ds-card-title">Проверка записей</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Конфликты определяются по дате, группе и номеру пары.</p></div><Badge variant={validation.conflicts || validation.incomplete ? 'amber' : 'green'}>{validation.conflicts || validation.incomplete ? 'Требует проверки' : 'Готово к просмотру'}</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[{ label: 'Корректные строки', value: validation.valid, tone: 'success' }, { label: 'Неполные строки', value: validation.incomplete, tone: 'warning' }, { label: 'Дубли занятий', value: validation.conflicts, tone: 'danger' }].map((item) => <Alert key={item.label} tone={item.tone as 'success' | 'warning' | 'danger'} title={item.label}>{item.value}</Alert>)}</div>{validation.issues.length > 0 && <div className="mt-5"><h3 className="text-sm font-semibold">Исправьте строки файла</h3><ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">{validation.issues.map(issue => <li key={issue.row} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Строка {issue.row}</strong><ul className="mt-1 list-inside list-disc">{issue.fields.map(field => <li key={field}>{field}</li>)}</ul></li>)}</ul><Button variant="secondary" className="mt-4" onClick={reset}>Выбрать исправленный файл</Button></div>}<Button className="mt-5" onClick={() => setStep(4)} disabled={validation.conflicts > 0 || validation.incomplete > 0}>Открыть предпросмотр</Button></Card>}
    {step === 4 && <Card padding="sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3"><div><h2 className="ds-card-title">Предпросмотр изменений</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">К обработке: {rows.length} занятий в {new Set(rows.map(row => row.group)).size} группах. Сервер определит добавленные и обновлённые записи; неизвестные группы остановят импорт.</p></div><Badge variant="green">Готово</Badge></div>{rows.length ? <div className="mt-4"><div className="max-h-[60vh] space-y-3 overflow-y-auto lg:hidden">{rows.map((row,index) => <article key={index} className="rounded-xl border p-3"><h3 className="text-sm font-semibold">{row.subject}</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{row.date} · {row.startTime}–{row.endTime} · {row.group}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{row.teacher || 'Преподаватель не указан'} · {row.room ? `ауд. ${row.room}` : 'Аудитория не указана'}</p></article>)}</div><div className="hidden lg:block"><Table className="min-w-[56rem]"><thead><tr>{['Дата', 'Начало', 'Конец', 'Пара', 'Предмет', 'Преподаватель', 'Группа', 'Аудитория'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.date}-${row.group}-${row.pairNumber}-${index}`}><td>{row.date}</td><td>{row.startTime}</td><td>{row.endTime}</td><td>{row.pairNumber}</td><td className="font-medium">{row.subject}</td><td>{row.teacher || '—'}</td><td>{row.group}</td><td>{row.room || '—'}</td></tr>)}</tbody></Table></div></div> : <EmptyState title="Нет строк для предпросмотра" description="Вернитесь к выбору файла и проверьте обязательные поля." />}<div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setStep(2)}>Назад</Button><Button loading={loading} onClick={apply} disabled={!rows.length}>Подтвердить и применить</Button></div></Card>}
    {step === 5 && <Card padding="lg"><h2 className="ds-card-title">Применение изменений</h2>{loading ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Проверяем группы ВУЗа и сохраняем расписание…</p> : message ? <><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Импорт завершён. Внешняя синхронизация запускается отдельно в разделе коннекторов.</p><Button variant="secondary" className="mt-5" onClick={reset}>Новый импорт</Button></> : <><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Импорт не завершён. Исправьте указанные выше ошибки и повторите попытку.</p><Button variant="secondary" className="mt-5" onClick={reset}>Выбрать другой файл</Button></>}</Card>}
    <Card padding="sm"><div className="flex items-center justify-between gap-3 border-b pb-3"><div><h2 className="ds-card-title">История импорта на устройстве</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Последние файлы, применённые в этом браузере</p></div><Badge variant="slate">{history.length}</Badge></div>{history.length ? <div className="divide-y">{history.map((item) => <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-sm font-semibold text-[var(--color-text)]">{item.file}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{new Date(item.date).toLocaleString('ru-RU')} · добавлено {item.imported}, обновлено {item.updated}</p></div><Badge variant="green">Применён</Badge></div>)}</div> : <div className="flex flex-col items-center gap-2 py-7 text-center"><span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-lg text-[var(--color-text-secondary)]">▤</span><p className="text-sm font-semibold text-[var(--color-text)]">Импортов на этом устройстве ещё не было</p><p className="text-sm text-[var(--color-text-secondary)]">Завершённые импорты появятся здесь.</p></div>}</Card>
  </div>;
}
