'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource, useTargetUserId } from './control-ui';

interface WindowRule { day: number; start: string; end: string }
interface BlockedDate { start: string; end: string }
interface Availability { studentId: string; studentName: string; studentEmail: string; role: string; universityId: string; universityName: string; weeklyHours: number; timeZone: string; windows: WindowRule[]; blockedDates: BlockedDate[]; windowCount?: number; blockedDateCount?: number; updatedAt: string }
interface UniversityOption { id: string; name: string; city: string }
const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export default function CareerAvailabilityPanel({ access }: { access: Access }) {
  const targetUserId = useTargetUserId();
  const [query, setQuery] = useState(''), [universityId, setUniversityId] = useState(''), [page, setPage] = useState(1), [selected, setSelected] = useState<Availability | null>(null), [weeklyHours, setWeeklyHours] = useState(8), [timeZone, setTimeZone] = useState('Asia/Omsk'), [windows, setWindows] = useState<WindowRule[]>([]), [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('career-data.write');
  const universities = useResource<Page<UniversityOption>>(access.permissions.includes('universities.read') ? '/platform/universities?limit=100' : null);
  useEffect(() => { if (targetUserId) setQuery(targetUserId); }, [targetUserId]);
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (query.trim()) params.set('q', query.trim()); if (universityId) params.set('universityId', universityId);
  const list = useResource<Page<Availability>>(`/platform-career/availability?${params}`);
  const close = () => { setSelected(null); setReason(''); };
  const open = async (item: Availability) => {
    setBusy(true); setError(''); setNotice('');
    try { const full = await apiFetch<Availability>(`/platform-career/availability/${item.studentId}`); setSelected(full); setWeeklyHours(full.weeklyHours); setTimeZone(full.timeZone); setWindows(full.windows); setBlockedDates(full.blockedDates); setReason(''); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!selected || !canWrite || reason.trim().length < 3) return;
    setBusy(true); setError('');
    try {
      await apiFetch(`/platform-career/availability/${selected.studentId}`, { method: 'PATCH', body: JSON.stringify({ weeklyHours, timeZone, windows, blockedDates, reason: reason.trim() }) });
      close(); list.refresh(); setNotice('Настройки планирования исправлены и записаны в аудит.');
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  };
  const updateWindow = (index: number, update: Partial<WindowRule>) => setWindows(current => current.map((window, i) => i === index ? { ...window, ...update } : window));
  const updateBlocked = (index: number, update: Partial<BlockedDate>) => setBlockedDates(current => current.map((range, i) => i === index ? { ...range, ...update } : range));
  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Карьерное планирование</h2><p className="mt-1 text-sm text-slate-400">Настройки времени студента влияют на оценку доступности задач. Изменения проходят ту же проверку часового пояса, окон и дат, что и пользовательский API.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Поиск пользователя<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="ФИО, email или UUID" /></label>{universities.data && <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все университеты</option>{universities.data.data.map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>}</div>
    {(error || list.error || universities.error) && <Notice error>{error || list.error || universities.error}</Notice>}{notice && <Notice>{notice}</Notice>}{list.loading && <p role="status" className="text-sm text-slate-400">Загружаем настройки…</p>}
    <div className="divide-y divide-slate-700 rounded-xl border border-slate-700">{list.data?.data.map(item => <article key={item.studentId} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-semibold">{item.studentName} <span className="font-normal text-slate-400">· {item.studentEmail}</span></p><p className="mt-1 text-sm text-cyan-200">{item.universityName} · {item.weeklyHours} ч/нед · {item.timeZone}</p><p className="mt-1 text-xs text-slate-400">Рабочих окон: {item.windowCount} · периодов недоступности: {item.blockedDateCount} · роль сейчас: {item.role}</p><p className="mt-1 break-all text-xs text-[var(--color-text-muted)]">Пользователь {item.studentId}</p></div><Button disabled={busy} onClick={() => void open(item)}>Открыть</Button></article>)}</div>
    {list.data?.data.length === 0 && <p className="text-sm text-slate-400">Настроек по этому запросу нет.</p>}{list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
    {selected && <section className={`${panelClass} space-y-4`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{selected.studentName}</h3><p className="mt-1 text-sm text-slate-400">{selected.studentEmail} · {selected.universityName}</p><p className="mt-1 break-all text-xs text-[var(--color-text-muted)]">Пользователь {selected.studentId}</p></div><Button disabled={busy} onClick={close}>Закрыть</Button></div>{!canWrite && <Notice>У вас есть право просмотра. Для исправления требуется разрешение career-data.write.</Notice>}{canWrite && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Бюджет часов в неделю<input className={inputClass} type="number" min={1} max={40} required value={weeklyHours} onChange={event => setWeeklyHours(Number(event.target.value))} /></label><label className="block text-sm">Часовой пояс IANA<input className={inputClass} required maxLength={80} value={timeZone} onChange={event => setTimeZone(event.target.value)} placeholder="Asia/Omsk" /></label></div>
      <div className="space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Рабочие окна</h4><Button disabled={windows.length >= 21} onClick={() => setWindows(current => [...current, { day: 1, start: '09:00', end: '17:00' }])}>Добавить окно</Button></div>{windows.map((window, index) => <fieldset key={index} className="grid gap-2 rounded-lg border border-slate-700 p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]"><legend className="px-1 text-xs text-slate-400">Окно {index + 1}</legend><label className="text-sm">День<select className={inputClass} value={window.day} onChange={event => updateWindow(index, { day: Number(event.target.value) })}>{weekdays.map((day, dayIndex) => <option key={dayIndex} value={dayIndex}>{day}</option>)}</select></label><label className="text-sm">С<input className={inputClass} type="time" required value={window.start} onChange={event => updateWindow(index, { start: event.target.value })} /></label><label className="text-sm">До<input className={inputClass} type="time" required value={window.end} onChange={event => updateWindow(index, { end: event.target.value })} /></label><Button className="self-end" disabled={windows.length <= 1} onClick={() => setWindows(current => current.filter((_, i) => i !== index))}>Удалить</Button></fieldset>)}</div>
      <div className="space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Недоступные даты</h4><Button disabled={blockedDates.length >= 12} onClick={() => { const today = new Date().toISOString().slice(0, 10); setBlockedDates(current => [...current, { start: today, end: today }]); }}>Добавить период</Button></div>{blockedDates.map((range, index) => <fieldset key={index} className="grid gap-2 rounded-lg border border-slate-700 p-3 sm:grid-cols-[1fr_1fr_auto]"><legend className="px-1 text-xs text-slate-400">Период {index + 1}</legend><label className="text-sm">С<input className={inputClass} type="date" required value={range.start} onChange={event => updateBlocked(index, { start: event.target.value })} /></label><label className="text-sm">По<input className={inputClass} type="date" required value={range.end} onChange={event => updateBlocked(index, { end: event.target.value })} /></label><Button className="self-end" onClick={() => setBlockedDates(current => current.filter((_, i) => i !== index))}>Удалить</Button></fieldset>)}</div>
      <label className="block text-sm">Причина изменения<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3}>Сохранить настройки</Button>
    </form>}</section>}
  </section>;
}
