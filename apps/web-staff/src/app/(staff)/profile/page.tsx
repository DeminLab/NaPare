'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pagination } from '@napare/ui';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { apiFetch, type PaginatedResponse, getNotifications, getUser, logout } from '@/lib/api';
import { Avatar, Badge, Button, Card, EmptyState, LoadingState, RequestState, Skeleton } from '@/components/ui';

interface User { id: string; email: string; firstName: string; lastName: string; role: string; universityId: string; isActive: boolean; }
interface Group { id: string; name: string; studentCount: number; }
interface Activity { id: string; title: string; body: string; createdAt: string; isRead: boolean; }
type ProfileTab = 'info' | 'groups' | 'activity' | 'security';
const groupPageSize = 25;

const tabs: Array<{ id: ProfileTab; label: string }> = [{ id: 'info', label: 'Информация' }, { id: 'groups', label: 'Группы' }, { id: 'activity', label: 'Активность' }, { id: 'security', label: 'Безопасность' }];

function shortDate(value: string) { return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [groupsPage, setGroupsPage] = useState(1);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [groupsError, setGroupsError] = useState('');
  const [activityError, setActivityError] = useState('');
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const groupsRequestSequence = useRef(0);
  const activityRequestSequence = useRef(0);
  useWorkspaceQuery({ tab: tab === 'info' ? '' : tab }, query => {
    const value = query.get('tab');
    setTab(value === 'groups' || value === 'activity' || value === 'security' ? value : 'info');
  });

  const loadGroups = useCallback(async (page: number) => {
    const requestId = ++groupsRequestSequence.current;
    setGroupsLoading(true);
    setGroupsError('');
    try {
      const response = await apiFetch<PaginatedResponse<Group>>(`/admin/attendance-groups?page=${page}&limit=${groupPageSize}`);
      if (requestId !== groupsRequestSequence.current) return;
      const lastPage = Math.max(1, Math.ceil(response.meta.total / groupPageSize));
      if (page > lastPage) {
        setGroupsPage(lastPage);
        return;
      }
      setGroups(response.data);
      setGroupsTotal(response.meta.total);
      setGroupsPage(response.meta.page);
    } catch (err) {
      if (requestId === groupsRequestSequence.current) setGroupsError(err instanceof Error ? err.message : 'Не удалось загрузить группы.');
    } finally {
      if (requestId === groupsRequestSequence.current) setGroupsLoading(false);
    }
  }, [groupsPage]);
  const loadActivity = useCallback(async () => {
    const requestId = ++activityRequestSequence.current;
    setActivityLoading(true);
    setActivityError('');
    try {
      const response = await getNotifications();
      if (requestId === activityRequestSequence.current) setActivity(response);
    } catch (err) {
      if (requestId === activityRequestSequence.current) setActivityError(err instanceof Error ? err.message : 'Не удалось загрузить события.');
    } finally {
      if (requestId === activityRequestSequence.current) setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    getUser().then(setUser).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль.')).finally(() => setLoading(false));
    void loadActivity();
    return () => { activityRequestSequence.current += 1; };
  }, [loadActivity]);
  useEffect(() => {
    void loadGroups(groupsPage);
    return () => { groupsRequestSequence.current += 1; };
  }, [groupsPage, loadGroups]);

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  const roleLabel = ({ teacher: "Преподаватель", curator: "Куратор", faculty_dean: "Декан", department_head: "Заведующий кафедрой" } as Record<string, string>)[user?.role || ""] || "Сотрудник";
  const hasAssignedGroupScope = user?.role === 'teacher' || user?.role === 'curator';
  const groupsTitle = hasAssignedGroupScope ? 'Мои группы' : 'Группы университета';
  const groupsLastPage = Math.max(1, Math.ceil(groupsTotal / groupPageSize));

  if (loading) return <LoadingState label="Загрузка профиля"><div className="mx-auto max-w-[1400px] space-y-6"><Skeleton className="h-52" /><Skeleton className="h-16" /><Skeleton className="h-96" /></div></LoadingState>;
  if (!user) return <div className="mx-auto max-w-[1400px]"><RequestState title="Не удалось загрузить профиль" description={error || 'Данные профиля недоступны.'} onRetry={() => window.location.reload()} /></div>;

  return <div className="mx-auto max-w-5xl space-y-5">
    <Card padding="sm"><div className="flex items-center gap-4"><Avatar name={fullName} size="lg" /><div className="min-w-0"><h1 className="break-words text-2xl font-bold">{fullName}</h1><div className="mt-2 flex flex-wrap gap-2"><Badge variant="sky">{roleLabel}</Badge><Badge variant={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Активен' : 'Неактивен'}</Badge></div></div></div></Card>
    <div role="group" aria-label="Разделы профиля" className="grid grid-cols-2 gap-1 border-b sm:flex">{tabs.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`min-h-11 border-b-2 px-3 py-2 text-sm font-medium ${tab === item.id ? 'border-indigo-700 text-indigo-700' : 'border-transparent text-slate-500'}`}>{item.label}</button>)}</div>
    {tab === 'info' && <Card padding="sm"><h2 className="text-base font-semibold">Данные аккаунта</h2><dl className="mt-3 divide-y"><div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-slate-500">Email</dt><dd className="break-all text-sm font-medium">{user.email}</dd></div></dl><Link href="/settings" className="role-link role-link-secondary mt-3">Настройки аккаунта</Link></Card>}
    {tab === 'groups' && <Card padding="sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">{groupsTitle}</h2>{!groupsLoading && !groupsError && <span className="text-sm text-slate-500">{groupsTotal}</span>}</div>{groupsLoading ? <LoadingState label="Загрузка групп"><Skeleton className="h-24" /></LoadingState> : groupsError ? <RequestState title="Не удалось загрузить группы" description={groupsError} onRetry={() => void loadGroups(groupsPage)} /> : groupsTotal ? <><div className="divide-y">{groups.map(group => <Link key={group.id} href={`/groups?q=${encodeURIComponent(group.name)}`} className="flex min-h-16 items-center justify-between gap-3 py-3"><span className="text-sm font-semibold">{group.name}</span>{group.studentCount !== undefined && <span className="text-sm text-slate-500">{group.studentCount} студентов</span>}</Link>)}</div>{groupsLastPage > 1 && <div className="mt-3 space-y-3"><p role="status" aria-live="polite" className="text-sm text-slate-600">Показано {(groupsPage - 1) * groupPageSize + 1}–{Math.min(groupsPage * groupPageSize, groupsTotal)} из {groupsTotal}</p><Pagination page={groupsPage} totalPages={groupsLastPage} onChange={setGroupsPage} /></div>}</> : <EmptyState title={hasAssignedGroupScope ? 'Группы пока не назначены' : 'В университете пока нет групп'} />}</Card>}
    {tab === 'activity' && <Card padding="sm"><h2 className="mb-3 text-base font-semibold">Последние события</h2>{activityLoading ? <LoadingState label="Загрузка последних событий"><Skeleton className="h-24" /></LoadingState> : activityError ? <RequestState title="Не удалось загрузить события" description={activityError} onRetry={() => void loadActivity()} /> : activity.length ? <div className="divide-y">{activity.map(item => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.title}</p>{item.body && <p className="mt-1 text-sm text-slate-500">{item.body}</p>}<p className="mt-2 text-xs text-slate-500">{shortDate(item.createdAt)}</p></div>)}</div> : <EmptyState title="Событий пока нет" />}</Card>}
    {tab === 'security' && <Card padding="sm"><h2 className="text-base font-semibold">Вход и доступ</h2><p className="mt-2 text-sm text-slate-500">Для смены пароля обратитесь к администратору университета.</p><div className="mt-4 flex flex-wrap gap-2"><a href="/connections" className="role-link role-link-secondary">Подключить MAX</a><Button variant="danger" onClick={logout}>Выйти из аккаунта</Button></div></Card>}
  </div>;
}
