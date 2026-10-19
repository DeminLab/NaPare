'use client';

import Link from 'next/link';
import { getInternalHref } from '../internal-navigation';
import { getLessonLocation } from '../schedule-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiFetchList, getUser, StudentUser } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Icon, LessonTypeBadge, RequestState, Skeleton } from '@napare/ui';
import { PreparationProgressControl, type PreparationProgress } from '../PreparationProgressControl';

interface Lesson { id: string; subject: string; subjectType?: string; teacherName?: string; room?: string; building?: string; subgroup?: string; weekType?: 'odd' | 'even' | 'both'; startTime: string; endTime: string; isChanged?: boolean; changeDescription?: string; }
interface Preparation { id: string; title: string; description?: string | null; deadline?: string | null; lessonId: string; subject: string; progress?: PreparationProgress; subtasks?: Array<{ id: string; title: string; done: boolean }>; }
interface Announcement { id: string; text: string; createdAt: string; }
interface PairSpace { lessonId: string; announcements?: Announcement[]; }
interface Notification { id: string; title: string; body?: string; type: string; deepLink?: string; createdAt: string; isRead?: boolean; priority?: string; }
interface MyDayResponse { date?: string; lessons: Lesson[]; pairSpaces?: PairSpace[]; upcomingPreparations?: Preparation[]; notifications?: { unreadCount?: number }; }
interface TodaySnapshot { savedAt: string; timeZone: string; day: MyDayResponse; user: StudentUser; notifications: Notification[]; }
interface ScheduleLesson extends Lesson { date?: string; startDate?: string; endDate?: string; }
interface AbsenceRecord { id: string; startDate?: string; endDate?: string; affectedLessonsCount?: number; }
type TimelineItem = { lesson: Lesson; start: number; end: number };
type ActionState = 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'noDeadline' | 'invalid';

const time = (value: string) => value.includes('T') ? value.slice(11, 16) : value;
const timestamp = (value: string) => { const parsed = Date.parse(value); if (!Number.isNaN(parsed)) return parsed; const parts = value.split(':').map(Number); const date = new Date(); date.setHours(parts[0], parts[1], 0, 0); return date.getTime(); };
const dateLabel = (value?: string) => new Date(value ? `${value}T00:00:00` : Date.now()).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const lessonDate = (lesson: ScheduleLesson) => lesson.date || lesson.startDate?.slice(0, 10) || lesson.startTime.slice(0, 10);
const monthGridStart = (month: Date) => { const date = new Date(month.getFullYear(), month.getMonth(), 1, 12); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date; };
const monthGridEnd = (month: Date) => { const date = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12); date.setDate(date.getDate() + (7 - ((date.getDay() + 6) % 7) - 1)); return date; };
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
  const loadRequestId = useRef(0);
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [user, setUser] = useState<StudentUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth(), 1, 12); });
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [monthLessons, setMonthLessons] = useState<ScheduleLesson[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [weekAbsences, setWeekAbsences] = useState<AbsenceRecord[] | null>(null);
  const [absenceStatus, setAbsenceStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
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
    const requestId = ++loadRequestId.current;
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
      if (requestId !== loadRequestId.current) return;
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
      if (requestId !== loadRequestId.current) return;
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить учебный день.');
      setCacheRefreshing(false);
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadDay();
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      window.clearInterval(timer);
      loadRequestId.current += 1;
    };
  }, [loadDay]);

  useEffect(() => {
    let active = true;
    const start = monthGridStart(monthCursor);
    const end = monthGridEnd(monthCursor);
    const startDate = isoDate(start);
    const endDate = isoDate(end);
    setMonthLoading(true);
    setScheduleStatus('loading');
    setAbsenceStatus('loading');
    void Promise.all([
      apiFetchList<ScheduleLesson>(`/schedule/range?startDate=${startDate}&endDate=${endDate}`).catch(() => null),
      apiFetch<{ data: AbsenceRecord[]; meta: { total: number } }>('/absences/my?limit=100&page=1')
        .then(response => response.meta.total <= response.data.length ? response.data : null)
        .catch(() => null),
    ]).then(([lessons, absences]) => {
      if (!active) return;
      setMonthLessons(lessons || []);
      setWeekAbsences(absences);
      setScheduleStatus(lessons ? 'ready' : 'unavailable');
      setAbsenceStatus(absences ? 'ready' : 'unavailable');
    }).finally(() => { if (active) setMonthLoading(false); });
    return () => { active = false; };
  }, [monthCursor]);

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
  const pairSpaces = useMemo(() => new Map((day?.pairSpaces || []).map(space => [space.lessonId, space])), [day]);
  const preparations = (day?.upcomingPreparations || []).filter(preparation => preparation.progress !== 'done');
  const changes = timeline.filter(item => item.lesson.isChanged).map(item => ({ id: item.lesson.id, title: item.lesson.subject, description: item.lesson.changeDescription || 'Расписание этой пары изменилось.' }));
  const announcements = Array.from(pairSpaces.entries()).flatMap(([lessonId, space]) => (space.announcements || []).map(announcement => ({ ...announcement, lessonId }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);
  const importantNotifications = notifications.filter(notification => !notification.isRead || ['schedule_change', 'schedule_changed', 'deadline', 'new_homework'].includes(notification.type)).sort((a,b)=>(b.priority==='urgent'?2:b.priority==='high'?1:0)-(a.priority==='urgent'?2:a.priority==='high'?1:0)||Number(Boolean(a.isRead))-Number(Boolean(b.isRead))||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0, 3);
  const stale = Boolean(loadedAt && Date.now() - loadedAt > 300000);
  const progress = current ? Math.min(100, Math.max(0, ((now - current.start) / (current.end - current.start)) * 100)) : 0;
  const remaining = current ? Math.max(0, Math.ceil((current.end - now) / 60000)) : 0;
  const calendarDays = useMemo(() => {
    const start = monthGridStart(monthCursor);
    const lessonDates = new Set(monthLessons.map(lessonDate));
    const todayIso = isoDate(new Date());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index);
      return { date, iso: isoDate(date), inMonth: date.getMonth() === monthCursor.getMonth(), hasLessons: lessonDates.has(isoDate(date)), isToday: isoDate(date) === todayIso };
    });
  }, [monthCursor, monthLessons]);
  const selectedWeek = useMemo(() => {
    const start = new Date(`${selectedDate}T12:00:00`); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { start: isoDate(start), end: isoDate(end) };
  }, [selectedDate]);
  const weekLessons = monthLessons.filter(lesson => lessonDate(lesson) >= selectedWeek.start && lessonDate(lesson) <= selectedWeek.end);
  const weekAbsenceCount = weekAbsences?.filter(absence => {
    const start = absence.startDate?.slice(0, 10) || ''; const end = absence.endDate?.slice(0, 10) || start;
    return start <= selectedWeek.end && end >= selectedWeek.start;
  }).length;
  const weekStats = [
    { label: 'Лекции', count: scheduleStatus === 'ready' ? weekLessons.filter(lesson => /лекц|lecture/i.test(lesson.subjectType || '')).length : undefined, tone: 'blue' },
    { label: 'Практики', count: scheduleStatus === 'ready' ? weekLessons.filter(lesson => /практ|practice|семинар|seminar/i.test(lesson.subjectType || '')).length : undefined, tone: 'green' },
    { label: 'Лабораторные', count: scheduleStatus === 'ready' ? weekLessons.filter(lesson => /лаб|lab/i.test(lesson.subjectType || '')).length : undefined, tone: 'orange' },
    { label: 'Пропуски', count: absenceStatus === 'ready' ? weekAbsenceCount : undefined, tone: 'rose' },
  ];

  if (loading && !day) return <LoadingDay />;
  if (error && !day) return <div className="mx-auto max-w-3xl"><RequestState title="Учебный день недоступен" description={error} onRetry={() => void loadDay()} /></div>;
  if (!day || !user) return <EmptyState title="Учебный день пока не сформирован" description="Попробуйте обновить данные позже." action={<Button onClick={() => void loadDay()}>Обновить</Button>} />;

  return <div className="today-dashboard mx-auto max-w-[1320px]">
    <header className="today-heading"><div><p className="today-eyebrow">Студент</p><h1 className="ds-page-title">{user.firstName}, добрый день</h1><p className="today-date">{dateLabel(day.date)}</p>{offlineSavedAt && <p role="status" className="mt-2 text-xs font-medium text-[var(--color-warning)]">{cacheRefreshing ? 'Сохраненная копия · проверяем актуальность' : 'Офлайн · сохранено'} {new Date(offlineSavedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</p>}</div><div className="today-heading-actions">{stale && <Badge variant="warning">Данные могли устареть</Badge>}<Button variant="ghost" size="md" aria-label="Обновить данные" onClick={() => void loadDay()}><Icon name="refresh" size={16} /></Button></div></header>
    {error && <div className="today-error" role="status">Не удалось обновить данные. {offlineSavedAt ? 'Показана сохраненная копия.' : error} <button type="button" onClick={() => void loadDay()}>Повторить</button></div>}
    <div className="today-layout">
      <section className="today-hero" aria-label="Ближайшая пара">
        <Card className="today-next-card p-0"><div className="today-next-content"><div className="today-next-copy">
          {primary && <p className="today-next-label"><Icon name="calendar" size={17} />{current ? 'Сейчас' : 'Следующая пара'}</p>}
          {primary ? <><div className="today-next-title"><h2>{primary.lesson.subject}</h2><LessonTypeBadge subjectType={primary.lesson.subjectType} /></div>
            <div className="today-next-details"><span><Icon name="user" size={19} />{primary.lesson.teacherName || 'Преподаватель не указан'}</span><span><Icon name="building" size={19} />{getLessonLocation(primary.lesson.building, primary.lesson.room) || 'Аудитория не указана'}</span>{primary.lesson.subgroup?.trim() && <Badge variant="default">Подгруппа {primary.lesson.subgroup}</Badge>}</div>
            <div className="today-next-footer"><div className="today-next-time"><Icon name="calendar" size={21} /><strong>{time(primary.lesson.startTime)} – {time(primary.lesson.endTime)}</strong></div>{current && <div className="today-time-remaining"><Icon name="calendar" size={18} />Осталось {remaining} мин</div>}{!current && <span className="today-time-remaining">{primary.start > now ? `Начнётся через ${Math.ceil((primary.start - now) / 60000)} мин` : ''}</span>}</div>
            <Link href={'/pair-space/' + primary.lesson.id + (current ? '' : '?tab=homeworks')} className="today-open-lesson">Открыть занятие <Icon name="arrow-right" size={17} /></Link>
          </> : <div className="today-next-empty"><h2>{timeline.length ? 'На сегодня всё' : 'Свободный день'}</h2><Link href={tomorrowHref}>Открыть расписание на завтра <Icon name="arrow-right" size={16} /></Link></div>}
        </div><div className="today-hero-art" aria-hidden="true"><span /><span /><span /><i /></div></div></Card>
      </section>

      <aside className="today-rail" aria-label="Календарь и сводка">
        <section className="today-panel today-calendar"><div className="today-panel-heading"><h2>{monthCursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h2><div><button type="button" aria-label="Предыдущий месяц" onClick={() => { const month = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1, 12); setMonthCursor(month); setSelectedDate(isoDate(month)); }}>‹</button><button type="button" aria-label="Следующий месяц" onClick={() => { const month = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1, 12); setMonthCursor(month); setSelectedDate(isoDate(month)); }}>›</button></div></div>
          <div className="today-calendar-grid" aria-label="Календарь месяца"><div className="today-weekdays">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(name => <span key={name}>{name}</span>)}</div><div className="today-calendar-days">{calendarDays.map(item => <Link key={item.iso} href={`/week?view=day&date=${item.iso}`} aria-label={`${item.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${item.hasLessons ? ', есть занятия' : ''}`} aria-current={item.isToday ? 'date' : undefined} className={`today-calendar-day${item.inMonth ? '' : ' is-outside'}${item.isToday ? ' is-today' : ''}${item.hasLessons ? ' has-lessons' : ''}`} onClick={() => setSelectedDate(item.iso)}>{item.date.getDate()}{item.hasLessons && <i />}</Link>)}</div></div>{monthLoading && <span className="today-calendar-loading" role="status">Обновляем расписание…</span>}
        </section>

        <section className="today-panel today-quick-actions"><h2><Icon name="pulse" size={19} />Быстрые действия</h2><div className="today-action-grid"><Link href="/absences" className="today-action-tile tone-blue"><Icon name="clipboard" /><span>Сообщить<br />об отсутствии</span><Icon name="chevron-right" size={16} /></Link><Link href="/week" className="today-action-tile tone-violet"><Icon name="calendar" /><span>Открыть<br />расписание</span><Icon name="chevron-right" size={16} /></Link><Link href="/pair-space" className="today-action-tile tone-green"><Icon name="book" /><span>Подготовка<br />к занятиям</span><Icon name="chevron-right" size={16} /></Link><Link href="/pair-space" className="today-action-tile tone-orange"><Icon name="clipboard" /><span>Мои задания</span><Icon name="chevron-right" size={16} /></Link></div></section>

        <section className="today-panel today-week-stats"><div className="today-panel-heading"><h2><Icon name="chart" size={19} />Статистика недели</h2><Link href={`/week?view=week&date=${selectedDate}`}>Подробнее <Icon name="arrow-right" size={14} /></Link></div><div className="today-stat-grid">{weekStats.map(stat => <div key={stat.label} className={`today-stat tone-${stat.tone}`}><strong>{stat.count === undefined ? '—' : stat.count}</strong><span>{stat.label}</span></div>)}</div>{(scheduleStatus === 'unavailable' || absenceStatus === 'unavailable') && <p className="today-stat-note">{scheduleStatus === 'unavailable' ? 'Расписание недели недоступно. ' : ''}{absenceStatus === 'unavailable' ? 'Данные о пропусках недоступны.' : ''}</p>}</section>
      </aside>

      <section className="today-schedule" id="today-schedule" aria-label="Расписание дня"><div className="today-schedule-toolbar"><nav aria-label="Разделы дня" className="today-tabs"><a href="#today-schedule" aria-current="page">Расписание дня</a><Link href="/pair-space">Задания на сегодня</Link><Link href="/pair-space">Подготовка</Link><Link href="/career">Стажировки</Link></nav><div className="today-date-control"><Icon name="calendar" size={17} /><Link href={`/week?view=day&date=${isoDate(new Date())}`}>Сегодня</Link><Link href={`/week?view=day&date=${tomorrowHref.split('date=')[1]}`} aria-label="Следующий день">›</Link></div></div>
        <div className="today-section-title"><h2 className="ds-section-title">Расписание дня</h2><Link href="/week">Всё расписание <Icon name="arrow-right" size={15} /></Link></div>
        {conflicts.length > 0 && <div className="today-conflicts" role="status"><Icon name="info" size={18} /><span>Пары пересекаются по времени ({conflicts.length}).</span><Link href="/week">Проверить</Link></div>}
        {timeline.length ? <div className="today-lesson-list">{timeline.map((item, index) => { const lesson = item.lesson; const state = item.start <= now && now < item.end ? 'current' : item.end <= now ? 'done' : index === timeline.findIndex(nextItem => nextItem.start > now) ? 'next' : 'upcoming'; return <Link key={lesson.id} href={'/pair-space/' + lesson.id} className={`today-lesson-row state-${state}`}><span className="today-row-time">{time(lesson.startTime)}<small>{time(lesson.endTime)}</small></span><span className="today-row-divider" /><span className="today-row-type"><LessonTypeBadge subjectType={lesson.subjectType} /></span><span className="today-row-subject">{lesson.subject}{lesson.subgroup?.trim() && <small>Подгруппа {lesson.subgroup}</small>}</span><span className="today-row-meta">{lesson.teacherName || 'Преподаватель не указан'}<small>{getLessonLocation(lesson.building, lesson.room) || 'Аудитория не указана'}</small></span><Icon name="chevron-right" size={18} className="today-row-chevron" />{lesson.weekType && lesson.weekType !== 'both' && <span className="sr-only">{lesson.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}</span>}{lesson.isChanged && <Badge variant="warning">Изменено</Badge>}</Link>; })}</div> : <Card className="mt-3"><EmptyState title="Сегодня пар нет" description="Расписание на другие дни доступно в разделе «Расписание»." /></Card>}
      </section>

      {(preparations.length > 0 || changes.length > 0 || announcements.length > 0 || importantNotifications.length > 0) && <section className="today-important" id="today-preparation"><div className="today-section-title"><h2 className="ds-section-title">Что важно сегодня</h2><Link href="/notifications">Все уведомления <Icon name="arrow-right" size={15} /></Link></div><div className="today-important-grid">
        {preparations.slice(0, 3).map(preparation => { const state = actionState(preparation.deadline); return <article key={'preparation-' + preparation.id} className="today-important-item"><span className="today-important-icon"><Icon name="clipboard" size={17} /></span><Link href={'/pair-space/' + preparation.lessonId + '?tab=homeworks'} className="today-important-copy"><span>{preparation.title}</span><small>{preparation.subject} · {deadlineLabel(preparation.deadline)}</small><small className="today-important-link">Открыть занятие <Icon name="arrow-right" size={13} /></small></Link><Badge variant={state === 'overdue' ? 'danger' : state === 'upcoming' || state === 'noDeadline' || state === 'invalid' ? 'default' : 'warning'}>{actionLabel[state]}</Badge><PreparationProgressControl preparationId={preparation.id} initialState={preparation.progress} onSaved={progress => handlePreparationProgressSaved(preparation.id, progress)} /></article>; })}
        {changes.slice(0, 2).map(change => <Link key={'change-' + change.id} href={'/pair-space/' + change.id} className="today-important-item"><Icon name="refresh" size={18} /><span className="today-important-copy"><span>{change.title}</span><small>{change.description}</small><small className="today-important-link">Проверить расписание</small></span></Link>)}
        {announcements.map(announcement => <Link key={'announcement-' + announcement.id} href={'/pair-space/' + announcement.lessonId} className="today-important-item"><Icon name="bell" size={18} /><span className="today-important-copy"><span>Новое объявление</span><small>{announcement.text}</small></span></Link>)}
        {importantNotifications.map(notification => <Link key={'notification-' + notification.id} href={getInternalHref(notification.deepLink) || '/notifications'} className="today-important-item"><Icon name="info" size={18} /><span className="today-important-copy"><span>{notification.title}</span><small>{notification.body || 'Требует вашего внимания'}</small></span></Link>)}
      </div></section>}
    </div>
  </div>;
}
