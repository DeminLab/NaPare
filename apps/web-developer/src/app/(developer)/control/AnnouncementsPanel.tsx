'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

interface Announcement {
  id: string; pairSpaceId: string; lessonId: string; universityId: string; universityName: string; subject: string; groupName: string;
  authorId: string; authorName: string; authorEmail: string; text: string; isPinned: boolean; createdAt: string; updatedAt: string;
}
interface University { id: string; name: string; city: string }
const dateLabel = (value: string) => new Date(value).toLocaleString('ru-RU');

export default function AnnouncementsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [text, setText] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('pairspace-content.write');
  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);
  const filters = useMemo(() => {
    const params = new URLSearchParams({ q: query.slice(0, 100), page: String(page), limit: '20' });
    if (universityId) params.set('universityId', universityId);
    return params.toString();
  }, [query, universityId, page]);
  const list = useResource<Page<Announcement>>(`/platform-pair-space/announcements?${filters}`);
  const detail = useResource<Announcement>(selectedId ? `/platform-pair-space/announcements/${selectedId}` : null);
  const selected = detail.data?.id === selectedId ? detail.data : null;

  useEffect(() => {
    if (!selected) return;
    setText(selected.text);
    setIsPinned(selected.isPinned);
    setReason('');
  }, [selected?.id, selected?.updatedAt]);

  const resetMessages = () => { setError(''); setNotice(''); };
  const filterChanged = (update: () => void) => { update(); setPage(1); setSelectedId(''); setReason(''); resetMessages(); };
  const save = async () => {
    if (!selected || !canWrite || reason.trim().length < 3 || busy) return;
    const patch: { text?: string; isPinned?: boolean; reason: string } = { reason: reason.trim() };
    if (text !== selected.text) patch.text = text;
    if (isPinned !== selected.isPinned) patch.isPinned = isPinned;
    if (patch.text === undefined && patch.isPinned === undefined) return;
    setBusy(true); resetMessages();
    try {
      await apiFetch(`/platform-pair-space/announcements/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setNotice('Объявление обновлено. Старые и новые значения записаны в аудит.');
      setReason(''); detail.refresh(); list.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Объявления Pair Space</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Глобальный поиск объявлений по вузам, занятиям и авторам. Можно исправить текст или закрепление; связи с автором и занятием сохраняются.</p></div>
    {(error || list.error || detail.error || universities.error) && <Notice error>{error || list.error || detail.error || universities.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => filterChanged(() => setQuery(event.target.value))} placeholder="Текст, автор, группа, предмет или ID" /></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => filterChanged(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{(universities.data?.data ?? []).map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>
    </div>
    {list.loading && <p role="status" className="text-sm text-slate-400">Ищем объявления…</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0"><div className="max-h-[38rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">
        {list.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-24 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); resetMessages(); }}>
          <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 break-words text-sm font-semibold">{item.text}</span>{item.isPinned && <span className="shrink-0 rounded-full bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-200">Закреплено</span>}</span>
          <span className="mt-1 block text-xs text-slate-400">{item.subject} · {item.groupName} · {item.universityName}</span>
          <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{item.authorName || item.authorEmail} · {dateLabel(item.createdAt)}</span>
        </button>)}
      </div>{list.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено: {list.data.meta.total}</p><Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} /></>}{list.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Объявления не найдены.</p>}</div>
      <div className="min-w-0">
        {!selectedId && <div className={panelClass}><p className="text-sm text-slate-400">Выберите объявление, чтобы просмотреть контекст и при необходимости исправить его.</p></div>}
        {selectedId && detail.loading && <p role="status" className="text-sm text-slate-400">Открываем объявление…</p>}
        {selected && <article className={`${panelClass} space-y-4`}>
          <div><h3 className="font-semibold">{selected.subject}</h3><p className="mt-1 text-sm text-slate-400">{selected.universityName} · {selected.groupName}</p></div>
          <dl className="grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2"><div><dt>Автор</dt><dd className="mt-1 break-all text-slate-300">{selected.authorName || 'Имя не указано'} · {selected.authorEmail}</dd><dd className="break-all">{selected.authorId}</dd></div><div><dt>Опубликовано / обновлено</dt><dd className="mt-1 text-slate-300">{dateLabel(selected.createdAt)} · {dateLabel(selected.updatedAt)}</dd></div><div><dt>Занятие / пространство</dt><dd className="mt-1 break-all text-slate-400">{selected.lessonId} · {selected.pairSpaceId}</dd></div><div><dt>Университет</dt><dd className="mt-1 break-all text-slate-400">{selected.universityId}</dd></div></dl>
          {canWrite ? <form className="space-y-3 border-t border-slate-700 pt-4" onSubmit={event => { event.preventDefault(); void save(); }}><label className="block text-sm">Текст объявления<textarea className={`${inputClass} min-h-40`} required maxLength={20000} value={text} onChange={event => setText(event.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPinned} onChange={event => setIsPinned(event.target.checked)} />Закрепить в пространстве пары</label><label className="block text-sm">Причина изменения<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3 || (text === selected.text && isPinned === selected.isPinned)}>{busy ? 'Сохраняем…' : 'Сохранить исправление'}</Button></form> : <p className="text-xs text-[var(--color-text-muted)]">Для исправления требуется `pairspace-content.write`.</p>}
        </article>}
      </div>
    </div>
  </section>;
}
