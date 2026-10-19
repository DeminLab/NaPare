'use client';
import { useMemo, useState } from 'react';
import { type Access, type Page, Notice, Pager, inputClass, panelClass, useResource } from './control-ui';

interface PlatformEvent {
  id: string; type: string; timestamp: string; universityId: string; universityName: string;
  actorId: string | null; actorType: string; actorRole: string | null;
  targetType: string; targetId: string; priority: string; recipientCount: number;
  payload: Record<string, string | number | boolean | null>;
}
interface University { id: string; name: string; city: string }
const dateLabel = (value: string) => new Date(value).toLocaleString('ru-RU');

export default function EventsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [openedEventId, setOpenedEventId] = useState<string | null>(null);
  const filters = useMemo(() => {
    const params = new URLSearchParams({ q: query.slice(0, 100), page: String(page), limit: '20' });
    if (type.trim()) params.set('type', type.trim().slice(0, 100));
    if (priority) params.set('priority', priority);
    if (universityId) params.set('universityId', universityId);
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) { const exclusiveEnd = new Date(`${to}T00:00:00`); exclusiveEnd.setDate(exclusiveEnd.getDate() + 1); params.set('to', exclusiveEnd.toISOString()); }
    return params.toString();
  }, [query, type, priority, universityId, from, to, page]);
  const events = useResource<Page<PlatformEvent>>(`/platform-events?${filters}`);
  const detail = useResource<PlatformEvent>(openedEventId ? `/platform-events/${openedEventId}` : null);
  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);
  const updateFilter = (update: () => void) => { update(); setPage(1); setOpenedEventId(null); };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Системные события</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Неизменяемая лента действий для диагностики. Показывается только безопасный набор контекстных полей; содержимое сообщений и список получателей скрыты.</p></div>
    {(events.error || universities.error) && <Notice error>{events.error || universities.error}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => updateFilter(() => setQuery(event.target.value))} placeholder="ID цели, тип, группа, предмет" /></label>
      <label className="block text-sm">Тип события<input className={inputClass} maxLength={100} value={type} onChange={event => updateFilter(() => setType(event.target.value))} placeholder="Например, lesson.rescheduled" /></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => updateFilter(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{(universities.data?.data ?? []).map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>
      <label className="block text-sm">Важность<select className={inputClass} value={priority} onChange={event => updateFilter(() => setPriority(event.target.value))}><option value="">Любая</option><option value="low">Низкая</option><option value="normal">Обычная</option><option value="high">Высокая</option><option value="urgent">Срочная</option></select></label>
      <label className="block text-sm">С даты<input className={inputClass} type="date" value={from} onChange={event => updateFilter(() => setFrom(event.target.value))} /></label>
      <label className="block text-sm">По дату<input className={inputClass} type="date" value={to} onChange={event => updateFilter(() => setTo(event.target.value))} /></label>
    </div>
    {events.loading && <p role="status" className="text-sm text-slate-400">Загружаем события…</p>}
    {events.data && <p className="text-xs text-[var(--color-text-muted)]">Найдено событий: {events.data.meta.total}</p>}
    <div className="space-y-3">
      {events.data?.data.map(event => { const viewed = detail.data?.id === event.id ? detail.data : event; return <details key={event.id} className={`${panelClass} space-y-3`} onToggle={toggleEvent => setOpenedEventId(toggleEvent.currentTarget.open ? event.id : null)}>
        <summary className="flex cursor-pointer flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-all font-semibold">{event.type}</h3><p className="mt-1 text-sm text-slate-400">{event.universityName} · {dateLabel(event.timestamp)}</p><p className="mt-1 break-all text-xs text-[var(--color-text-muted)]">Цель: {event.targetType} · {event.targetId}</p></div><span className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300">{event.priority}</span></summary>
        {openedEventId === event.id && detail.loading && <p role="status" className="text-xs text-slate-400">Записываем просмотр…</p>}
        {openedEventId === event.id && detail.error && <Notice error>{detail.error}</Notice>}
        <dl className="grid gap-2 border-t border-slate-700 pt-3 text-xs text-slate-400 sm:grid-cols-2"><div><dt className="text-[var(--color-text-muted)]">Актёр</dt><dd className="mt-1 break-all">{viewed.actorType}{viewed.actorRole ? ` · ${viewed.actorRole}` : ''} · {viewed.actorId || 'не указан'}</dd></div><div><dt className="text-[var(--color-text-muted)]">Получатели</dt><dd className="mt-1">{viewed.recipientCount}</dd></div><div><dt className="text-[var(--color-text-muted)]">Университет</dt><dd className="mt-1 break-all">{viewed.universityId}</dd></div><div><dt className="text-[var(--color-text-muted)]">ID события</dt><dd className="mt-1 break-all">{viewed.id}</dd></div></dl>
        {Object.keys(viewed.payload).length > 0 && <div><h4 className="text-xs font-semibold text-slate-400">Безопасные поля события</h4><pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">{JSON.stringify(viewed.payload, null, 2)}</pre></div>}
      </details>;})}
      {events.data?.data.length === 0 && <p className="text-sm text-slate-400">События не найдены.</p>}
    </div>
    {events.data && <Pager page={page} totalPages={events.data.meta.totalPages} onChange={nextPage => { setPage(nextPage); setOpenedEventId(null); }} />}
  </section>;
}
