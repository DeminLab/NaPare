'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

interface LegacyLesson {
  id: string; universityId: string; universityName: string | null; groupId: string; groupName: string | null;
  courseId: string | null; seriesId: string | null; teacherId: string | null; teacherName: string | null;
  subject: string; subjectType: string | null; room: string | null; building: string | null; dayOfWeek: number;
  startTime: string; endTime: string; pairNumber: number; weekType: string; startDate: string; endDate: string;
  subgroup: string | null; department: string | null; faculty: string | null; notes: string | null;
  isChanged: boolean; changeDescription: string | null; source: string; syncStatus: string; lastSyncedAt: string | null;
}
interface LessonChange { id: string; changeType: string; oldValues: Record<string, unknown>; newValues: Record<string, unknown>; reason: string | null; actorId: string | null; timestamp: string }
interface LessonDetail extends LegacyLesson { changes: LessonChange[] }
interface University { id: string; name: string; city: string }
const dateLabel = (value: string) => new Date(value).toLocaleString('ru-RU');
const dateValue = (value: string) => new Date(value).toISOString().slice(0, 10);
const timeValue = (value: string) => value.slice(0, 5);

export default function LegacyLessonsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [subject, setSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [building, setBuilding] = useState('');
  const [notes, setNotes] = useState('');
  const [isChanged, setIsChanged] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('academic-data.write');
  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);
  const filters = useMemo(() => {
    const params = new URLSearchParams({ q: query.slice(0, 100), page: String(page), limit: '20' });
    if (universityId) params.set('universityId', universityId);
    if (from) params.set('from', from);
    if (to) { const next = new Date(`${to}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); params.set('to', next.toISOString()); }
    return params.toString();
  }, [query, universityId, from, to, page]);
  const list = useResource<Page<LegacyLesson>>(`/platform-academic/lessons?${filters}`);
  const detail = useResource<LessonDetail>(selectedId ? `/platform-academic/lessons/${encodeURIComponent(selectedId)}` : null);
  const selected = detail.data?.id === selectedId ? detail.data : null;
  useEffect(() => {
    if (!selected) return;
    setSubject(selected.subject); setStartDate(dateValue(selected.startDate)); setEndDate(dateValue(selected.endDate));
    setStartTime(timeValue(selected.startTime)); setEndTime(timeValue(selected.endTime));
    setRoom(selected.room ?? ''); setBuilding(selected.building ?? ''); setNotes(selected.notes ?? '');
    setIsChanged(selected.isChanged); setReason('');
  }, [selected?.id, selected?.subject, selected?.startDate, selected?.endDate, selected?.startTime, selected?.endTime, selected?.room, selected?.building, selected?.notes, selected?.isChanged]);

  const resetMessages = () => { setError(''); setNotice(''); };
  const filterChanged = (update: () => void) => { update(); setPage(1); setSelectedId(''); resetMessages(); };
  const save = async () => {
    if (!selected || !canWrite || selected.source !== 'manual' || reason.trim().length < 3 || busy) return;
    setBusy(true); resetMessages();
    try {
      await apiFetch(`/platform-academic/lessons/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', body: JSON.stringify({ subject: subject.trim(), startDate, endDate, startTime, endTime, room: room.trim() || null, building: building.trim() || null, notes: notes.trim() || null, isChanged, reason: reason.trim() }),
      });
      setNotice('Занятие исправлено. История и событие расписания сохранены.'); setReason(''); detail.refresh(); list.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-4">
    <p className="text-sm text-slate-400">Записи старой модели без связанной LessonOccurrence. Исторические поля группы и преподавателя доступны для просмотра; идентификаторы связей сохраняются без изменений.</p>
    {(error || list.error || detail.error || universities.error) && <Notice error>{error || list.error || detail.error || universities.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => filterChanged(() => setQuery(event.target.value))} placeholder="Предмет, группа, преподаватель или ID" /></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => filterChanged(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{(universities.data?.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.city}</option>)}</select></label>
      <label className="block text-sm">С даты<input className={inputClass} type="date" value={from} onChange={event => filterChanged(() => setFrom(event.target.value))} /></label>
      <label className="block text-sm">По дату<input className={inputClass} type="date" value={to} onChange={event => filterChanged(() => setTo(event.target.value))} /></label>
    </div>
    {list.loading && <p role="status" className="text-sm text-slate-400">Ищем старые занятия…</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0"><div className="max-h-[38rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">
        {list.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-24 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); resetMessages(); }}>
          <span className="flex flex-wrap items-center justify-between gap-2"><span className="break-words text-sm font-semibold">{item.subject}</span><span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{item.source || 'источник не указан'}</span></span>
          <span className="mt-1 block text-sm text-slate-300">{item.groupName || 'Группа не указана'} · {item.teacherName || 'Преподаватель не указан'}</span><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{item.universityName || item.universityId} · {dateLabel(item.startDate)} · {timeValue(item.startTime)}–{timeValue(item.endTime)}</span>
        </button>)}
      </div>{list.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено занятий: {list.data.meta.total}</p><Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} /></>}{list.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Старые занятия не найдены.</p>}</div>
      <div className="min-w-0">
        {!selectedId && <div className={panelClass}><p className="text-sm text-slate-400">Выберите занятие, чтобы увидеть связи и историю.</p></div>}
        {selectedId && detail.loading && <p role="status" className="text-sm text-slate-400">Открываем занятие…</p>}
        {selected && <article className={`${panelClass} space-y-4`}>
          <div><h3 className="font-semibold">{selected.subject}</h3><p className="mt-1 text-sm text-slate-400">{selected.universityName || selected.universityId} · {selected.groupName || 'группа не указана'} · {selected.teacherName || 'преподаватель не указан'}</p></div>
          <dl className="grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2"><div><dt>Период</dt><dd className="mt-1 text-slate-300">{dateLabel(selected.startDate)} — {dateLabel(selected.endDate)}</dd></div><div><dt>Время / аудитория</dt><dd className="mt-1 text-slate-300">{timeValue(selected.startTime)}–{timeValue(selected.endTime)} · {selected.room || '—'} · {selected.building || '—'}</dd></div><div><dt>Группа / преподаватель</dt><dd className="mt-1 break-all text-slate-400">{selected.groupId} · {selected.teacherId || '—'}</dd></div><div><dt>Курс / серия</dt><dd className="mt-1 break-all text-slate-400">{selected.courseId || '—'} · {selected.seriesId || '—'}</dd></div><div><dt>Тип / номер / неделя</dt><dd className="mt-1 text-slate-300">{selected.subjectType || '—'} · пара {selected.pairNumber} · {selected.weekType}</dd></div><div><dt>Источник / синхронизация</dt><dd className="mt-1 text-slate-300">{selected.source} · {selected.syncStatus}{selected.lastSyncedAt ? ` · ${dateLabel(selected.lastSyncedAt)}` : ''}</dd></div><div><dt>Последняя причина</dt><dd className="mt-1 text-slate-300">{selected.changeDescription || '—'}</dd></div><div><dt>Примечание</dt><dd className="mt-1 whitespace-pre-wrap text-slate-300">{selected.notes || '—'}</dd></div></dl>
          {canWrite && selected.source === 'manual' ? <form className="space-y-3 border-t border-slate-700 pt-4" onSubmit={event => { event.preventDefault(); void save(); }}><h4 className="font-semibold">Исправить занятие</h4><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Предмет<input className={inputClass} required maxLength={255} value={subject} onChange={event => setSubject(event.target.value)} /></label><label className="block text-sm">Начало периода<input className={inputClass} type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label className="block text-sm">Конец периода<input className={inputClass} type="date" required value={endDate} onChange={event => setEndDate(event.target.value)} /></label><label className="block text-sm">Начало<input className={inputClass} type="time" required value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="block text-sm">Окончание<input className={inputClass} type="time" required value={endTime} onChange={event => setEndTime(event.target.value)} /></label><label className="block text-sm">Аудитория<input className={inputClass} maxLength={255} value={room} onChange={event => setRoom(event.target.value)} /></label><label className="block text-sm">Корпус<input className={inputClass} maxLength={255} value={building} onChange={event => setBuilding(event.target.value)} /></label><label className="flex items-center gap-2 text-sm sm:pt-7"><input type="checkbox" checked={isChanged} onChange={event => setIsChanged(event.target.checked)} />Отмечено как изменённое</label></div><label className="block text-sm">Примечание<textarea className={`${inputClass} min-h-20`} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label><label className="block text-sm">Причина изменения<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3 || !subject.trim() || !startDate || !endDate || !startTime || !endTime}>{busy ? 'Сохраняем…' : 'Сохранить изменение'}</Button></form> : <p className="text-xs text-[var(--color-text-muted)]">{selected.source !== 'manual' ? 'Импортированное занятие доступно для просмотра; измените его в источнике синхронизации.' : 'Для исправления требуется `academic-data.write`.'}</p>}
          <div className="space-y-2 border-t border-slate-700 pt-3"><h4 className="text-sm font-semibold">История изменений</h4>{selected.changes.map(change => <details key={change.id} className="rounded-lg border border-slate-700 p-3"><summary className="cursor-pointer text-sm">{dateLabel(change.timestamp)} · {change.reason || 'без причины'} · оператор {change.actorId || 'не указан'}</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-400">{JSON.stringify({ before: change.oldValues, after: change.newValues }, null, 2)}</pre></details>)}{!selected.changes.length && <p className="text-xs text-[var(--color-text-muted)]">История изменений пуста.</p>}</div>
        </article>}
      </div>
    </div>
  </div>;
}
