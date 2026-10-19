'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';
import LegacyLessonsPanel from './LegacyLessonsPanel';
import AcademicEventsPanel from './AcademicEventsPanel';
import AcademicCatalogPanel from './AcademicCatalogPanel';

interface Occurrence {
  id: string; universityId: string; universityName: string; courseId: string; courseName: string; seriesId: string;
  groupId: string; groupName: string; teacherId: string | null; teacherName: string | null;
  startsAt: string; endsAt: string; room: string | null; building: string | null; status: string;
  source: string | null; syncStatus: string; changeReason: string | null;
}
interface ScheduleChange { id: string; originalValue: Record<string, unknown>; newValue: Record<string, unknown>; reason: string | null; actorId: string | null; timestamp: string }
interface OccurrenceDetail extends Occurrence { changes: ScheduleChange[] }
interface University { id: string; name: string; city: string }
type StatusFilter = 'all' | 'scheduled' | 'cancelled' | 'rescheduled' | 'completed';
const statusLabels: Record<string, string> = { all: 'Все состояния', scheduled: 'Запланировано', cancelled: 'Отменено', rescheduled: 'Перенесено', completed: 'Завершено' };
const dateLabel = (value: string) => new Date(value).toLocaleString('ru-RU');
const toLocalInput = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const toIso = (value: string) => new Date(value).toISOString();

function OccurrenceSchedulePanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [room, setRoom] = useState('');
  const [building, setBuilding] = useState('');
  const [nextStatus, setNextStatus] = useState('scheduled');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('academic-data.write');
  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);
  const filters = useMemo(() => {
    const params = new URLSearchParams({ q: query.slice(0, 100), status, page: String(page), limit: '20' });
    if (universityId) params.set('universityId', universityId);
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) { const exclusiveEnd = new Date(`${to}T00:00:00`); exclusiveEnd.setDate(exclusiveEnd.getDate() + 1); params.set('to', exclusiveEnd.toISOString()); }
    return params.toString();
  }, [query, universityId, from, to, status, page]);
  const list = useResource<Page<Occurrence>>(`/platform-academic/occurrences?${filters}`);
  const detail = useResource<OccurrenceDetail>(selectedId ? `/platform-academic/occurrences/${selectedId}` : null);
  const selected = detail.data?.id === selectedId ? detail.data : null;

  useEffect(() => {
    if (!selected) return;
    setStartsAt(toLocalInput(selected.startsAt)); setEndsAt(toLocalInput(selected.endsAt));
    setRoom(selected.room ?? ''); setBuilding(selected.building ?? ''); setNextStatus(selected.status); setReason('');
  }, [selected?.id, selected?.startsAt, selected?.endsAt, selected?.room, selected?.building, selected?.status]);

  const resetMessages = () => { setError(''); setNotice(''); };
  const filterChanged = (update: () => void) => { update(); setPage(1); setSelectedId(''); resetMessages(); };
  const save = async () => {
    if (!selected || !canWrite || selected.source !== 'manual' || reason.trim().length < 3 || busy || !startsAt || !endsAt) return;
    setBusy(true); resetMessages();
    try {
      await apiFetch(`/platform-academic/occurrences/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', body: JSON.stringify({ startsAt: toIso(startsAt), endsAt: toIso(endsAt), room: room.trim(), building: building.trim(), status: nextStatus, reason: reason.trim() }),
      });
      setNotice('Занятие исправлено. История расписания и событие сохранены.'); setReason(''); detail.refresh(); list.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    {(error || list.error || detail.error || universities.error) && <Notice error>{error || list.error || detail.error || universities.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => filterChanged(() => setQuery(event.target.value))} placeholder="Предмет, группа, преподаватель или ID" /></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => filterChanged(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{(universities.data?.data ?? []).map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>
      <label className="block text-sm">Состояние<select className={inputClass} value={status} onChange={event => filterChanged(() => setStatus(event.target.value as StatusFilter))}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-sm">С даты<input className={inputClass} type="date" value={from} onChange={event => filterChanged(() => setFrom(event.target.value))} /></label>
      <label className="block text-sm">По дату<input className={inputClass} type="date" value={to} onChange={event => filterChanged(() => setTo(event.target.value))} /></label>
    </div>
    {list.loading && <p role="status" className="text-sm text-slate-400">Ищем занятия…</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0"><div className="max-h-[38rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">
        {list.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-24 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); resetMessages(); }}>
          <span className="flex flex-wrap items-center justify-between gap-2"><span className="break-words text-sm font-semibold">{item.courseName}</span><span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{statusLabels[item.status] || item.status}</span></span>
          <span className="mt-1 block text-sm text-slate-300">{item.groupName}</span><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{item.universityName} · {dateLabel(item.startsAt)} · {item.source || 'источник не указан'}</span>
        </button>)}
      </div>{list.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено занятий: {list.data.meta.total}</p><Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} /></>}{list.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Занятия не найдены.</p>}</div>
      <div className="min-w-0">
        {!selectedId && <div className={panelClass}><p className="text-sm text-slate-400">Выберите занятие, чтобы увидеть связи и историю расписания.</p></div>}
        {selectedId && detail.loading && <p role="status" className="text-sm text-slate-400">Открываем занятие…</p>}
        {selected && <article className={`${panelClass} space-y-4`}>
          <div><h3 className="font-semibold">{selected.courseName}</h3><p className="mt-1 text-sm text-slate-400">{selected.universityName} · {selected.groupName} · {selected.teacherName || 'преподаватель не указан'}</p></div>
          <dl className="grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2"><div><dt>Время</dt><dd className="mt-1 text-slate-300">{dateLabel(selected.startsAt)} — {dateLabel(selected.endsAt)}</dd></div><div><dt>Аудитория / корпус</dt><dd className="mt-1 text-slate-300">{selected.room || '—'} · {selected.building || '—'}</dd></div><div><dt>Группа / преподаватель</dt><dd className="mt-1 break-all text-slate-400">{selected.groupId} · {selected.teacherId || '—'}</dd></div><div><dt>Курс / серия</dt><dd className="mt-1 break-all text-slate-400">{selected.courseId} · {selected.seriesId}</dd></div><div><dt>Источник / синхронизация</dt><dd className="mt-1 text-slate-300">{selected.source || '—'} · {selected.syncStatus}</dd></div><div><dt>Последняя причина</dt><dd className="mt-1 text-slate-300">{selected.changeReason || '—'}</dd></div></dl>
          {canWrite && selected.source === 'manual' ? <form className="space-y-3 border-t border-slate-700 pt-4" onSubmit={event => { event.preventDefault(); void save(); }}><h4 className="font-semibold">Исправить занятие</h4><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Начало<input className={inputClass} type="datetime-local" required value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label className="block text-sm">Окончание<input className={inputClass} type="datetime-local" required value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label><label className="block text-sm">Аудитория<input className={inputClass} maxLength={100} value={room} onChange={event => setRoom(event.target.value)} /></label><label className="block text-sm">Корпус<input className={inputClass} maxLength={100} value={building} onChange={event => setBuilding(event.target.value)} /></label><label className="block text-sm">Статус<select className={inputClass} value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{Object.entries(statusLabels).filter(([value]) => value !== 'all').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label className="block text-sm">Причина<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3 || !startsAt || !endsAt}>{busy ? 'Сохраняем…' : 'Сохранить изменение'}</Button></form> : <p className="text-xs text-[var(--color-text-muted)]">{selected.source !== 'manual' ? 'Импортированное занятие доступно для просмотра; измените его в источнике синхронизации.' : 'Для исправления требуется `academic-data.write`.'}</p>}
          <div className="space-y-2 border-t border-slate-700 pt-3"><h4 className="text-sm font-semibold">История изменений</h4>{selected.changes.map(change => <details key={change.id} className="rounded-lg border border-slate-700 p-3"><summary className="cursor-pointer text-sm">{dateLabel(change.timestamp)} · {change.reason || 'без причины'} · оператор {change.actorId || 'не указан'}</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-400">{JSON.stringify({ before: change.originalValue, after: change.newValue }, null, 2)}</pre></details>)}{!selected.changes.length && <p className="text-xs text-[var(--color-text-muted)]">История изменений пуста.</p>}</div>
        </article>}
      </div>
    </div>
  </section>;
}

export default function AcademicSchedulePanel({ access }: { access: Access }) {
  const [source, setSource] = useState<'occurrences' | 'legacy' | 'events' | 'catalog'>('occurrences');
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Расписание занятий</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Ищите занятия в обеих моделях расписания. Импортированные записи доступны для просмотра, ручные можно исправить с указанием причины.</p></div>
      <div className="flex gap-2" role="group" aria-label="Источник расписания">
        <Button aria-pressed={source === 'occurrences'} onClick={() => setSource('occurrences')} className={source === 'occurrences' ? 'border-cyan-400 bg-cyan-400/10' : ''}>Актуальное расписание</Button>
        <Button aria-pressed={source === 'legacy'} onClick={() => setSource('legacy')} className={source === 'legacy' ? 'border-cyan-400 bg-cyan-400/10' : ''}>Старые занятия</Button>
        <Button aria-pressed={source === 'events'} onClick={() => setSource('events')} className={source === 'events' ? 'border-cyan-400 bg-cyan-400/10' : ''}>Академические события</Button>
        <Button aria-pressed={source === 'catalog'} onClick={() => setSource('catalog')} className={source === 'catalog' ? 'border-cyan-400 bg-cyan-400/10' : ''}>Курсы и серии</Button>
      </div>
    </div>
    {source === 'occurrences' ? <OccurrenceSchedulePanel access={access} /> : source === 'legacy' ? <LegacyLessonsPanel access={access} /> : source === 'events' ? <AcademicEventsPanel access={access} /> : <AcademicCatalogPanel access={access} />}
  </section>;
}
