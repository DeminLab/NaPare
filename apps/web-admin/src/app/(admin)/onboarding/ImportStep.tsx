'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { errorMessage, fieldClass, localDate, type Group, type ImportJob } from './types';

const labels = { csv: 'CSV', json: 'JSON', ics: 'ICS', xlsx: 'XLSX', moodle: 'Moodle', sibit: 'СИБИТ' };
const jobLabels: Record<string, string> = { queued: 'В очереди', processing: 'Обрабатывается', completed: 'Выполнено', failed: 'Отклонено' };
export default function ImportStep({ actorId, universityId, groups }: { actorId: string; universityId: string; groups: Group[] }) {
  const [format, setFormat] = useState<keyof typeof labels>('csv'), [file, setFile] = useState<File | null>(null), [content, setContent] = useState('');
  const [source, setSource] = useState('основное-расписание'), [offset, setOffset] = useState('+06:00');
  const [start, setStart] = useState(localDate()), [end, setEnd] = useState(localDate()), [group, setGroup] = useState(''), [pair, setPair] = useState(1);
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState(''), [job, setJob] = useState<ImportJob | null>(null);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null), fileGeneration = useRef(0);
  const storageKey = `napare-onboarding-import:${actorId}:${universityId}`;
  const external = format === 'sibit' || format === 'moodle';
  const refreshJob = useCallback(async (id: string) => {
    try { setJob(await apiFetch<ImportJob>(`/admin/schedule/imports/${id}`)); setError(''); }
    catch (cause) { setError(errorMessage(cause)); }
  }, []);
  useEffect(() => {
    let id: string | null = null;
    try { id = sessionStorage.getItem(storageKey); } catch { /* A disabled browser store does not block imports. */ }
    if (id && /^[0-9a-f-]{36}$/i.test(id)) void refreshJob(id);
  }, [storageKey, refreshJob]);
  useEffect(() => {
    if (!job || !['queued', 'processing'].includes(job.status) || error) return;
    const timer = setTimeout(() => void refreshJob(job.jobId), 2000);
    return () => clearTimeout(timer);
  }, [job, error, refreshJob]);
  useEffect(() => () => { fileGeneration.current++; }, []);
  async function readFile(selected: File | null) {
    const generation = ++fileGeneration.current;
    setFile(selected); setContent(''); setError(''); setReading(!!selected);
    if (!selected) return;
    if (selected.size > 2 * 1024 * 1024 || !selected.size) { setError('Нужен непустой файл до 2 МиБ.'); setReading(false); return; }
    try {
      let value: string;
      if (format === 'xlsx') {
        const bytes = new Uint8Array(await selected.arrayBuffer()); let binary = '';
        for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
        value = btoa(binary);
      } else value = await selected.text();
      if (generation === fileGeneration.current) setContent(value);
    } catch (cause) { if (generation === fileGeneration.current) setError(errorMessage(cause)); }
    finally { if (generation === fileGeneration.current) setReading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const payload = { format, fileName: external ? `${format}-schedule` : file?.name, sourceKey: source.trim(), utcOffset: offset, queued: true, ...(external ? { startDate: start, endDate: end } : { content }), ...(format === 'ics' ? { groupName: group || undefined, pairNumber: pair } : {}) };
    const fingerprint = JSON.stringify(payload);
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await apiFetch<ImportJob>('/admin/schedule/upload', { method: 'POST', body: JSON.stringify({ ...payload, idempotencyKey: intent.current.key }) });
      setJob(result);
      try { sessionStorage.setItem(storageKey, result.jobId); } catch { /* Keep the result in memory if storage is unavailable. */ }
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <Card><h2 className="text-xl font-bold text-slate-950">Первое расписание</h2><p className="mt-2 text-sm text-slate-600">Загружается только выбранный источник. Отсутствующие занятия не удаляются. CSV/XLSX/JSON требуют стабильного id и точного названия группы; ICS использует UTC и ограниченный набор повторений.</p>
    <form onSubmit={event => void submit(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold">Формат источника<select className={fieldClass} disabled={busy} value={format} onChange={event => { fileGeneration.current++; setReading(false); setFormat(event.target.value as keyof typeof labels); setFile(null); setContent(''); setError(''); }}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-semibold">Постоянное имя источника<input required maxLength={100} className={fieldClass} value={source} onChange={event => setSource(event.target.value)} /></label>
      <label className="grid gap-2 text-sm font-semibold">Смещение времени вуза от UTC<input required pattern={'(?:\\+|-)(?:0[0-9]|1[0-4]):[0-5][0-9]'} className={fieldClass} value={offset} onChange={event => setOffset(event.target.value)} placeholder="+06:00" /></label>
      {!external && <label className="grid min-w-0 gap-2 text-sm font-semibold">Файл до 2 МиБ<input key={format} required type="file" accept={`.${format}`} className={`${fieldClass} text-sm`} disabled={busy} onChange={event => void readFile(event.target.files?.[0] || null)} /></label>}
      {external && <><label className="grid gap-2 text-sm font-semibold">Начало периода<input required type="date" className={fieldClass} value={start} onChange={event => setStart(event.target.value)} /></label><label className="grid gap-2 text-sm font-semibold">Конец периода<input required type="date" min={start} className={fieldClass} value={end} onChange={event => setEnd(event.target.value)} /></label><p className="text-sm text-slate-600 sm:col-span-2">Сначала настройте <Link href="/connectors" className="font-semibold text-indigo-700 underline">коннектор</Link>. Для Moodle нужны scheduleGroupMap и schedulePairTimes. СИБИТ сопоставляет numeric externalId; не запускайте этот поток одновременно со старой синхронизацией.</p></>}
      {format === 'ics' && <><label className="grid gap-2 text-sm font-semibold">Группа ICS без X-NAPARE-GROUP<select className={fieldClass} value={group} onChange={event => setGroup(event.target.value)}><option value="">Из файла</option>{groups.map(row => <option key={row.id} value={row.name}>{row.name}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Номер пары ICS по умолчанию<input required type="number" min={1} max={20} className={fieldClass} value={pair} onChange={event => setPair(Number(event.target.value))} /></label></>}
      <p className="text-sm text-slate-700 sm:col-span-2">{file && content ? `Готов к отправке: ${file.name} · ${Math.ceil(file.size / 1024)} КиБ. Проверка строк выполняется сервером до записи.` : reading ? 'Читаем файл…' : external ? 'Данные будут прочитаны из настроенного источника.' : 'Выберите файл для проверки и импорта.'}</p>
      {error && <p role="alert" className="break-words text-red-800 sm:col-span-2">{error}</p>}
      <Button type="submit" loading={busy} disabled={busy || reading || (!external && !content) || !groups.length || !source.trim()}>Проверить и поставить импорт в очередь</Button>
    </form>
    {job && <section aria-live="polite" className="mt-6 rounded-xl bg-slate-50 p-4"><h3 className="font-bold">{jobLabels[job.status] || job.status}</h3><p className="mt-2 break-all text-xs text-slate-600">Задание {job.jobId}</p>{job.lastError && <p className="mt-2 text-red-800">{job.lastError}</p>}{job.result && <p className="mt-2 text-sm">Добавлено {job.result.imported}; обновлено {job.result.updated}; отменено {job.result.deleted}; без изменений {job.result.unchanged}.</p>}<Button variant="secondary" className="mt-4" onClick={() => void refreshJob(job.jobId)}>Обновить состояние</Button><p className="mt-3 text-sm text-slate-600">Если очередь не движется, администратору сервера нужно проверить worker. После выполнения перейдите к проверке готовности.</p></section>}
  </Card>;
}
