'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource, useTargetUserId } from './control-ui';

interface Submission { id: string; studentId: string; studentName: string; studentEmail: string; universityId: string; universityName: string; homeworkId: string; homeworkTitle: string; subject: string; date: string; pairNumber: number; status: 'not_submitted' | 'submitted'; submittedAt: string | null; updatedAt: string; fileUrl?: string | null; comment?: string | null; createdAt?: string }
const submissionLabels: Record<Submission['status'], string> = { not_submitted: 'Не сдано', submitted: 'Сдано' };
const localDateTime = (value: string) => { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };

export default function HomeworkSubmissionsPanel({ access }: { access: Access }) {
  const targetUserId = useTargetUserId();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<{ status: Submission['status']; submittedAt: string; fileUrl: string; comment: string }>({ status: 'not_submitted', submittedAt: '', fileUrl: '', comment: '' });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (targetUserId) setQuery(targetUserId); }, [targetUserId]);
  const filters = new URLSearchParams({ q: query, page: String(page), limit: '20' });
  if (status) filters.set('status', status);
  const list = useResource<Page<Submission>>(`/platform-homework/submissions?${filters.toString()}`);
  const details = useResource<Submission>(selectedId ? `/platform-homework/submissions/${selectedId}` : null);
  const canWrite = access.permissions.includes('homework-data.write');
  useEffect(() => {
    if (!details.data || details.data.id !== selectedId) return;
    setDraft({ status: details.data.status, submittedAt: details.data.submittedAt ? localDateTime(details.data.submittedAt) : '', fileUrl: details.data.fileUrl || '', comment: details.data.comment || '' });
    setReason('');
  }, [details.data, selectedId]);
  const save = async () => {
    if (!selectedId || reason.trim().length < 3 || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/platform-homework/submissions/${selectedId}`, { method: 'PATCH', body: JSON.stringify({ status: draft.status, submittedAt: draft.submittedAt ? new Date(draft.submittedAt).toISOString() : null, fileUrl: draft.fileUrl.trim() || null, comment: draft.comment.trim() || null, reason: reason.trim() }) });
      details.refresh(); list.refresh(); setNotice('Сдача исправлена, изменение записано в аудит.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Сдачи домашних заданий</h2><p className="mt-1 text-sm text-slate-400">Поиск сдач по пользователю и заданию. Полное содержимое открывается с записью просмотра в аудит; исправления требуют причины.</p></div>
    {(error || list.error || details.error) && <Notice error>{error || list.error || details.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.5fr)]">
      <label className="block text-sm">Поиск сдачи<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); setSelectedId(''); }} placeholder="ФИО, email, UUID, задание или комментарий" /></label>
      <label className="block text-sm">Статус<select className={inputClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); setSelectedId(''); }}><option value="">Все статусы</option><option value="submitted">Сдано</option><option value="not_submitted">Не сдано</option></select></label>
    </div>
    {list.loading && <p role="status" className="text-sm text-slate-400">Ищем сдачи…</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0"><div className="max-h-[38rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">{list.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-20 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); setError(''); setNotice(''); }}><span className="block text-sm font-semibold">{item.studentName || item.studentEmail}</span><span className="mt-1 block break-all text-xs text-slate-400">{item.studentEmail} · {item.homeworkTitle}</span><span className="mt-1 block break-words text-xs text-[var(--color-text-muted)]">{item.universityName} · {item.subject} · пара {item.pairNumber} · {new Date(item.date).toLocaleDateString('ru-RU')}</span><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${item.status === 'submitted' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{submissionLabels[item.status]}</span></button>)}</div>{list.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено сдач: {list.data.meta.total}</p><Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} /></>}{list.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Сдачи не найдены.</p>}</div>
      <div className="min-w-0 space-y-4">
        {!selectedId && <div className={panelClass}><p className="text-sm text-slate-400">Выберите сдачу, чтобы открыть полный текст и вложение.</p></div>}
        {details.loading && <p role="status" className="text-sm text-slate-400">Загружаем сдачу…</p>}
        {details.data && <article className={`${panelClass} space-y-4`}><div><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{details.data.homeworkTitle}</h3><p className="mt-1 text-sm text-slate-300">{details.data.studentName} · {details.data.studentEmail}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{details.data.universityName} · {details.data.subject} · пара {details.data.pairNumber}</p></div><span className="font-mono text-xs text-[var(--color-text-muted)]">{details.data.id}</span></div><p className="mt-2 text-xs text-[var(--color-text-muted)]">Пользователь: {details.data.studentId} · создано {details.data.createdAt ? new Date(details.data.createdAt).toLocaleString('ru-RU') : '—'}</p></div>
          <div className="space-y-3 rounded-lg border border-slate-700 p-3"><p className="text-sm font-semibold">Текущее содержимое</p><p className="whitespace-pre-wrap break-words text-sm text-slate-300">{details.data.comment || 'Комментарий не добавлен.'}</p>{details.data.fileUrl?.startsWith('https://') ? <a className="min-h-11 inline-flex items-center text-sm text-cyan-200 underline" href={details.data.fileUrl} target="_blank" rel="noreferrer">Открыть вложение</a> : <p className="break-all text-xs text-[var(--color-text-muted)]">Вложение: {details.data.fileUrl || 'нет'}</p>}</div>
          {canWrite ? <form className="space-y-3 rounded-lg border border-cyan-400/30 p-3" onSubmit={event => { event.preventDefault(); void save(); }}><h4 className="text-sm font-semibold">Исправить сдачу</h4><label className="block text-sm">Статус<select className={inputClass} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Submission['status'] })}><option value="submitted">Сдано</option><option value="not_submitted">Не сдано</option></select></label><label className="block text-sm">Время сдачи<input className={inputClass} type="datetime-local" value={draft.submittedAt} onChange={event => setDraft({ ...draft, submittedAt: event.target.value })} /></label><label className="block text-sm">Ссылка на вложение<input className={inputClass} type="url" maxLength={500} value={draft.fileUrl} onChange={event => setDraft({ ...draft, fileUrl: event.target.value })} placeholder="https://…" /></label><label className="block text-sm">Комментарий<textarea className={`${inputClass} min-h-28`} maxLength={10000} value={draft.comment} onChange={event => setDraft({ ...draft, comment: event.target.value })} /></label><label className="block text-sm">Причина изменения<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Сохранить исправление'}</Button></form> : <p className="text-xs text-[var(--color-text-muted)]">У вас есть право просмотра. Для исправлений требуется `homework-data.write`.</p>}
        </article>}
      </div>
    </div>
  </section>;
}
