'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchAllPages } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { errorMessage, fieldClass, localDate, type Account, type Faculty, type Group, type Lesson, type University } from './types';

interface Snapshot { faculties: Faculty[]; groups: Group[]; users: Account[]; lessons: Lesson[]; start: string; end: string; offset: string; at: string }
export default function ReadinessStep({ university }: { university: University }) {
  const [start, setStart] = useState(localDate()), [end, setEnd] = useState(localDate(new Date(Date.now() + 6 * 86400000)));
  const [offset, setOffset] = useState('+06:00');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saving, setSaving] = useState(''), [page, setPage] = useState(1);
  const [teacher, setTeacher] = useState<Record<string, string>>({});
  const [analyticsNotice, setAnalyticsNotice] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { pending.current?.abort(); setBusy(false); setSnapshot(null); setAnalyticsNotice(''); }, [start, end, offset]);
  async function check() {
    const from = Date.parse(`${start}T00:00:00Z`), to = Date.parse(`${end}T00:00:00Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 31 * 86400000) { setError('Выберите период от 1 до 32 дней.'); return; }
    if (!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset)) { setError('Укажите смещение времени проверки, например +06:00.'); return; }
    const period = new URLSearchParams({ startDate: new Date(`${start}T00:00:00${offset}`).toISOString(), endDate: new Date(`${end}T23:59:59.999${offset}`).toISOString() });
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setAnalyticsNotice(''); setSnapshot(null); setPage(1);
    try {
      const [faculties, groups, users, lessons] = await Promise.all([
        apiFetchAllPages<Faculty>('/admin/faculties', { signal: controller.signal }), apiFetchAllPages<Group>('/admin/groups', { signal: controller.signal }),
        apiFetchAllPages<Account>('/admin/users', { signal: controller.signal }), apiFetchAllPages<Lesson>(`/schedule/range?${period}`, { signal: controller.signal }),
      ]);
      if (!controller.signal.aborted) setSnapshot({ faculties, groups, users, lessons, start, end, offset, at: new Date().toLocaleString('ru-RU') });
      if (!controller.signal.aborted) {
        try {
          const observed = await apiFetch<{ enabled: boolean; ready: boolean | null; recordedAt: string | null }>('/analytics/onboarding-observation', { method: 'POST', body: JSON.stringify({ startDate: period.get('startDate'), endDate: period.get('endDate') }), signal: controller.signal });
          if (!controller.signal.aborted && observed.enabled) setAnalyticsNotice(observed.ready ? 'Сервер подтвердил готовность. Первое наблюдение сохранено для показателя времени подключения.' : 'Сервер пока не подтвердил готовность для аналитики. Проверьте список и повторите проверку после исправлений.');
        } catch { if (!controller.signal.aborted) setAnalyticsNotice('Проверка готовности загружена, но наблюдение для аналитики сохранить не удалось. Повторная проверка безопасна.'); }
      }
    } catch (cause) { if (!controller.signal.aborted) setError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const teachers = snapshot?.users.filter(user => user.role === 'teacher' && user.isActive) || [];
  const teacherIds = new Set(teachers.map(user => user.id));
  const unlinked = snapshot?.lessons.filter(lesson => !lesson.teacherId || !teacherIds.has(lesson.teacherId)) || [];
  const groupIds = new Set(snapshot?.lessons.map(lesson => lesson.groupId));
  const emptyGroups = snapshot?.groups.filter(group => !groupIds.has(group.id)) || [];
  const checks = snapshot ? [
    { label: 'Название и город заполнены', ok: !!university.name.trim() && !!university.city.trim() },
    { label: 'Есть факультеты и группы', ok: snapshot.faculties.length > 0 && snapshot.groups.length > 0 },
    { label: 'У всех групп есть занятия в выбранном периоде', ok: snapshot.groups.length > 0 && emptyGroups.length === 0 },
    { label: 'Все занятия связаны с действующим аккаунтом преподавателя', ok: snapshot.lessons.length > 0 && unlinked.length === 0 },
    { label: 'Есть действующий администратор', ok: snapshot.users.some(user => user.role === 'university_admin' && user.isActive) },
  ] : [];
  async function linkTeacher(lesson: Lesson) {
    if (!teacher[lesson.id]) return;
    setSaving(lesson.id); setError('');
    try {
      await apiFetch(`/schedule/${lesson.id}`, { method: 'PATCH', body: JSON.stringify({ teacherId: teacher[lesson.id], changeDescription: 'Явная привязка преподавателя при настройке вуза' }) });
      setSnapshot(current => current ? { ...current, lessons: current.lessons.map(row => row.id === lesson.id ? { ...row, teacherId: teacher[lesson.id] } : row) } : null);
      setPage(1);
    } catch (cause) { setError(errorMessage(cause)); } finally { setSaving(''); }
  }
  return <Card><h2 className="text-xl font-bold text-slate-950">Проверка готовности</h2><p className="mt-2 text-sm text-slate-600">Проверяется выбранный период, все страницы групп, пользователей и расписания. При ошибке запроса готовность не вычисляется.</p>
    <label className="mt-5 grid max-w-xs gap-2 text-sm font-semibold">Смещение времени проверки<input required className={fieldClass} value={offset} onChange={event => setOffset(event.target.value)} placeholder="+06:00" /></label><div className="mt-5 grid items-end gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-semibold">Начало проверки<input type="date" required className={fieldClass} value={start} onChange={event => { setStart(event.target.value); setSnapshot(null); }} /></label><label className="grid gap-2 text-sm font-semibold">Конец проверки<input type="date" required min={start} className={fieldClass} value={end} onChange={event => { setEnd(event.target.value); setSnapshot(null); }} /></label><Button disabled={busy || !!saving} loading={busy} onClick={() => void check()}>Проверить готовность</Button></div>
    {error && <p role="alert" className="mt-4 break-words text-red-800">{error}</p>}
    {analyticsNotice && <p role="status" className="mt-4 break-words text-slate-700">{analyticsNotice}</p>}
    {snapshot && <section className="mt-6" aria-live="polite"><h3 className={`text-lg font-bold ${checks.every(check => check.ok) ? 'text-emerald-900' : 'text-amber-900'}`}>{checks.every(check => check.ok) ? 'Учебная настройка готова для выбранного периода' : 'Остались незавершённые шаги'}</h3><p className="mt-2 text-sm text-slate-600">{snapshot.start} — {snapshot.end}, UTC{snapshot.offset}; получено {snapshot.lessons.length} занятий. Проверено {snapshot.at}. Это не подтверждение всего семестра, юридической или серверной готовности.</p>
      <ul className="mt-4 space-y-3">{checks.map(check => <li key={check.label} className="flex gap-3 text-sm"><span className={`shrink-0 font-bold ${check.ok ? 'text-emerald-800' : 'text-amber-900'}`}>{check.ok ? 'Готово' : 'Нужно'}</span><span>{check.label}</span></li>)}</ul>
      {emptyGroups.length > 0 && <p className="mt-4 break-words text-sm text-amber-900">Без занятий: {emptyGroups.map(group => group.name).join(', ')}.</p>}
      {unlinked.length > 0 && <div className="mt-6"><h3 className="font-bold">Привязать преподавателей · {unlinked.length} занятий</h3><p className="mt-2 text-sm text-slate-600">Выберите аккаунт вручную для конкретного занятия. Совпадение ФИО не назначает преподавателя автоматически. Недостающий аккаунт создайте в <Link href="/users" className="font-semibold text-indigo-700 underline">пользователях</Link>.</p>
        <ul className="mt-4 space-y-4">{unlinked.slice((page - 1) * 20, page * 20).map(lesson => <li key={lesson.id} className="rounded-xl border border-slate-200 p-4"><p className="break-words font-semibold">{lesson.subject} · {snapshot.groups.find(group => group.id === lesson.groupId)?.name || 'Неизвестная группа'}</p><p className="mt-1 text-sm text-slate-600">{new Date(lesson.startDate).toLocaleString('ru-RU')} · в источнике: {lesson.teacherName || 'не указан'}</p>{/^[0-9a-f-]{36}$/i.test(lesson.id) ? <div className="mt-3 flex flex-col gap-3 sm:flex-row"><label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">Аккаунт преподавателя<select className={fieldClass} value={teacher[lesson.id] || ''} onChange={event => setTeacher(current => ({ ...current, [lesson.id]: event.target.value }))}><option value="">Выберите аккаунт</option>{teachers.map(user => <option key={user.id} value={user.id}>{user.lastName} {user.firstName} · {user.email}</option>)}</select></label><Button className="sm:self-end" disabled={!!saving || !teacher[lesson.id]} loading={saving === lesson.id} onClick={() => void linkTeacher(lesson)}>Привязать</Button></div> : <p className="mt-3 text-sm text-amber-900">Внешнее занятие: настройте sourceTeacherId в пользователях и выполните синхронизацию СИБИТ.</p>}</li>)}</ul>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Назад</Button><span className="text-sm">Страница {page} из {Math.max(1, Math.ceil(unlinked.length / 20))}</span><Button variant="secondary" disabled={page * 20 >= unlinked.length} onClick={() => setPage(value => value + 1)}>Далее</Button></div>
      </div>}
    </section>}
  </Card>;
}
