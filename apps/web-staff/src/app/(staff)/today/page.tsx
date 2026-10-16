'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getNotifications, getUser } from '@/lib/api';
import { Badge, Button, Card, RequestState, Skeleton } from '@/components/ui';

interface Lesson { id: string; subject: string; groupName?: string; room?: string; startTime: string; endTime: string; isChanged?: boolean; changeDescription?: string }
interface MyDay { date: string; lessons: Lesson[]; pairSpaces?: Array<{ homeworks?: Array<{ id: string; deadline?: string }> }> }
type Notice = Awaited<ReturnType<typeof getNotifications>>[number];
const time = (value: string) => value.includes('T') ? value.slice(11, 16) : value.slice(0, 5);
const minutes = (value: string) => { const [hours, mins] = time(value).split(':').map(Number); return hours * 60 + mins; };
const reviewerRoles = new Set(['curator', 'faculty_dean', 'department_head', 'university_admin', 'superadmin']);

export default function TodayPage() {
  const [user, setUser] = useState<Awaited<ReturnType<typeof getUser>> | null>(null);
  const [day, setDay] = useState<MyDay | null>(null);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [attentionCount, setAttentionCount] = useState<number | null>(null);
  const [pendingAbsences, setPendingAbsences] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [profile, today, events, inbox] = await Promise.all([
        getUser(), apiFetch<MyDay>('/my-day?timeZone=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')),
        getNotifications().catch(() => null), apiFetch<Array<{ id: string }>>('/notifications/inbox?status=open&limit=100').catch(() => null),
      ]);
      setUser(profile); setDay(today); setNotices(events); setAttentionCount(inbox?.length ?? null);
      if (reviewerRoles.has(profile.role)) {
        const pending = await apiFetch<{ meta?: { total: number } }>('/absences/pending?limit=1').catch(() => null);
        setPendingAbsences(pending?.meta?.total ?? null);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить рабочий день.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, [load]);
  if (loading && !day) return <div aria-busy="true" className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-48" /></div>;
  if (!day || !user) return <RequestState title="Рабочий день недоступен" description={error || 'Повторите загрузку.'} onRetry={() => void load()} />;

  const lessons = [...day.lessons].sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const current = lessons.find(lesson => minutes(lesson.startTime) <= currentTime && currentTime < minutes(lesson.endTime));
  const next = current || lessons.find(lesson => minutes(lesson.startTime) > currentTime);
  const review = reviewerRoles.has(user.role);
  const activeHomework = (day.pairSpaces || []).reduce((count, space) => count + (space.homeworks || []).filter(item => !item.deadline || new Date(item.deadline) >= now).length, 0);
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="ds-page-title">{review ? user.role === 'curator' ? 'Группы и обращения' : user.role === 'faculty_dean' ? 'Рабочий день декана' : 'Рабочий день' : 'Добрый день, ' + user.firstName}</h1><p className="mt-2 text-sm capitalize text-slate-500">{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><Button variant="ghost" disabled={loading} onClick={() => void load()}>{loading ? 'Обновляем…' : 'Обновить'}</Button></header>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
    {review && <section className="grid gap-3 sm:grid-cols-2" aria-label="Работа с группами">
      <Link href="/absences" className="rounded-xl border border-sky-200 bg-white p-4"><span className="flex items-center justify-between gap-3 text-base font-semibold">Обращения об отсутствии<Badge variant={pendingAbsences ? 'warning' : 'default'}>{pendingAbsences ?? 'Нет данных'}</Badge></span><span className="mt-2 block text-sm text-sky-700">Рассмотреть обращения</span></Link>
      <Link href="/groups" className="flex min-h-20 items-center justify-between rounded-xl border bg-white p-4 text-base font-semibold">Мои группы<span className="text-sky-700" aria-hidden="true">→</span></Link>
    </section>}
    <nav aria-label="Рабочие действия" className="flex flex-wrap gap-2"><Link href="/week" className="role-link role-link-secondary">Расписание</Link>{!review && <Link href="/groups" className="role-link role-link-secondary">Группы</Link>}<Link href="/inbox" className="role-link role-link-secondary">Требуют внимания{attentionCount !== null && attentionCount > 0 ? ` · ${attentionCount}` : ''}</Link>{activeHomework > 0 && <Link href="/assignments" className="role-link role-link-secondary">Подготовка · {activeHomework}</Link>}</nav>
    {next ? <Card padding="sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><p className="text-sm font-medium text-sky-700">{current ? 'Сейчас' : 'Следующая пара'} · {time(next.startTime)}–{time(next.endTime)}</p><h2 className="mt-2 break-words text-xl font-semibold">{next.subject}</h2><p className="mt-2 text-sm text-slate-500">{next.groupName || 'Группа не указана'}{next.room ? ` · ауд. ${next.room}` : ''}</p>{next.isChanged && <p className="mt-2 text-sm text-amber-700">{next.changeDescription || 'Расписание изменилось'}</p>}</div><div className="flex flex-wrap gap-2"><Link href={`/attendance?lesson=${next.id}`} className="role-link role-link-primary">Посещаемость</Link><Link href={`/pair-space/${next.id}`} className="role-link role-link-secondary">Материалы пары</Link></div></div></Card> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><h2 className="text-base font-semibold">{lessons.length ? 'Занятия завершены' : 'Сегодня нет занятий'}</h2><Link href="/week" className="role-link role-link-ghost">Расписание недели</Link></div>}
    {lessons.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Расписание дня</h2><span className="text-sm text-slate-500">{lessons.length} занятий</span></div><div className="divide-y rounded-xl border bg-white">{lessons.map(lesson => <Link key={lesson.id} href={`/pair-space/${lesson.id}`} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 p-4 hover:bg-slate-50"><span className="text-sm font-semibold tabular-nums">{time(lesson.startTime)}<span className="mt-1 block text-xs font-normal text-slate-500">{time(lesson.endTime)}</span></span><span className="min-w-0"><span className="block break-words text-sm font-semibold">{lesson.subject}</span><span className="mt-1 block text-xs text-slate-500">{lesson.groupName}{lesson.room ? ` · ауд. ${lesson.room}` : ''}</span></span></Link>)}</div></section>}
    {notices === null ? <p role="status" className="text-sm text-slate-500">Уведомления не удалось обновить. <Link href="/notifications" className="font-semibold text-sky-700">Повторить</Link></p> : notices.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Последние события</h2><Link href="/notifications" className="text-sm font-semibold text-sky-700">Все события</Link></div><div className="divide-y rounded-xl border bg-white">{notices.slice(0, 3).map(item => <Link key={item.id} href="/notifications" className="block p-4 text-sm font-medium hover:bg-slate-50">{item.title || 'Новое уведомление'}</Link>)}</div></section>}
    <a href="/career" className="flex min-h-11 items-center justify-between border-t py-3 text-sm text-slate-500">Практика и работа<span aria-hidden="true">→</span></a>
  </div>;
}
