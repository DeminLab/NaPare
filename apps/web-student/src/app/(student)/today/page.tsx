'use client';

import Link from 'next/link';
import { getInternalHref } from '../internal-navigation';
import { getLessonLocation } from '../schedule-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getUser, StudentUser } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Icon, RequestState, Skeleton } from '@napare/ui';
import { PreparationProgressControl, type PreparationProgress } from '../PreparationProgressControl';

interface Lesson { id: string; subject: string; subjectType?: string; teacherName?: string; room?: string; building?: string; subgroup?: string; weekType?: 'odd' | 'even' | 'both'; startTime: string; endTime: string; isChanged?: boolean; changeDescription?: string; }
interface Preparation { id: string; title: string; description?: string | null; deadline?: string | null; lessonId: string; subject: string; progress?: PreparationProgress; subtasks?: Array<{ id: string; title: string; done: boolean }>; }
interface Announcement { id: string; text: string; createdAt: string; }
interface PairSpace { lessonId: string; announcements?: Announcement[]; }
interface Notification { id: string; title: string; body?: string; type: string; deepLink?: string; createdAt: string; isRead?: boolean; priority?: string; }
interface MyDayResponse { date?: string; lessons: Lesson[]; pairSpaces?: PairSpace[]; upcomingPreparations?: Preparation[]; notifications?: { unreadCount?: number }; }
interface TodaySnapshot { savedAt: string; timeZone: string; day: MyDayResponse; user: StudentUser; notifications: Notification[]; }
type TimelineItem = { lesson: Lesson; start: number; end: number };
type ActionState = 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'noDeadline' | 'invalid';

const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', test: 'Зачёт' };
const time = (value: string) => value.includes('T') ? value.slice(11, 16) : value;
const timestamp = (value: string) => { const parsed = Date.parse(value); if (!Number.isNaN(parsed)) return parsed; const parts = value.split(':').map(Number); const date = new Date(); date.setHours(parts[0], parts[1], 0, 0); return date.getTime(); };
const dateLabel = (value?: string) => new Date(value ? `${value}T00:00:00` : Date.now()).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const deadlineLabel = (value?: string | null) => { if (!value) return 'Без срока'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Срок не указан'; const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const daysUntil = Math.round((dueDay.getTime() - today.getTime()) / 86400000); const timeValue = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); if (daysUntil === 0) return 'Сегодня, ' + timeValue; if (daysUntil === 1) return 'Завтра, ' + timeValue; if (daysUntil > 1 && daysUntil < 7) return `Через ${daysUntil} дн., ${timeValue}`; return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}) }); };
const actionLabel: Record<ActionState, string> = { today: 'Сегодня', tomorrow: 'Завтра', upcoming: 'Впереди', overdue: 'Срок прошёл', noDeadline: 'Без срока', invalid: 'Срок не указан' };
const actionState = (deadline?: string | null): ActionState => { if (!deadline) return 'noDeadline'; const date = new Date(deadline); if (Number.isNaN(date.getTime())) return 'invalid'; const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const daysUntil = Math.round((dueDay.getTime() - today.getTime()) / 86400000); if (date < now) return 'overdue'; return daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : 'upcoming'; };

function todayCacheKey(): string | null {
  try {
    const encodedClaims = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!encodedClaims) return null;
    const normalized = encodedClaims.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `napare:student-today:${encodeURIComponent(claims.universityId)}:${encodeURIComponent(claims.sub)}`;
  } catch {
    return null;
  }
}

function isTodaySnapshot(value: unknown): value is TodaySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<TodaySnapshot>;
  return typeof snapshot.savedAt === 'string'
    && typeof snapshot.timeZone === 'string'
    && !!snapshot.day && Array.isArray(snapshot.day.lessons)
    && !!snapshot.user && typeof snapshot.user.id === 'string' && typeof snapshot.user.firstName === 'string'
    && Array.isArray(snapshot.notifications);
}

function dateInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function LoadingDay() { return <div className="mx-auto max-w-[1240px] space-y-6"><div><Skeleton className="h-8 w-64" /><Skeleton className="mt-3 h-4 w-52" /></div><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div><Skeleton className="h-64 rounded-2xl" /></div>; }

export default function TodayPage() {
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [user, setUser] = useState<StudentUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const handlePreparationProgressSaved = useCallback((preparationId: string, progress: PreparationProgress) => {
    setDay(current => {
      if (!current) return current;
      const updated = { ...current, upcomingPreparations: (current.upcomingPreparations ?? []).map(item => item.id === preparationId ? { ...item, progress } : item) };
      const cacheKey = todayCacheKey();
      if (cacheKey && user) {
        try {
          const snapshot: TodaySnapshot = { savedAt: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', day: updated, user, notifications };
          window.localStorage.setItem(cacheKey, JSON.stringify(snapshot));
        } catch { /* Keep the saved server state usable if browser storage is unavailable. */ }
      }
      return updated;
    });
  }, [notifications, user]);
  const loadDay = useCallback(async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const cacheKey = todayCacheKey();
    let cached: TodaySnapshot | null = null;
    if (cacheKey) {
      try {
        const value = window.localStorage.getItem(cacheKey);
        if (value) {
          const parsed: unknown = JSON.parse(value);
          if (isTodaySnapshot(parsed) && parsed.timeZone === timeZone && parsed.day.date === dateInTimeZone(timeZone)) cached = parsed;
        }
      } catch {
        cached = null;
      }
    }

    if (cached) {
      setDay(cached.day);
      setUser(cached.user);
      setNotifications(cached.notifications);
      setLoadedAt(Date.parse(cached.savedAt));
      setOfflineSavedAt(cached.savedAt);
    } else {
      setDay(null);
      setUser(null);
      setNotifications([]);
      setLoadedAt(null);
      setOfflineSavedAt(null);
    }
    setCacheRefreshing(Boolean(cached));
    setLoading(!cached);
    setError('');
    try {
      const result = await Promise.all([
        apiFetch<MyDayResponse>(`/my-day?timeZone=${encodeURIComponent(timeZone)}`),
        getUser(),
        apiFetch<{ data: Notification[] }>('/notifications').catch(() => ({ data: [] })),
      ]);
      const savedAt = new Date().toISOString();
      const snapshot: TodaySnapshot = { savedAt, timeZone, day: result[0], user: result[1], notifications: result[2].data || [] };
      setDay(snapshot.day);
      setUser(snapshot.user);
      setNotifications(snapshot.notifications);
      setLoadedAt(Date.now());
      setOfflineSavedAt(null);
      setCacheRefreshing(false);
      if (cacheKey) {
        try { window.localStorage.setItem(cacheKey, JSON.stringify(snapshot)); } catch { /* Keep the network response usable when storage is unavailable. */ }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить учебный день.');
      setCacheRefreshing(false);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadDay(); const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, [loadDay]);

  const timeline = useMemo<TimelineItem[]>(() => (day?.lessons || []).map(lesson => ({ lesson, start: timestamp(lesson.startTime), end: timestamp(lesson.endTime) })).sort((a, b) => a.start - b.start), [day]);
  const conflicts = useMemo(() => timeline.flatMap((item, index) => timeline.slice(index + 1)
    .filter(other => item.lesson.id !== other.lesson.id && other.start < item.end && item.start < other.end)
    .map(other => ({ first: item, second: other, start: Math.max(item.start, other.start), end: Math.min(item.end, other.end) }))), [timeline]);
  const current = timeline.find(item => item.start <= now && now < item.end);
  const next = timeline.find(item => item.start > now);
  const primary = current || next;
  const tomorrow = new Date((day?.date || dateInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")) + "T12:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowHref = "/week?view=day&date=" + tomorrow.toISOString().slice(0, 10);
  const following = primary ? timeline.find(item => item.lesson.id !== primary.lesson.id && item.start > primary.start) : undefined;
  const pairSpaces = useMemo(() => new Map((day?.pairSpaces || []).map(space => [space.lessonId, space])), [day]);
  const preparations = (day?.upcomingPreparations || []).filter(preparation => preparation.progress !== 'done');
  const changes = timeline.filter(item => item.lesson.isChanged).map(item => ({ id: item.lesson.id, title: item.lesson.subject, description: item.lesson.changeDescription || 'Расписание этой пары изменилось.' }));
  const announcements = Array.from(pairSpaces.entries()).flatMap(([lessonId, space]) => (space.announcements || []).map(announcement => ({ ...announcement, lessonId }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);
  const importantNotifications = notifications.filter(notification => !notification.isRead || ['schedule_change', 'schedule_changed', 'deadline', 'new_homework'].includes(notification.type)).sort((a,b)=>(b.priority==='urgent'?2:b.priority==='high'?1:0)-(a.priority==='urgent'?2:a.priority==='high'?1:0)||Number(Boolean(a.isRead))-Number(Boolean(b.isRead))||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0, 3);
  const stale = Boolean(loadedAt && Date.now() - loadedAt > 300000);
  const progress = current ? Math.min(100, Math.max(0, ((now - current.start) / (current.end - current.start)) * 100)) : 0;
  const remaining = current ? Math.max(0, Math.ceil((current.end - now) / 60000)) : 0;

  if (loading && !day) return <LoadingDay />;
  if (error && !day) return <div className="mx-auto max-w-3xl"><RequestState title="Учебный день недоступен" description={error} onRetry={() => void loadDay()} /></div>;
  if (!day || !user) return <EmptyState title="Учебный день пока не сформирован" description="Попробуйте обновить данные позже." action={<Button onClick={() => void loadDay()}>Обновить</Button>} />;

  return <div className="mx-auto max-w-[1240px] space-y-7">
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-[var(--color-brand)]">Сегодня</p><h1 className="mt-1 ds-page-title">Добрый день, {user.firstName}</h1><p className="mt-2 text-sm capitalize text-[var(--color-text-secondary)]">{dateLabel(day.date)}</p>{offlineSavedAt && <p role="status" className="mt-2 text-xs font-medium text-[var(--color-warning)]">{cacheRefreshing ? 'Сохраненная копия · проверяем актуальность' : 'Офлайн · сохранено'} {new Date(offlineSavedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</p>}</div><div className="flex items-center gap-2">{stale && <Badge variant="warning">Данные могли устареть</Badge>}<Button variant="ghost" size="sm" onClick={() => void loadDay()}><Icon name="refresh" size={16} />Обновить</Button></div></header>
    <nav aria-label="Быстрые действия" className="flex flex-wrap gap-2">
      <Link href="/week" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold"><Icon name="calendar" />Расписание</Link>
      <Link href="/attendance/check-in" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold"><Icon name="check" />Отметиться по QR</Link>
      <Link href="/absences" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold"><Icon name="clipboard" />Сообщить об отсутствии</Link>
    </nav>
    {error && <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]" role="status">Не удалось обновить данные. {offlineSavedAt ? 'Показана сохраненная копия.' : error} <button type="button" className="font-semibold underline" onClick={() => void loadDay()}>Повторить</button></div>}
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden p-0"><div className="border-b border-[var(--color-border)] px-5 py-4 sm:px-7"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">{current ? 'Сейчас' : next ? 'Следующая пара' : timeline.length ? 'День завершён' : 'Свободный день'}</p><h2 className="mt-1 text-xl font-semibold">{primary ? primary.lesson.subject : 'Занятий больше нет'}</h2></div>{current && <Badge variant="info" dot>Идёт сейчас</Badge>}</div></div>{primary ? <div className="p-5 sm:p-7"><div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-3xl font-semibold tracking-tight">{time(primary.lesson.startTime)}–{time(primary.lesson.endTime)}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--color-text-secondary)]"><span>{getLessonLocation(primary.lesson.building, primary.lesson.room) || 'Место не указано'}</span><span>{primary.lesson.teacherName || 'Преподаватель не указан'}</span><span>{typeLabels[primary.lesson.subjectType || ''] || primary.lesson.subjectType || 'Занятие'}</span></div>{current && <div className="mt-5"><div className="mb-2 flex justify-between text-xs text-[var(--color-text-secondary)]"><span>Осталось {remaining} мин</span><span>{Math.round(progress)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-tertiary)]"><div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: progress + '%' }} /></div></div>}</div><Link href={'/pair-space/' + primary.lesson.id + (current ? '' : '?tab=homeworks')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]">Открыть занятие<Icon name="arrow-right" size={16} /></Link></div></div> : <div className="p-5"><EmptyState title={timeline.length ? "Все занятия на сегодня завершены" : "Сегодня занятий нет"} description={timeline.length ? "Посмотрите подготовку к следующим занятиям и план на завтра." : "Посмотрите расписание на другие даты."} action={<Link href={tomorrowHref} className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 text-sm font-semibold text-white">Посмотреть завтра</Link>} /></div>}</Card>
      <Card><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{following ? "Следом" : "Дальнейший план"}</p><h2 className="mt-1 text-lg font-semibold">{following ? following.lesson.subject : 'Посмотреть следующий день'}</h2></div><Icon name="calendar" className="text-[var(--color-brand)]" /></div>{following ? <Link href={'/pair-space/' + following.lesson.id + '?tab=homeworks'} className="mt-6 block rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 hover:border-[var(--color-brand)]"><p className="text-sm font-semibold text-[var(--color-brand)]">{time(following.lesson.startTime)}–{time(following.lesson.endTime)}</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{getLessonLocation(following.lesson.building, following.lesson.room) || 'Место не указано'} · {following.lesson.teacherName || 'Преподаватель не указан'}</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Подготовиться <Icon name="arrow-right" size={15} /></span></Link> : <><p className="mt-6 text-sm leading-6 text-[var(--color-text-secondary)]">Проверьте время занятий и подготовку на следующий учебный день.</p><Link href={tomorrowHref} className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-brand)]">Расписание на завтра</Link></>}</Card>
    </section>
    {conflicts.length > 0 && <section aria-label="Конфликты расписания" className="rounded-[var(--radius-lg)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 sm:p-5"><div className="flex items-start gap-3"><Icon name="info" className="mt-0.5 shrink-0 text-[var(--color-danger)]" /><div className="min-w-0"><h2 className="font-semibold text-[var(--color-danger)]">Пары пересекаются по времени</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Проверьте расписание: найдено пересечений — {conflicts.length}.</p><ul className="mt-3 space-y-2">{conflicts.map(conflict => { const overlap = `${new Date(conflict.start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–${new Date(conflict.end).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`; return <li key={`${conflict.first.lesson.id}:${conflict.second.lesson.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><Link className="font-medium underline" href={'/pair-space/' + conflict.first.lesson.id}>{conflict.first.lesson.subject}</Link><span className="text-[var(--color-text-secondary)]">и</span><Link className="font-medium underline" href={'/pair-space/' + conflict.second.lesson.id}>{conflict.second.lesson.subject}</Link><span className="text-xs text-[var(--color-text-secondary)]">· пересечение {overlap}</span></li>; })}</ul></div></div></section>}
    <section><div className="mb-3 flex items-center justify-between"><h2 className="ds-section-title">Расписание дня</h2><Link href="/week" className="text-sm font-semibold text-[var(--color-brand)]">Всё расписание <Icon name="arrow-right" size={15} className="ml-1 inline" /></Link></div>{timeline.length ? <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">{timeline.map((item, index) => { const lesson = item.lesson; const state = item.start <= now && now < item.end ? 'current' : item.end <= now ? 'done' : index === timeline.findIndex(nextItem => nextItem.start > now) ? 'next' : 'upcoming'; return <Link key={lesson.id} href={'/pair-space/' + lesson.id} className="group flex min-h-20 items-center gap-4 border-b border-[var(--color-border)] px-4 py-4 last:border-0 hover:bg-[var(--color-surface-secondary)] sm:px-6"><div className="w-20 shrink-0 font-mono text-xs text-[var(--color-text-secondary)]">{time(lesson.startTime)}<br />{time(lesson.endTime)}</div><div className={'h-9 w-1 shrink-0 rounded-full ' + (state === 'current' ? 'bg-[var(--color-brand)]' : state === 'done' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border-strong)]')} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{lesson.subject}{lesson.subgroup?.trim() && <span className="ml-2 text-xs font-medium text-[var(--color-text-secondary)]">· подгруппа {lesson.subgroup}</span>}</p>{lesson.weekType && lesson.weekType !== 'both' && <Badge variant="default">{lesson.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}</Badge>}{state === 'current' && <Badge variant="info">Сейчас</Badge>}{lesson.isChanged && <Badge variant="warning">Изменено</Badge>}</div><p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{lesson.teacherName || 'Преподаватель не указан'} · {getLessonLocation(lesson.building, lesson.room) || 'Место не указано'}</p></div><Icon name="arrow-right" size={16} className="text-[var(--color-text-muted)] transition group-hover:text-[var(--color-brand)]" /></Link>; })}</div> : <Card><EmptyState title="Сегодня пар нет" description="Расписание на другие дни доступно в разделе «Расписание»." /></Card>}</section>
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">Важные действия</p><h2 className="mt-1 ds-section-title">Что важно сегодня</h2></div>
        <div className="flex flex-wrap gap-3"><Link href="/pair-space" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-brand)]">Вся подготовка</Link><Link href="/notifications" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-brand)]">Все уведомления</Link></div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        {preparations.slice(0, 3).map(preparation => {
          const state = actionState(preparation.deadline);
          return <article key={'preparation-' + preparation.id} className="flex min-h-24 items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]"><Icon name="clipboard" size={17} /></span>
            <Link href={'/pair-space/' + preparation.lessonId + '?tab=homeworks'} className="group min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{preparation.title}</span><Badge variant={state === 'overdue' ? 'danger' : state === 'upcoming' || state === 'noDeadline' || state === 'invalid' ? 'default' : 'warning'}>{actionLabel[state]}</Badge></span><span className="mt-2 block text-xs text-[var(--color-text-secondary)]">{preparation.subject} · {deadlineLabel(preparation.deadline)}</span><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)]">Открыть занятие <Icon name="arrow-right" size={13} /></span></Link>
            <PreparationProgressControl preparationId={preparation.id} initialState={preparation.progress} onSaved={(progress) => handlePreparationProgressSaved(preparation.id, progress)} />
          </article>;
        })}
        {changes.slice(0, 2).map(change => <Link key={'change-' + change.id} href={'/pair-space/' + change.id} className="group flex min-h-24 items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)]/40 p-4"><Icon name="refresh" size={18} className="mt-1 text-[var(--color-warning)]" /><span className="min-w-0 flex-1"><span className="text-sm font-semibold">{change.title}</span><span className="mt-2 block text-xs text-[var(--color-text-secondary)]">{change.description}</span><span className="mt-2 inline-flex text-xs font-semibold text-[var(--color-brand)]">Проверить расписание</span></span></Link>)}
        {announcements.map(announcement => <Link key={'announcement-' + announcement.id} href={'/pair-space/' + announcement.lessonId} className="group flex min-h-24 items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-brand)]"><Icon name="bell" size={18} className="mt-1 text-[var(--color-info)]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Новое объявление</span><span className="mt-2 block line-clamp-2 text-xs text-[var(--color-text-secondary)]">{announcement.text}</span><span className="mt-2 inline-flex text-xs font-semibold text-[var(--color-brand)]">Прочитать объявление</span></span></Link>)}
        {importantNotifications.map(notification => <Link key={'notification-' + notification.id} href={getInternalHref(notification.deepLink) || '/notifications'} className="group flex min-h-24 items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-brand)]"><Icon name="info" size={18} className="mt-1 text-[var(--color-danger)]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{notification.title}</span><span className="mt-2 block line-clamp-2 text-xs text-[var(--color-text-secondary)]">{notification.body || 'Требует вашего внимания'}</span><span className="mt-2 inline-flex text-xs font-semibold text-[var(--color-brand)]">Открыть уведомление</span></span></Link>)}
        {!preparations.length && !changes.length && !announcements.length && !importantNotifications.length && <div className="md:col-span-2"><EmptyState title="Сейчас всё спокойно" description="Новых действий и изменений нет." action={<Link href="/week" className="text-sm font-semibold text-[var(--color-brand)]">Проверить неделю</Link>} /></div>}
      </div>
    </section>

  </div>;
}
