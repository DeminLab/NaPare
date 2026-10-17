'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

interface Discussion { id: string; pairSpaceId: string; lessonId: string; universityId: string; universityName: string; subject: string; lessonDate: string; pairNumber: number; groupId: string; authorId: string; authorName: string; authorEmail: string; textPreview: string; parentId: string | null; moderationState: 'visible' | 'hidden'; createdAt: string; updatedAt: string; text?: string; moderationReason?: string | null }

export default function DiscussionsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Discussion | null>(null);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('discussion-data.write');
  const universityOptions = useResource<Page<{ id: string; name: string; city: string }>>(access.permissions.includes('universities.read') ? '/platform/universities?limit=100' : null);
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (query.trim()) params.set('q', query.trim());
  if (state) params.set('state', state);
  if (universityId) params.set('universityId', universityId);
  const list = useResource<Page<Discussion>>(`/platform-discussions/messages?${params.toString()}`);
  const refresh = () => list.refresh();

  const open = async (item: Discussion) => {
    setBusy(true); setError(''); setNotice(''); setSelected(null);
    try {
      const detail = await apiFetch<Discussion>(`/platform-discussions/messages/${item.id}`);
      setSelected(detail); setText(detail.text ?? ''); setReason('');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const close = () => { setSelected(null); setText(''); setReason(''); };
  const update = async (mode: 'edit' | 'hide' | 'restore') => {
    if (!selected || !canWrite || busy || reason.trim().length < 3) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'edit') await apiFetch(`/platform-discussions/messages/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ text, reason: reason.trim() }) });
      else await apiFetch(`/platform-discussions/messages/${selected.id}/moderation`, { method: 'POST', body: JSON.stringify({ state: mode === 'hide' ? 'hidden' : 'visible', reason: reason.trim() }) });
      close(); refresh(); setNotice(mode === 'edit' ? 'Текст исправлен и записан в аудит.' : mode === 'hide' ? 'Сообщение скрыто; его можно восстановить.' : 'Сообщение восстановлено. Действие записано в аудит.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Обсуждения Pair Space</h2><p className="mt-1 text-sm text-slate-400">Поиск сообщений по автору, вузу, занятию и тексту. Полный текст открывается с записью просмотра в аудит; скрытие обратимо.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-sm">Поиск сообщения или автора<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Текст, ФИО, email, ID, предмет" /></label>
      {universityOptions.data && <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все университеты</option>{universityOptions.data.data.map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>}
      <label className="block text-sm">Состояние<select className={inputClass} value={state} onChange={event => { setState(event.target.value); setPage(1); }}><option value="">Все</option><option value="visible">Видимые</option><option value="hidden">Скрытые</option></select></label>
    </div>
    {(error || list.error || universityOptions.error) && <Notice error>{error || list.error || universityOptions.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    {list.loading && <p role="status" className="text-sm text-slate-400">Загружаем сообщения…</p>}
    <div className="divide-y divide-slate-700 rounded-xl border border-slate-700">
      {list.data?.data.map(item => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-semibold">{item.authorName || item.authorId} · {item.subject}</p><p className="mt-1 break-all text-xs text-slate-400">{item.authorEmail} · {item.universityName} · {new Date(item.lessonDate).toLocaleDateString('ru-RU')} · пара {item.pairNumber}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{item.textPreview}</p><p className="mt-1 text-xs text-cyan-200">{item.moderationState === 'hidden' ? 'Скрыто модератором' : 'Опубликовано'} · {item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : ''}</p></div><Button disabled={busy} onClick={() => void open(item)}>Открыть</Button></article>)}
    </div>
    {list.data?.data.length === 0 && <p className="text-sm text-slate-400">Сообщений по этому запросу нет.</p>}{list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
    {selected && <section className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{selected.authorName || selected.authorId} · {selected.subject}</h3><p className="mt-1 break-all text-xs text-slate-400">{selected.authorEmail} · {selected.universityName} · сообщение {selected.id}</p></div><Button disabled={busy} onClick={close}>Закрыть</Button></div>
      {!canWrite && <Notice>У вас есть право просмотра. Для правки и модерации требуется разрешение владельца платформы.</Notice>}
      {!canWrite && <p className="whitespace-pre-wrap break-words rounded-lg border border-slate-700 p-3 text-sm">{selected.text}</p>}
      {canWrite && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void update('edit'); }}>
        <label className="block text-sm">Текст сообщения<textarea className={`${inputClass} min-h-36`} maxLength={4000} required value={text} onChange={event => setText(event.target.value)} /></label>
        <label className="block text-sm">Причина администрирования<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Например: исправление после обращения пользователя" /></label>
        {selected.moderationState === 'hidden' && <p className="text-xs text-amber-200">Сообщение скрыто. Сохранение текста не восстановит его автоматически.</p>}
        {selected.moderationReason && <p className="text-xs text-slate-400">Последняя причина модерации: {selected.moderationReason}</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Сохранить текст'}</Button>{selected.moderationState === 'visible' ? <Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void update('hide')}>Скрыть сообщение</Button> : <Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void update('restore')}>Восстановить сообщение</Button>}</div>
      </form>}
    </section>}
  </section>;
}
