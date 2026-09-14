'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Stats { totalUsers?: number; totalStudents?: number; totalTeachers?: number; totalLessons?: number; }
interface Group { id: string; name: string; }
interface Faculty { id: string; name: string; }
interface Lesson { id: string; startTime?: string; subject?: string; groupName?: string; }
interface Notice { id?: string; title?: string; body?: string; createdAt?: string; isRead?: boolean; }
interface Sync { status?: string; lastSync?: string | null; }
interface Connector { id: string; name: string; status?: string; }

const number = (value?: number) => value === undefined ? '—' : new Intl.NumberFormat('ru-RU').format(value);
const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
function dateKey(date: Date) { return date.toISOString().split('T')[0]; }
function monday() { const date = new Date(); const day = date.getDay(); date.setDate(date.getDate() - (day === 0 ? 6 : day - 1)); return date; }
function statusLabel(status?: string) { return status === 'active' || status === 'synced' ? 'Работает' : status === 'error' ? 'Ошибка' : 'Нет данных'; }

function StatusRow({ label, status, href }: { label: string; status: 'online' | 'offline' | 'unknown'; href: string }) {
  return <Link href={href} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0 hover:bg-slate-50"><span className="text-sm font-medium text-slate-700">{label}</span><span className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-emerald-500' : status === 'offline' ? 'bg-red-500' : 'bg-slate-300'}`} />{status === 'online' ? 'Работает' : status === 'offline' ? 'Ошибка' : 'Нет данных'}</span></Link>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [sync, setSync] = useState<Sync | null>(null);
  const [backend, setBackend] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const start = monday(); const end = new Date(start); end.setDate(end.getDate() + 5);
    Promise.all([
      apiFetch<Stats>('/admin/stats'), apiFetchList<Group>('/admin/groups'), apiFetchList<Faculty>('/admin/faculties'),
      apiFetchList<Lesson>(`/schedule/range?startDate=${dateKey(start)}&endDate=${dateKey(end)}`).catch(() => []),
      apiFetchList<Notice>('/notifications').catch(() => []), apiFetch<Sync>('/admin/schedule/sync-status').catch(() => null),
      apiFetch<{ status: string }>('/health').then(() => 'online' as const).catch(() => 'offline' as const),
    ]).then(([summary, groupItems, facultyItems, lessonItems, notificationItems, syncStatus, health]) => { setStats(summary); setGroups(groupItems); setFaculties(facultyItems); setLessons(lessonItems); setNotices(notificationItems); setSync(syncStatus); setBackend(health); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить dashboard.')).finally(() => setLoading(false));
  }, []);

  const metrics = [
    { label: 'Пользователи', value: number(stats?.totalUsers), href: '/users' }, { label: 'Студенты', value: number(stats?.totalStudents), href: '/users?role=student' }, { label: 'Преподаватели', value: number(stats?.totalTeachers), href: '/users?role=teacher' }, { label: 'Группы', value: number(groups.length || undefined), href: '/groups' }, { label: 'Факультеты', value: number(faculties.length || undefined), href: '/faculties' },
  ];
  const dailyLessonCounts = dayNames.map((_, index) => { const date = new Date(monday()); date.setDate(date.getDate() + index); return lessons.filter((lesson) => lesson.startTime?.startsWith(dateKey(date))).length; });
  const maxLessons = Math.max(...dailyLessonCounts, 1);
  const connectorStatus = 'unknown';
  const unread = notices.filter((notice) => notice.isRead === false).length;

  if (loading) return <div className="mx-auto max-w-[1500px] space-y-6"><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-[420px]" /></div>;
  if (error && !stats) return <div className="mx-auto max-w-[1500px]"><RequestState title="Не удалось загрузить dashboard" description={error} onRetry={() => window.location.reload()} /></div>;

  return <div className="mx-auto max-w-[1500px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><span>Admin</span><span>/</span><span className="text-slate-900">Dashboard</span></div><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">University Overview</h1><p className="mt-1 text-sm text-slate-500">Операционная сводка университета</p></div><span className="text-sm text-slate-500">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <Link key={metric.label} href={metric.href} className="group"><Card className="h-full border-l-2 border-l-slate-900 transition-shadow group-hover:shadow-md" padding="sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{metric.label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{metric.value}</p><p className="mt-2 text-xs font-medium text-slate-400 group-hover:text-slate-700">Открыть раздел →</p></Card></Link>)}</div><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6"><Card padding="sm"><div className="flex items-center justify-between border-b border-slate-200 pb-3"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">System status</h2><span className="text-xs text-slate-400">Live checks</span></div><div className="grid gap-x-8 md:grid-cols-2"><StatusRow label="Backend" status={backend} href="/dashboard" /><StatusRow label="Database" status="unknown" href="/university" /><StatusRow label="Schedule sync" status={sync?.status === 'error' ? 'offline' : sync ? 'online' : 'unknown'} href="/schedule-import" /><StatusRow label="Connectors" status={connectorStatus} href="/connectors" /></div></Card><div className="grid gap-6 lg:grid-cols-2"><Card padding="sm"><div className="flex items-center justify-between border-b border-slate-200 pb-3"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Activity chart</h2><span className="text-xs text-slate-400">Занятия по дням</span></div><div className="mt-5 flex h-40 items-end justify-between gap-3 px-2">{dailyLessonCounts.map((count, index) => <div key={dayNames[index]} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-semibold text-slate-500">{count}</span><div className="w-full rounded-t bg-slate-800 transition-all" style={{ height: `${Math.max((count / maxLessons) * 100, count ? 8 : 2)}%` }} /><span className="text-xs text-slate-400">{dayNames[index]}</span></div>)}</div></Card><Card padding="sm"><div className="flex items-center justify-between border-b border-slate-200 pb-3"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Schedule statistics</h2><span className="text-xs text-slate-400">Неделя</span></div><div className="mt-4 space-y-4"><div className="flex items-end justify-between"><span className="text-sm text-slate-500">Занятия</span><span className="text-2xl font-bold text-slate-950">{number(stats?.totalLessons ?? lessons.length)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-800" style={{ width: `${Math.min(100, lessons.length ? (lessons.length / 30) * 100 : 0)}%` }} /></div><div className="flex items-center justify-between text-xs text-slate-500"><span>Изменения sync</span><Badge variant={sync?.status === 'error' ? 'red' : sync ? 'green' : 'slate'}>{statusLabel(sync?.status)}</Badge></div></div></Card></div><Card padding="sm"><div className="flex items-center justify-between border-b border-slate-200 pb-3"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">User activity</h2><span className="text-xs text-slate-400">Уведомления</span></div>{notices.length ? <div className="mt-2 divide-y divide-slate-100">{notices.slice(0, 5).map((notice, index) => <div key={notice.id || index} className="flex items-center justify-between gap-3 py-3"><p className="truncate text-sm text-slate-700">{notice.title || 'Событие системы'}</p><span className="shrink-0 text-xs text-slate-400">{notice.isRead === false ? 'Новое' : 'Прочитано'}</span></div>)}</div> : <div className="py-5"><EmptyState title="Нет активности" description="События появятся после действий пользователей." /></div>}</Card></div><aside className="space-y-6"><Card padding="sm"><div className="flex items-center justify-between border-b border-slate-200 pb-3"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Recent Activity</h2><span className="text-xs text-slate-400">{notices.length}</span></div>{notices.length ? <div className="divide-y divide-slate-100">{notices.slice(0, 4).map((notice, index) => <Link href="/dashboard" key={notice.id || index} className="block py-3 hover:bg-slate-50"><p className="text-sm font-medium text-slate-800">{notice.title || 'Событие системы'}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{notice.body || 'Новое событие в системе'}</p></Link>)}</div> : <p className="py-5 text-sm text-slate-500">Активность пока отсутствует.</p>}<Link href="/notifications" className="mt-3 block text-sm font-semibold text-slate-700 hover:text-slate-950">Открыть журнал →</Link></Card><Card padding="sm"><h2 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase tracking-wider text-slate-700">Issues requiring attention</h2><div className="divide-y divide-slate-100">{[{ label: 'Непрочитанные уведомления', value: unread, href: '/notifications' }, { label: 'Статус sync', value: sync?.status === 'error' ? 'Ошибка' : sync ? 'OK' : '—', href: '/schedule-import' }, { label: 'Проблемы backend', value: backend === 'offline' ? 'Ошибка' : '—', href: '/dashboard' }].map((item) => <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"><span className="text-sm text-slate-600">{item.label}</span><span className="text-xs font-bold text-slate-700">{item.value}</span></Link>)}</div></Card></aside></div><section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Quick actions</h2><span className="text-xs text-slate-400">Common operations</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Добавить пользователя', href: '/users?create=1' }, { label: 'Создать группу', href: '/groups?create=1' }, { label: 'Импортировать расписание', href: '/schedule-import' }, { label: 'Добавить факультет', href: '/faculties?create=1' }].map((action) => <Link key={action.label} href={action.href}><Button variant="secondary" fullWidth>{action.label} <span aria-hidden="true">→</span></Button></Link>)}</div></section></div>;
}
