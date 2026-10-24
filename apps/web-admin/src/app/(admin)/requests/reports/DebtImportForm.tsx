'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui';
import { controlClass, type Group } from '../types';

type Row = { studentId: string; subject: string; period: string; basis: string };
export default function DebtImportForm({ groups, onSaved }: { groups: Group[]; onSaved: () => void }) {
  const [groupId, setGroupId] = useState(''), [source, setSource] = useState(''), [reference, setReference] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[] | null>(null), [confirmed, setConfirmed] = useState(false), [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const generation = useRef(0), requestId = useRef<string | null>(null), pending = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; pending.current?.abort(); }, []);
  async function read(file?: File) {
    const current = ++generation.current; setRows(null); setError(''); requestId.current = null;
    if (!file) return;
    try {
      if (file.size > 2500000) throw new Error('Файл должен быть не больше 2,5 МБ.');
      const value: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      if (!Array.isArray(value) || value.length > 2000 || value.some(row => !row || typeof row !== 'object' || ['studentId','subject','period','basis'].some(key => typeof row[key] !== 'string'))) throw new Error('Нужен JSON-массив до 2000 записей с полями studentId, subject, period, basis.');
      if (current === generation.current) setRows(value);
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Не удалось прочитать файл.'); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || rows === null) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setNotice(''); requestId.current ??= crypto.randomUUID();
    try {
      const result = await apiFetch<{ count: number; replay: boolean }>('/requests/reports/debt-snapshots', { method: 'POST', signal: controller.signal,
        body: JSON.stringify({ requestId: requestId.current, groupId, source, reference, asOfDate, confirmsOfficialSource: confirmed, confirmsCompleteGroupSnapshot: complete, records: rows }) });
      if (!controller.signal.aborted) { setNotice(`Реестр сохранён. Записей: ${result.count}. ${result.replay ? 'Повторная отправка не создала новый снимок.' : 'Прежний снимок сохранён в истории.'}`); onSaved(); }
    } catch (cause) { if (!controller.signal.aborted) setError(`${cause instanceof Error ? cause.message : 'Сохранение не подтверждено.'} При обрыве связи проверьте дату источника в отчёте. Повторная отправка неизменённой формы безопасна.`); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4" onChange={() => { requestId.current = null; setNotice(''); }}>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <legend className="mb-3 text-lg font-bold text-slate-950">Подтвердить реестр группы</legend>
      <p className="text-sm text-slate-700 sm:col-span-2">Загрузите полный список задолженностей из официальной системы вуза. Оценки Moodle сами по себе таким реестром не являются. Новый снимок заменит текущий список выбранной группы.</p>
      <label className="grid gap-2 text-sm font-semibold text-slate-900">Группа<select required className={controlClass} value={groupId} onChange={event => setGroupId(event.target.value)}><option value="">Выберите группу</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-semibold text-slate-900">Дата реестра (UTC)<input required type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} className={controlClass} value={asOfDate} onChange={event => setAsOfDate(event.target.value)} /></label>
      <label className="grid gap-2 text-sm font-semibold text-slate-900">Официальный источник<input required minLength={3} maxLength={200} className={controlClass} value={source} onChange={event => setSource(event.target.value)} /></label>
      <label className="grid gap-2 text-sm font-semibold text-slate-900">Реквизиты реестра<input required maxLength={200} className={controlClass} value={reference} onChange={event => setReference(event.target.value)} /></label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-900 sm:col-span-2">Файл JSON<input required type="file" accept=".json,application/json" className={`${controlClass} min-w-0 max-w-full`} onChange={event => void read(event.target.files?.[0])} /></label>
      <p className="break-words text-sm text-slate-700 sm:col-span-2">Формат: массив записей с studentId (код аккаунта), subject (дисциплина), period (период), basis (основание). До 2000 записей. Имена, контакты и медицинские сведения не вносите. Пустой массив [] подтверждает отсутствие записей у всей группы на дату источника.</p>
      <p role="status" className="text-sm text-slate-800 sm:col-span-2">{rows === null ? 'Файл ещё не проверен.' : `Прочитано записей: ${rows.length}. Сервер дополнительно проверит коды студентов и принадлежность группе.`}</p>
      <label className="flex items-start gap-3 text-sm text-slate-900 sm:col-span-2"><input required type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Подтверждаю официальный источник реестра задолженностей.</label>
      <label className="flex items-start gap-3 text-sm text-slate-900 sm:col-span-2"><input required type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={complete} onChange={event => setComplete(event.target.checked)} />Подтверждаю полноту списка для всей выбранной группы на указанную дату. Отсутствующие записи прежнего снимка перестанут быть текущими.</label>
    </fieldset>
    {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <Button type="submit" disabled={busy || rows === null || !confirmed || !complete || !groupId}>{busy ? 'Сохраняем…' : 'Сохранить подтверждённый реестр'}</Button>
  </form>;
}
