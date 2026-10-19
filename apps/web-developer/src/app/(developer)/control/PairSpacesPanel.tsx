'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

interface PairSpace {
  id: string;
  universityId: string;
  universityName: string | null;
  lessonId: string;
  lesson: { id: string; subject: string; groupId: string; groupName: string | null; teacherId: string | null; teacherName: string | null } | null;
  courseId: string | null;
  courseName: string | null;
  lessonOccurrenceId: string | null;
  occurrenceStartsAt: string | null;
  lessonSpaceId: string | null;
  lessonSpaceName: string | null;
  subject: string;
  date: string;
  pairNumber: number;
  teacherName: string | null;
  group: string | null;
  room: string | null;
  isActive: boolean;
  synchronization: { source: string | null; status: string; lastSyncedAt: string | null; activeUntil: string | null };
  childCounts: { announcements: number; homeworks: number; submissions: number; progressRecords: number; notes: number; files: number; messages: number };
  integrity: Record<string, boolean>;
}
interface University { id: string; name: string; city: string }

const integrityLabels: Record<string, string> = {
  universityExists: 'Университет существует',
  lessonExistsInUniversity: 'Занятие связано с тем же вузом',
  courseLinkValid: 'Связь с курсом',
  occurrenceLinkValid: 'Связь с вхождением расписания',
  lessonSpaceLinkValid: 'Связь с пространством занятия',
  courseSpaceLinkValid: 'Связь с пространством курса',
  subjectMatchesLesson: 'Предмет совпадает с занятием',
};
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU') : '—';

export default function PairSpacesPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [nextActive, setNextActive] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('pairspace-content.write');
  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);
  const filters = useMemo(() => {
    const params = new URLSearchParams({ q: query.slice(0, 100), page: String(page), limit: '20' });
    if (universityId) params.set('universityId', universityId);
    if (activeFilter) params.set('isActive', activeFilter);
    return params.toString();
  }, [query, universityId, activeFilter, page]);
  const list = useResource<Page<PairSpace>>(`/platform-pair-space/spaces?${filters}`);
  const detail = useResource<PairSpace>(selectedId ? `/platform-pair-space/spaces/${selectedId}` : null);
  const selected = detail.data?.id === selectedId ? detail.data : null;

  useEffect(() => {
    if (!selected) return;
    setNextActive(selected.isActive);
    setReason('');
  }, [selected?.id, selected?.isActive]);

  const clearMessages = () => { setError(''); setNotice(''); };
  const filterChanged = (update: () => void) => { update(); setPage(1); setSelectedId(''); clearMessages(); };
  const save = async () => {
    if (!selected || !canWrite || reason.trim().length < 3 || nextActive === selected.isActive || busy) return;
    setBusy(true); clearMessages();
    try {
      await apiFetch(`/platform-pair-space/spaces/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', body: JSON.stringify({ isActive: nextActive, reason: reason.trim() }),
      });
      setNotice('Статус пространства обновлён; причина и изменение записаны в аудит.');
      setReason(''); detail.refresh(); list.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Пространства пар</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Проверка связей пространства с занятием, вузом и академическим каталогом. Синхронизируемые поля доступны только для просмотра; можно исправить только активность.</p></div>
    {(error || list.error || detail.error || universities.error) && <Notice error>{error || list.error || detail.error || universities.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => filterChanged(() => setQuery(event.target.value))} placeholder="Предмет, группа, преподаватель, ID" /></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => filterChanged(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{(universities.data?.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.city}</option>)}</select></label>
      <label className="block text-sm">Состояние<select className={inputClass} value={activeFilter} onChange={event => filterChanged(() => setActiveFilter(event.target.value))}><option value="">Все</option><option value="true">Активные</option><option value="false">Отключённые</option></select></label>
    </div>
    {list.loading && <p role="status" className="text-sm text-slate-400">Ищем пространства…</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0"><div className="max-h-[38rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">
        {list.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-24 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); clearMessages(); }}>
          <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 break-words text-sm font-semibold">{item.subject}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${item.isActive ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{item.isActive ? 'Активно' : 'Отключено'}</span></span>
          <span className="mt-1 block text-xs text-slate-400">{item.group || item.lesson?.groupName || 'Без группы'} · {item.teacherName || 'Преподаватель не указан'} · {item.universityName || item.universityId}</span>
          <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{dateLabel(item.date)} · пара {item.pairNumber} · {item.room || 'аудитория не указана'}</span>
        </button>)}
      </div>{list.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено: {list.data.meta.total}</p><Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} /></>}{list.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Пространства не найдены.</p>}</div>
      <div className="min-w-0">
        {!selectedId && <div className={panelClass}><p className="text-sm text-slate-400">Выберите пространство, чтобы проверить связи и связанные данные.</p></div>}
        {selectedId && detail.loading && <p role="status" className="text-sm text-slate-400">Открываем пространство…</p>}
        {selected && <article className={`${panelClass} space-y-4`}>
          <div><h3 className="font-semibold">{selected.subject}</h3><p className="mt-1 text-sm text-slate-400">{selected.universityName || selected.universityId} · {selected.group || selected.lesson?.groupName || 'Без группы'} · {dateLabel(selected.date)}</p></div>
          <dl className="grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2"><div><dt>Занятие</dt><dd className="mt-1 break-all text-slate-300">{selected.lessonId} · {selected.lesson?.subject || 'Связь не найдена'}</dd></div><div><dt>Преподаватель / аудитория</dt><dd className="mt-1 text-slate-300">{selected.teacherName || '—'} · {selected.room || '—'}</dd></div><div><dt>Курс / академическое вхождение</dt><dd className="mt-1 break-all text-slate-300">{selected.courseName || selected.courseId || '—'} · {selected.lessonOccurrenceId || '—'}</dd><dd className="text-[var(--color-text-muted)]">{dateLabel(selected.occurrenceStartsAt)}</dd></div><div><dt>Пространство занятия</dt><dd className="mt-1 break-all text-slate-300">{selected.lessonSpaceName || selected.lessonSpaceId || '—'}</dd></div></dl>
          <div><h4 className="text-sm font-medium">Связанные записи</h4><p className="mt-1 text-xs text-slate-400">Объявления: {selected.childCounts.announcements} · задания: {selected.childCounts.homeworks} · сдачи: {selected.childCounts.submissions} · прогресс: {selected.childCounts.progressRecords} · личные заметки: {selected.childCounts.notes} · файлы: {selected.childCounts.files} · сообщения: {selected.childCounts.messages}</p></div>
          <div><h4 className="text-sm font-medium">Проверка связей</h4><ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">{Object.entries(integrityLabels).map(([key, label]) => <li key={key} className={selected.integrity[key] ? 'text-emerald-200' : 'text-amber-200'}>{selected.integrity[key] ? '✓' : 'Проверьте'} {label}</li>)}</ul></div>
          <p className="text-xs text-[var(--color-text-muted)]">Синхронизация: {selected.synchronization.source || 'источник не указан'} · {selected.synchronization.status} · {dateLabel(selected.synchronization.lastSyncedAt)}</p>
          {canWrite ? <form className="space-y-3 border-t border-slate-700 pt-4" onSubmit={event => { event.preventDefault(); void save(); }}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={nextActive} onChange={event => setNextActive(event.target.checked)} />Пространство активно</label><label className="block text-sm">Причина изменения<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3 || nextActive === selected.isActive}>{busy ? 'Сохраняем…' : 'Сохранить состояние'}</Button></form> : <p className="text-xs text-[var(--color-text-muted)]">Для изменения требуется `pairspace-content.write`.</p>}
        </article>}
      </div>
    </div>
  </section>;
}
