'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, apiFetchList, getUser, StudentUser } from '@/lib/api';
import { EmptyState, Icon, IconName, Skeleton } from '@/components/ui';

interface Lesson {
  id: string;
  subject: string;
  subjectType?: string;
  teacherName?: string;
  room?: string;
  startTime: string;
  endTime: string;
  isChanged: boolean;
  changeDescription?: string;
}

interface Homework { id: string; title: string; deadline?: string; isCompleted?: boolean; }
interface PairSpace { lessonId: string; homeworks?: Homework[]; }
interface DayNotification { id: string; title: string; body: string; type: string; createdAt: string; }
interface MyDayResponse { lessons: Lesson[]; pairSpaces: PairSpace[]; }
interface TomorrowLesson { id: string; subject: string; teacherName?: string; room?: string; startTime: string; endTime: string; subjectType?: string; isChanged: boolean; }
interface TimelineItem { lesson: Lesson; start: number; end: number; }
type LessonState = 'completed' | 'current' | 'next' | 'upcoming';

const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };

function time(value: string): string { return value.includes('T') ? value.slice(11, 16) : value; }
function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? date.getTime() : Number.NaN;
}
function remainingMinutes(target: number, now: number): number { return Math.max(0, Math.ceil((target - now) / 60000)); }
function deadlineLabel(deadline?: string): string {
  if (!deadline) return 'Без срока';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return 'Срок не указан';
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const formatTime = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Сегодня, ${formatTime}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Завтра, ${formatTime}`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
function changeState(description?: string): 'cancelled' | 'rescheduled' | 'changed' {
  const normalized = description?.toLowerCase() || '';
  if (normalized.includes('отмен')) return 'cancelled';
  if (normalized.includes('перенес') || normalized.includes('время')) return 'rescheduled';
  return 'changed';
}
function changeMeta(description?: string): { label: string; className: string; icon: IconName } {
  const state = changeState(description);
  if (state === 'cancelled') return { label: 'Отменено', className: 'bg-rose-50 text-rose-700', icon: 'XCircle' };
  if (state === 'rescheduled') return { label: 'Перенесено', className: 'bg-amber-50 text-amber-700', icon: 'Clock' };
  return { label: 'Изменено', className: 'bg-indigo-50 text-indigo-700', icon: 'CalendarDays' };
}

function LoadingDay() {
  return <div className="mx-auto max-w-[1240px] space-y-6"><div><Skeleton className="h-7 w-52" /><Skeleton className="mt-2 h-4 w-72" /></div><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-6"><section className="student-panel p-6"><Skeleton className="h-5 w-32" /><Skeleton className="mt-8 h-9 w-72" /><Skeleton className="mt-5 h-5 w-48" /><Skeleton className="mt-8 h-3 w-full" /></section><section className="student-panel p-6"><Skeleton className="h-6 w-48" /><Skeleton className="mt-6 h-72" /></section></div><div className="space-y-6"><section className="student-panel p-6"><Skeleton className="h-6 w-32" /><Skeleton className="mt-6 h-48" /></section><section className="student-panel p-6"><Skeleton className="h-6 w-28" /><Skeleton className="mt-6 h-40" /></section></div></div></div>;
}

export default function TodayPage() {
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [user, setUser] = useState<StudentUser | null>(null);
  const [notifications, setNotifications] = useState<DayNotification[]>([]);
  const [tomorrow, setTomorrow] = useState<TomorrowLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadDay = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowIso = tomorrowDate.toISOString().split('T')[0];
      const [myDay, currentUser, allNotifications, tomorrowLessons] = await Promise.all([
        apiFetch<MyDayResponse>('/my-day'), getUser(), apiFetchList<DayNotification>('/notifications').catch(() => []), apiFetchList<TomorrowLesson>(`/schedule/range?startDate=${tomorrowIso}&endDate=${tomorrowIso}`).catch(() => []),
      ]);
      setDay(myDay); setUser(currentUser); setNotifications(allNotifications); setTomorrow(tomorrowLessons);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить учебный день.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDay(); }, [loadDay]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const date = new Date();
  const dateLabel = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeline = useMemo<TimelineItem[]>(() => (day?.lessons || []).map(lesson => ({ lesson, start: timestamp(lesson.startTime), end: timestamp(lesson.endTime) })).sort((a, b) => a.start - b.start), [day]);
  const current = timeline.find(item => item.start <= now && now < item.end);
  const next = timeline.find(item => item.start > now);
  const primary = current || next;
  const pairSpacesByLesson = useMemo(() => new Map((day?.pairSpaces || []).map(pairSpace => [pairSpace.lessonId, pairSpace])), [day]);
  const tasks = useMemo(() => Array.from(pairSpacesByLesson.entries()).flatMap(([lessonId, pairSpace]) => (pairSpace.homeworks || []).filter(task => !task.isCompleted).map(task => ({ ...task, lessonId }))).sort((a, b) => (a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER) - (b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER)).slice(0, 4), [pairSpacesByLesson]);
  const lessonChanges = timeline.filter(item => item.lesson.isChanged).map(item => ({ id: item.lesson.id, title: item.lesson.subject, description: item.lesson.changeDescription || 'Расписание пары изменилось.' }));
  const notificationChanges = notifications.filter(notification => notification.type === 'schedule_change').map(notification => ({ id: notification.id, title: notification.title, description: notification.body }));
  const changes = [...lessonChanges, ...notificationChanges].slice(0, 4);
  const stateFor = (item: TimelineItem): LessonState => current?.lesson.id === item.lesson.id ? 'current' : next?.lesson.id === item.lesson.id ? 'next' : item.end <= now ? 'completed' : 'upcoming';
  const timeProgress = current && current.end > current.start ? Math.min(100, Math.max(0, ((now - current.start) / (current.end - current.start)) * 100)) : 0;
  const pairSpaceHref = primary ? `/pair-space/${primary.lesson.id}` : '/week';

  if (loading) return <LoadingDay />;
  if (error) return <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center"><EmptyState icon={<Icon name="CalendarDays" className="h-8 w-8" />} title="Не удалось открыть учебный день" description={error} action={<button onClick={() => void loadDay()} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">Повторить</button>} /></div>;

  return <div className="mx-auto max-w-[1240px] space-y-6">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium text-slate-400">НаПаре / Сегодня</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Добрый день{user?.firstName ? `, ${user.firstName}` : ''} 👋</h2><p className="mt-2 text-sm capitalize text-slate-500">{dateLabel}</p></div><Link href="/week" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:text-indigo-700">Открыть расписание →</Link></section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[String(timeline.length),'пар'],[String(tasks.length),'задания'],[String(changes.length),'изменения'],[String(notifications.filter(n => !(n as any).isRead).length),'уведомления']].map(([value,label]) => <div key={label} className="student-panel px-4 py-4"><p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs font-medium text-slate-500">{label}</p></div>)}</section>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-6">
      {primary ? <section className={`student-panel overflow-hidden p-5 sm:p-7 ${current ? 'border-emerald-200' : 'border-indigo-200'}`}><div className="flex items-start justify-between gap-4"><div><p className={`text-sm font-semibold ${current ? 'text-emerald-700' : 'text-indigo-700'}`}>{current ? 'Сейчас' : 'Следующая пара'}</p><h3 className="mt-5 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">{primary.lesson.subject}</h3><p className="mt-3 text-lg font-semibold text-slate-800">{time(primary.lesson.startTime)} — {time(primary.lesson.endTime)}</p></div><span className={`hidden shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex ${current ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>{current ? `Осталось ${remainingMinutes(current.end, now)} минут` : `Через ${remainingMinutes(primary.start, now)} минут`}</span></div><div className="mt-7 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2"><p className="flex items-center gap-2 text-sm text-slate-600"><Icon name="User" className="h-4 w-4 text-slate-400" />{primary.lesson.teacherName || 'Преподаватель не указан'}</p><p className="flex items-center gap-2 text-sm text-slate-600"><Icon name="MapPin" className="h-4 w-4 text-slate-400" />{primary.lesson.room ? `Аудитория ${primary.lesson.room}` : 'Аудитория не указана'}</p></div>{current && <><div className="mt-5 h-2 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${timeProgress}%` }} /></div><p className="mt-2 text-xs font-medium text-slate-500">Осталось {remainingMinutes(current.end, now)} минут</p></>}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href={`/pair-space/${primary.lesson.id}`} className="rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700">Открыть пространство пары</Link><Link href="/week" className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">Открыть расписание</Link></div></section> : <section className="student-panel"><EmptyState icon={<Icon name="CalendarDays" className="h-8 w-8" />} title="На сегодня пар нет" description="Свободный день — можно спокойно заняться своими делами." action={<Link href="/week" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">Открыть расписание</Link>} /></section>}
      <section className="student-panel overflow-hidden"><div className="flex items-center justify-between px-5 py-5 sm:px-7"><div><h3 className="text-lg font-bold tracking-[-0.02em] text-slate-950">Сегодня</h3><p className="mt-1 text-sm text-slate-500">Твой учебный маршрут</p></div><Link href="/week" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Всё расписание <Icon name="ChevronRight" className="h-4 w-4" /></Link></div>{timeline.length === 0 ? <EmptyState title="В расписании ничего нет" description="Когда появятся пары, они будут здесь." /> : <div className="border-t border-slate-100 px-5 sm:px-7">{timeline.map((item, index) => { const state = stateFor(item); const meta = item.lesson.isChanged ? changeMeta(item.lesson.changeDescription) : null; return <Link key={item.lesson.id} href={`/pair-space/${item.lesson.id}`} className="group grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 border-b border-slate-100 py-5 last:border-0 sm:grid-cols-[104px_32px_minmax(0,1fr)_auto] sm:gap-4"><div className={`hidden pt-0.5 font-mono text-sm font-semibold sm:block ${state === 'completed' ? 'text-slate-400' : state === 'current' ? 'text-indigo-600' : 'text-slate-700'}`}>{time(item.lesson.startTime)}<span className="mx-1 text-slate-300">—</span>{time(item.lesson.endTime)}</div><div className="relative flex justify-center"><span className={`relative z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${state === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white' : state === 'current' ? 'border-indigo-600 bg-white ring-4 ring-indigo-100' : 'border-slate-300 bg-white'}`}>{state === 'completed' && <span className="text-[11px]">✓</span>}</span>{index < timeline.length - 1 && <span className="absolute top-7 h-[calc(100%+8px)] w-px bg-slate-200" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className={`truncate font-semibold ${state === 'completed' ? 'text-slate-500' : 'text-slate-900'}`}>{item.lesson.subject}</h4>{state === 'current' && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">Сейчас</span>}{state === 'next' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Далее</span>}</div><p className="mt-1 text-sm text-slate-500">{item.lesson.teacherName || 'Преподаватель не указан'}{item.lesson.room ? ` · ауд. ${item.lesson.room}` : ''}{item.lesson.subjectType ? ` · ${typeLabels[item.lesson.subjectType] || item.lesson.subjectType}` : ''}</p>{meta && <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}{item.lesson.changeDescription ? ` · ${item.lesson.changeDescription}` : ''}</span>}</div><Icon name="ChevronRight" className="mt-1 h-4 w-4 self-center text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-600" /></Link>; })}</div>}</section>
    </div><aside className="space-y-6">
      <section className="student-panel p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Важно</p><h3 className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-950">Изменения расписания</h3></div><Link href="/notifications" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Все <Icon name="ChevronRight" className="h-4 w-4" /></Link></div>{changes.length === 0 ? <div className="py-7 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">✓</div><p className="mt-3 text-sm font-semibold text-slate-800">Всё актуально</p><p className="mt-1 text-sm text-slate-500">Изменений в расписании нет.</p></div> : <div className="mt-4 divide-y divide-slate-100">{changes.map(change => { const meta = changeMeta(change.description); return <div key={change.id} className="flex gap-3 py-4 first:pt-1"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.className}`}><Icon name={meta.icon} className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{change.title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{change.description}</p></div></div>; })}</div>}</section>
      <section className="student-panel p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Дедлайны</p><h3 className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-950">Домашние задания</h3></div><Link href={pairSpaceHref} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Все <Icon name="ChevronRight" className="h-4 w-4" /></Link></div>{tasks.length === 0 ? <div className="py-7 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon name="BookOpen" className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-slate-800">Ближайших заданий нет</p><p className="mt-1 text-sm text-slate-500">Новые задания появятся из пространства пары.</p></div> : <div className="mt-4 divide-y divide-slate-100">{tasks.map(task => <Link key={task.id} href={`/pair-space/${task.lessonId}`} className="group flex items-start gap-3 py-4 first:pt-1"><span className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 transition-colors group-hover:border-indigo-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{task.title}</span><span className={`mt-1 block text-xs font-medium ${task.deadline && new Date(task.deadline).toDateString() === new Date().toDateString() ? 'text-rose-600' : 'text-slate-500'}`}>{deadlineLabel(task.deadline)}</span></span></Link>)}</div>}</section>
    </aside></div>
    <section className="student-panel p-4 sm:p-5"><h3 className="px-1 text-lg font-bold tracking-[-0.02em] text-slate-950">Быстрые действия</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Link href="/week" className="student-action group flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="CalendarRange" className="h-5 w-5" /></span><span className="flex-1 text-sm font-semibold text-slate-800">Расписание</span><Icon name="ChevronRight" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" /></Link><Link href={pairSpaceHref} className="student-action group flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="MessageCircle" className="h-5 w-5" /></span><span className="flex-1 text-sm font-semibold text-slate-800">PairSpace</span><Icon name="ChevronRight" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" /></Link><Link href={pairSpaceHref} className="student-action group flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="BookOpen" className="h-5 w-5" /></span><span className="flex-1 text-sm font-semibold text-slate-800">Задания</span><Icon name="ChevronRight" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" /></Link><Link href="/absences" className="student-action group flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="ClipboardCheck" className="h-5 w-5" /></span><span className="flex-1 text-sm font-semibold text-slate-800">Пропуски</span><Icon name="ChevronRight" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" /></Link></div></section>
    <section className="student-panel overflow-hidden p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Завтра</p><h3 className="mt-1 text-lg font-bold text-slate-950">Preview следующего дня</h3></div><Link href="/week" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Открыть неделю →</Link></div>{tomorrow.length === 0 ? <p className="mt-5 text-sm text-slate-500">На завтра занятий нет или расписание ещё не загружено.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tomorrow.slice(0, 4).map(lesson => <Link key={lesson.id} href={`/pair-space/${lesson.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50"><p className="text-xs font-semibold text-indigo-600">{time(lesson.startTime)} — {time(lesson.endTime)}</p><p className="mt-2 truncate text-sm font-semibold text-slate-800">{lesson.subject}</p><p className="mt-1 truncate text-xs text-slate-500">{lesson.room ? `Ауд. ${lesson.room}` : 'Аудитория не указана'}</p></Link>)}</div>}</section>
  </div>;
}
