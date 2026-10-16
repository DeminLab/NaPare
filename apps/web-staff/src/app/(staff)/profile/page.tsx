'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetchList, getNotifications, getUser, logout } from '@/lib/api';
import { Avatar, Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface User { id: string; email: string; firstName: string; lastName: string; role: string; universityId: string; isActive: boolean; }
interface Group { id: string; name: string; studentCount: number; }
interface Activity { id: string; title: string; body: string; createdAt: string; isRead: boolean; }
type ProfileTab = 'info' | 'groups' | 'activity' | 'security';

const tabs: Array<{ id: ProfileTab; label: string }> = [{ id: 'info', label: 'Информация' }, { id: 'groups', label: 'Группы' }, { id: 'activity', label: 'Активность' }, { id: 'security', label: 'Безопасность' }];

function shortDate(value: string) { return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<ProfileTab>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getUser(),
      apiFetchList<Group>('/admin/attendance-groups').catch(() => []),
      getNotifications().catch(() => []),
    ]).then(([profile, groupItems, notifications]) => { setUser(profile); setGroups(groupItems); setActivity(notifications); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль.')).finally(() => setLoading(false));
  }, []);

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  const roleLabel = ({ teacher: "Преподаватель", curator: "Куратор", faculty_dean: "Декан", department_head: "Заведующий кафедрой" } as Record<string, string>)[user?.role || ""] || "Сотрудник";

  if (loading) return <div className="mx-auto max-w-[1400px] space-y-6"><Skeleton className="h-52" /><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (!user) return <div className="mx-auto max-w-[1400px]"><RequestState title="Не удалось загрузить профиль" description={error || 'Данные профиля недоступны.'} onRetry={() => window.location.reload()} /></div>;

  return <div className="mx-auto max-w-5xl space-y-5">
    <Card padding="sm"><div className="flex items-center gap-4"><Avatar name={fullName} size="lg" /><div className="min-w-0"><h1 className="break-words text-2xl font-bold">{fullName}</h1><div className="mt-2 flex flex-wrap gap-2"><Badge variant="sky">{roleLabel}</Badge><Badge variant={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Активен' : 'Неактивен'}</Badge></div></div></div></Card>
    <div className="grid grid-cols-2 gap-1 border-b sm:flex" aria-label="Разделы профиля">{tabs.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`min-h-11 border-b-2 px-3 py-2 text-sm font-medium ${tab === item.id ? 'border-sky-700 text-sky-700' : 'border-transparent text-slate-500'}`}>{item.label}</button>)}</div>
    {tab === 'info' && <Card padding="sm"><h2 className="text-base font-semibold">Данные аккаунта</h2><dl className="mt-3 divide-y"><div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-slate-500">Email</dt><dd className="break-all text-sm font-medium">{user.email}</dd></div></dl><Link href="/settings" className="role-link role-link-secondary mt-3">Настройки аккаунта</Link></Card>}
    {tab === 'groups' && <Card padding="sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Мои группы</h2><span className="text-sm text-slate-500">{groups.length}</span></div>{groups.length ? <div className="divide-y">{groups.map(group => <Link key={group.id} href={`/groups?q=${encodeURIComponent(group.name)}`} className="flex min-h-16 items-center justify-between gap-3 py-3"><span className="text-sm font-semibold">{group.name}</span>{group.studentCount !== undefined && <span className="text-sm text-slate-500">{group.studentCount} студентов</span>}</Link>)}</div> : <EmptyState title="Группы пока не назначены" />}</Card>}
    {tab === 'activity' && <Card padding="sm"><h2 className="mb-3 text-base font-semibold">Последние события</h2>{activity.length ? <div className="divide-y">{activity.map(item => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.title}</p>{item.body && <p className="mt-1 text-sm text-slate-500">{item.body}</p>}<p className="mt-2 text-xs text-slate-500">{shortDate(item.createdAt)}</p></div>)}</div> : <EmptyState title="Событий пока нет" />}</Card>}
    {tab === 'security' && <Card padding="sm"><h2 className="text-base font-semibold">Вход и доступ</h2><p className="mt-2 text-sm text-slate-500">Для смены пароля обратитесь к администратору университета.</p><div className="mt-4 flex flex-wrap gap-2"><a href="/connections" className="role-link role-link-secondary">Подключить MAX</a><Button variant="danger" onClick={logout}>Выйти из аккаунта</Button></div></Card>}
  </div>;
}
