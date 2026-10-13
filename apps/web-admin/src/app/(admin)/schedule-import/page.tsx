'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, RequestState, Table } from '@/components/ui';

type Step = 1 | 2 | 3 | 4 | 5;
interface PreviewRow { date: string; startTime: string; endTime: string; pairNumber: number; subject: string; teacher?: string; group: string; room?: string; }
interface HistoryItem { id: string; date: string; file: string; imported: number; updated: number; }
const steps = ['Файл', 'Схема', 'Проверка', 'Просмотр', 'Применение'];
const requiredColumns = ['Дата', 'Начало', 'Конец', 'Номер пары', 'Предмет', 'Группа'];
const headerAliases: Record<keyof PreviewRow, string[]> = {
  date: ['дата', 'date', 'startdate'], startTime: ['начало', 'время начала', 'starttime', 'start'], endTime: ['конец', 'время окончания', 'endtime', 'end'], pairNumber: ['номер пары', 'пара', 'pairnumber', 'pair'], subject: ['предмет', 'дисциплина', 'subject', 'title'], teacher: ['преподаватель', 'teacher', 'teachername'], group: ['группа', 'group', 'groupname'], room: ['аудитория', 'room'],
};

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

function rowFromRecord(record: Record<string, unknown>): PreviewRow {
  const value = (field: keyof PreviewRow) => {
    const key = Object.keys(record).find((candidate) => headerAliases[field].includes(normalize(candidate)));
    return key ? record[key] : undefined;
  };
  return { date: dateOnly(value('date')), startTime: String(value('startTime') ?? '').trim(), endTime: String(value('endTime') ?? '').trim(), pairNumber: Number(value('pairNumber')), subject: String(value('subject') ?? '').trim(), teacher: String(value('teacher') ?? '').trim() || undefined, group: String(value('group') ?? '').trim(), room: String(value('room') ?? '').trim() || undefined };
}

function parseCsv(value: string): PreviewRow[] {
  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter);
  return lines.slice(1, 1002).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return rowFromRecord(Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  });
}

function parseJson(value: string): PreviewRow[] {
  const parsed = JSON.parse(value) as unknown;
  const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { lessons?: unknown[] }).lessons) ? (parsed as { lessons: unknown[] }).lessons : [];
  return items.slice(0, 1001).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').map(rowFromRecord);
}

export default function ScheduleImportPage() {
  const [step, setStep] = useState<Step>(1); const [file, setFile] = useState<File | null>(null); const [rows, setRows] = useState<PreviewRow[]>([]); const [history, setHistory] = useState<HistoryItem[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem('napare:import-history') || '[]')); } catch { setHistory([]); } }, []);
  const chooseFile = useCallback(async (selected: File) => {
    if (!isSupportedFile(selected)) { setError('Сейчас доступны CSV и JSON. Excel подключается после серверного детектора.'); return; }
    setError(''); setMessage(''); setFile(selected); setStep(2);
    try { const content = await selected.text(); const parsed = selected.name.toLowerCase().endsWith('.csv') ? parseCsv(content) : parseJson(content); if (parsed.length > 1000) throw new Error('В файле больше 1 000 занятий. Разделите его на несколько файлов: строки не будут обрезаны автоматически.'); setRows(parsed); } catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : 'Не удалось прочитать файл. Проверьте формат и кодировку.'); }
  }, []);
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
  const reset = () => { setStep(1); setFile(null); setRows([]); setError(''); setMessage(''); };
  const stats = [{ label: 'Занятия', value: rows.length }, { label: 'Группы', value: new Set(rows.map((row) => row.group).filter(Boolean)).size }, { label: 'Преподаватели', value: new Set(rows.map((row) => row.teacher).filter(Boolean)).size }, { label: 'Аудитории', value: new Set(rows.map((row) => row.room).filter(Boolean)).size }];
  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
    <PageHeader eyebrow="Кабинет ВУЗа · расписание" title="Импорт расписания" description="Проверьте записи до применения. Импортируются только подтверждённые CSV и JSON строки." />
    <p className="text-sm font-semibold text-[var(--color-brand)] sm:hidden" role="status">Шаг {step} из 5 · {steps[step - 1]}</p><ol aria-label="Этапы импорта" className="hidden grid-cols-5 gap-2 sm:grid">{steps.map((label, index) => <li key={label} className={`border-t-2 pt-2 text-xs font-semibold sm:text-sm ${step >= index + 1 ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}><span className="mr-1">{index + 1}.</span>{label}</li>)}</ol>
    {error && <RequestState title="Импорт остановлен" description={error} onRetry={() => { if (step === 5) void apply(); else if (file) void chooseFile(file); else reset(); }} />}
    {message && <Alert tone="success" title="Расписание обновлено">{message}</Alert>}
    {step === 1 && <Card className="border-2 border-dashed p-6 text-center sm:p-12"><input id="schedule-file" type="file" accept=".csv,.json" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void chooseFile(selected); }} className="sr-only" /><label htmlFor="schedule-file" className="block cursor-pointer rounded-[var(--radius-md)] focus-within:outline-none focus-within:ring-4 focus-within:ring-[var(--color-brand-soft)]"><p className="ds-card-title">Выберите файл расписания</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--color-text-secondary)]">CSV или JSON до 1 000 занятий. Группы должны быть заранее заведены в структуре ВУЗа.</p><span className="mt-5 inline-flex min-h-[var(--control-height-md)] items-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white">Выбрать файл</span></label></Card>}
    {step === 2 && <Card padding="lg"><h2 className="ds-card-title">Проверка схемы файла</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{file?.name} · {file ? (file.size / 1024).toFixed(1) : 0} КБ</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{stats.map((item) => <div key={item.label} className="rounded-[var(--radius-md)] border p-3"><p className="text-xs text-[var(--color-text-secondary)]">{item.label}</p><p className="mt-2 text-2xl font-bold text-[var(--color-text)]">{item.value}</p></div>)}</div><div className="mt-5"><Alert tone={rows.length ? 'info' : 'warning'} title={rows.length ? 'Строки распознаны' : 'Строки не найдены'}>Обязательные поля: {requiredColumns.join(', ')}. Необязательные: Преподаватель, Аудитория.</Alert></div><Button className="mt-5" onClick={() => setStep(3)} disabled={!rows.length}>Проверить записи</Button></Card>}
    {step === 3 && <Card padding="lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="ds-card-title">Проверка записей</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Конфликты определяются по дате, группе и номеру пары.</p></div><Badge variant={validation.conflicts || validation.incomplete ? 'amber' : 'green'}>{validation.conflicts || validation.incomplete ? 'Требует проверки' : 'Готово к просмотру'}</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[{ label: 'Корректные строки', value: validation.valid, tone: 'success' }, { label: 'Неполные строки', value: validation.incomplete, tone: 'warning' }, { label: 'Дубли занятий', value: validation.conflicts, tone: 'danger' }].map((item) => <Alert key={item.label} tone={item.tone as 'success' | 'warning' | 'danger'} title={item.label}>{item.value}</Alert>)}</div>{validation.issues.length > 0 && <div className="mt-5"><h3 className="text-sm font-semibold">Исправьте строки файла</h3><ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">{validation.issues.map(issue => <li key={issue.row} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Строка {issue.row}</strong><ul className="mt-1 list-inside list-disc">{issue.fields.map(field => <li key={field}>{field}</li>)}</ul></li>)}</ul><Button variant="secondary" className="mt-4" onClick={reset}>Выбрать исправленный файл</Button></div>}<Button className="mt-5" onClick={() => setStep(4)} disabled={validation.conflicts > 0 || validation.incomplete > 0}>Открыть предпросмотр</Button></Card>}
    {step === 4 && <Card padding="sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3"><div><h2 className="ds-card-title">Предпросмотр изменений</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">К обработке: {rows.length} занятий в {new Set(rows.map(row => row.group)).size} группах. Сервер определит добавленные и обновлённые записи; неизвестные группы остановят импорт.</p></div><Badge variant="green">Готово</Badge></div>{rows.length ? <div className="mt-4"><div className="max-h-[60vh] space-y-3 overflow-y-auto lg:hidden">{rows.map((row,index) => <article key={index} className="rounded-xl border p-3"><h3 className="text-sm font-semibold">{row.subject}</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{row.date} · {row.startTime}–{row.endTime} · {row.group}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{row.teacher || 'Преподаватель не указан'} · {row.room ? `ауд. ${row.room}` : 'Аудитория не указана'}</p></article>)}</div><div className="hidden lg:block"><Table className="min-w-[56rem]"><thead><tr>{['Дата', 'Начало', 'Конец', 'Пара', 'Предмет', 'Преподаватель', 'Группа', 'Аудитория'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.date}-${row.group}-${row.pairNumber}-${index}`}><td>{row.date}</td><td>{row.startTime}</td><td>{row.endTime}</td><td>{row.pairNumber}</td><td className="font-medium">{row.subject}</td><td>{row.teacher || '—'}</td><td>{row.group}</td><td>{row.room || '—'}</td></tr>)}</tbody></Table></div></div> : <EmptyState title="Нет строк для предпросмотра" description="Вернитесь к выбору файла и проверьте обязательные поля." />}<div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setStep(2)}>Назад</Button><Button loading={loading} onClick={apply} disabled={!rows.length}>Подтвердить и применить</Button></div></Card>}
    {step === 5 && <Card padding="lg"><h2 className="ds-card-title">Применение изменений</h2>{loading ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Проверяем группы ВУЗа и сохраняем расписание…</p> : message ? <><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Импорт завершён. Внешняя синхронизация запускается отдельно в разделе коннекторов.</p><Button variant="secondary" className="mt-5" onClick={reset}>Новый импорт</Button></> : <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Импорт не завершён. Исправьте указанные выше ошибки и повторите попытку.</p>}</Card>}
    <Card padding="sm"><div className="flex items-center justify-between border-b pb-3"><h2 className="ds-card-title">Последние импорты на этом устройстве</h2><span className="text-xs text-[var(--color-text-muted)]">{history.length} записей</span></div>{history.length ? <div className="divide-y">{history.map((item) => <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[var(--color-text)]">{item.file}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{new Date(item.date).toLocaleString('ru-RU')} · добавлено {item.imported}, обновлено {item.updated}</p></div><Badge variant="green">Применён</Badge></div>)}</div> : <p className="py-4 text-sm text-[var(--color-text-secondary)]">Импортов на этом устройстве ещё не было.</p>}</Card>
  </div>;
}
