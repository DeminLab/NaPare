'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetchList, getNotifications, getUser, logout } from '@/lib/api';
import { Avatar, Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface User { id: string; email: string; firstName: string; lastName: string; role: string; universityId: string; isActive: boolean; }
interface Group { id: string; name: string; studentCount: number; }
interface Lesson { id: string; subject: string; groupName: string; startTime: string; }
interface Activity { id: string; title: string; body: string; createdAt: string; isRead: boolean; }
type ProfileTab = 'info' | 'groups' | 'activity' | 'security';

const tabs: Array<{ id: ProfileTab; label: string }> = [{ id: 'info', label: 'Информация' }, { id: 'groups', label: 'Группы' }, { id: 'activity', label: 'Активность' }, { id: 'security', label: 'Безопасность' }];

function startOfWeek() { const date = new Date(); const day = date.getDay(); date.setDate(date.getDate() - (day === 0 ? 6 : day - 1)); return date; }
function shortDate(value: string) { return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<ProfileTab>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const start = startOfWeek(); const end = new Date(start); end.setDate(end.getDate() + 5);
    Promise.all([
      getUser(),
      apiFetchList<Group>('/admin/groups').catch(() => []),
      apiFetchList<Lesson>(`/schedule/range?startDate=${start.toISOString().split('T')[0]}&endDate=${end.toISOString().split('T')[0]}`).catch(() => []),
      getNotifications().catch(() => []),
    ]).then(([profile, groupItems, lessonItems, notifications]) => { setUser(profile); setGroups(groupItems); setLessons(lessonItems); setActivity(notifications); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль.')).finally(() => setLoading(false));
  }, []);

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  const students = groups.reduce((sum, group) => sum + (group.studentCount || 0), 0);
  const uniqueGroups = new Set(lessons.map((lesson) => lesson.groupName).filter(Boolean));
  const stats = [{ label: 'Группы', value: groups.length || uniqueGroups.size || '—' }, { label: 'Студенты', value: students || '—' }, { label: 'Занятия', value: lessons.length || '—' }, { label: 'Посещаемость', value: '—' }];
  const assignedGroups = useMemo(() => groups.filter((group) => lessons.some((lesson) => lesson.groupName === group.name)), [groups, lessons]);

  if (loading) return <div className="mx-auto max-w-[1400px] space-y-6"><Skeleton className="h-52" /><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (!user) return <div className="mx-auto max-w-[1400px]"><RequestState title="Не удалось загрузить профиль" description={error || 'Данные профиля недоступны.'} onRetry={() => window.location.reload()} /></div>;

  return <div className="mx-auto max-w-[1400px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><Link href="/today" className="hover:text-sky-600">НаПаре</Link><span>/</span><span className="text-slate-900">Профиль</span></div><Card className="px-5 py-6 sm:px-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar name={fullName} size="lg" /><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{fullName}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="purple">Преподаватель</Badge><Badge variant={user.isActive ? 'green' : 'red'} dot>{user.isActive ? 'Активен' : 'Неактивен'}</Badge></div><p className="mt-2 text-sm text-slate-500">{user.email}</p></div></div><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Кафедра</p><p className="mt-1 text-sm font-medium text-slate-800">—</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Роль</p><p className="mt-1 text-sm font-medium text-slate-800">Преподаватель</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Университет</p><p className="mt-1 break-all text-sm font-medium text-slate-800">{user.universityId || '—'}</p></div></div></Card><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map((stat) => <Card key={stat.label} padding="sm"><p className="text-2xl font-bold text-slate-900">{stat.value}</p><p className="mt-1 text-sm font-medium text-slate-600">{stat.label}</p></Card>)}</div><div className="flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${tab === item.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'}`}>{item.label}</button>)}</div>{tab === 'info' && <div className="grid gap-6 lg:grid-cols-2"><Card padding="sm"><h2 className="mb-3 text-base font-bold text-slate-900">Личная информация</h2><div className="divide-y divide-slate-100"><div className="flex justify-between gap-4 py-3"><span className="text-sm text-slate-500">ФИО</span><span className="text-right text-sm font-medium text-slate-900">{fullName}</span></div><div className="flex justify-between gap-4 py-3"><span className="text-sm text-slate-500">Email</span><span className="break-all text-right text-sm font-medium text-slate-900">{user.email}</span></div><div className="flex justify-between gap-4 py-3"><span className="text-sm text-slate-500">ID</span><span className="break-all text-right text-sm font-medium text-slate-900">{user.id}</span></div></div></Card><Card padding="sm"><h2 className="mb-3 text-base font-bold text-slate-900">Рабочая информация</h2><p className="text-sm leading-6 text-slate-500">Кафедра и агрегированная посещаемость пока не передаются профилю через API.</p><Link href="/settings" className="mt-4 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800">Открыть настройки →</Link></Card></div>}{tab === 'groups' && <Card padding="sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Мои группы</h2><span className="text-sm text-slate-500">{assignedGroups.length || groups.length}</span></div>{(assignedGroups.length ? assignedGroups : groups).length ? <div className="divide-y divide-slate-100">{(assignedGroups.length ? assignedGroups : groups).map((group) => <div key={group.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-900">{group.name}</p><p className="mt-1 text-xs text-slate-500">{group.studentCount} студентов</p></div><Link href={`/attendance?group=${group.id}`} className="text-xs font-semibold text-sky-700 hover:text-sky-800">Открыть →</Link></div>)}</div> : <EmptyState title="Группы не назначены" description="Группы появятся после синхронизации с университетом." />}</Card>}{tab === 'activity' && <Card padding="sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Последняя активность</h2><span className="text-sm text-slate-500">{activity.length}</span></div>{activity.length ? <div className="divide-y divide-slate-100">{activity.map((item) => <div key={item.id} className="py-4 first:pt-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{item.title}</p>{!item.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-sky-500" />}</div><p className="mt-1 text-sm text-slate-500">{item.body}</p><p className="mt-2 text-xs text-slate-400">{shortDate(item.createdAt)}</p></div>)}</div> : <EmptyState title="Активность пока не зафиксирована" description="Уведомления и события появятся здесь." />}</Card>}{tab === 'security' && <Card padding="sm"><h2 className="text-base font-bold text-slate-900">Безопасность</h2><p className="mt-2 text-sm leading-6 text-slate-500">Управляйте настройками аккаунта и входа в разделе настроек.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/settings"><Button>Открыть настройки</Button></Link><Button variant="danger" onClick={logout}>Выйти из аккаунта</Button></div></Card>}</div>;
}
