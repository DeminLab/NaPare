'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pagination } from '@napare/ui';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { apiFetch, type PaginatedResponse, getNotifications, getUser, logout } from '@/lib/api';
import { Badge, Button, Card, EmptyState, LoadingState, RequestState, Skeleton } from '@/components/ui';

interface User { id: string; email: string; firstName: string; lastName: string; role: string; organizationId: string; isActive: boolean; }
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
    <header className="mb-1">
      <p className="text-sm font-semibold text-[var(--role-accent)]">Аккаунт преподавателя</p>
      <p className="mt-1 text-sm text-slate-600">Ваши данные, рабочая область и безопасность аккаунта.</p>
    </header>
    <Card padding="sm" className="overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0B1738] to-[#1559EF] text-lg font-bold text-white shadow-sm sm:h-20 sm:w-20 sm:text-xl">
            {fullName.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{fullName}</h1>
            <div className="mt-2 flex flex-wrap gap-2"><Badge variant="sky">{roleLabel}</Badge><Badge variant={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Активен' : 'Неактивен'}</Badge></div>
          </div>
        </div>
        <Link href="/settings" className="role-link role-link-secondary w-full sm:w-auto">Настройки аккаунта</Link>
      </div>
    </Card>
    <div role="group" aria-label="Разделы профиля" className="grid grid-cols-2 gap-1 border-b border-slate-200 sm:flex sm:gap-2">
      {tabs.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`min-h-11 border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--role-accent)] ${tab === item.id ? 'border-[var(--role-accent)] text-[var(--role-accent)]' : 'border-transparent text-slate-600 hover:text-slate-950'}`}>{item.label}</button>)}
    </div>
    {tab === 'info' && <Card padding="sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Профиль</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Данные аккаунта</h2></div><Badge variant={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Доступ активен' : 'Доступ приостановлен'}</Badge></div><dl className="mt-4 divide-y divide-slate-100 border-y border-slate-100"><div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><dt className="text-sm text-slate-600">Электронная почта</dt><dd className="break-all text-sm font-semibold text-slate-900">{user.email}</dd></div><div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><dt className="text-sm text-slate-600">Роль</dt><dd className="text-sm font-semibold text-slate-900">{roleLabel}</dd></div></dl></Card>}
    {tab === 'groups' && <Card padding="sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">{groupsTitle}</h2>{!groupsLoading && !groupsError && <span className="text-sm text-slate-500">{groupsTotal}</span>}</div>{groupsLoading ? <LoadingState label="Загрузка групп"><Skeleton className="h-24" /></LoadingState> : groupsError ? <RequestState title="Не удалось загрузить группы" description={groupsError} onRetry={() => void loadGroups(groupsPage)} /> : groupsTotal ? <><div className="divide-y">{groups.map(group => <Link key={group.id} href={`/groups?q=${encodeURIComponent(group.name)}`} className="flex min-h-16 items-center justify-between gap-3 py-3"><span className="text-sm font-semibold">{group.name}</span>{group.studentCount !== undefined && <span className="text-sm text-slate-500">{group.studentCount} студентов</span>}</Link>)}</div>{groupsLastPage > 1 && <div className="mt-3 space-y-3"><p role="status" aria-live="polite" className="text-sm text-slate-600">Показано {(groupsPage - 1) * groupPageSize + 1}–{Math.min(groupsPage * groupPageSize, groupsTotal)} из {groupsTotal}</p><Pagination page={groupsPage} totalPages={groupsLastPage} onChange={setGroupsPage} /></div>}</> : <EmptyState title={hasAssignedGroupScope ? 'Группы пока не назначены' : 'В университете пока нет групп'} />}</Card>}
    {tab === 'activity' && <Card padding="sm"><h2 className="mb-3 text-base font-semibold">Последние события</h2>{activityLoading ? <LoadingState label="Загрузка последних событий"><Skeleton className="h-24" /></LoadingState> : activityError ? <RequestState title="Не удалось загрузить события" description={activityError} onRetry={() => void loadActivity()} /> : activity.length ? <div className="divide-y">{activity.map(item => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.title}</p>{item.body && <p className="mt-1 text-sm text-slate-500">{item.body}</p>}<p className="mt-2 text-xs text-slate-500">{shortDate(item.createdAt)}</p></div>)}</div> : <EmptyState title="Событий пока нет" />}</Card>}
    {tab === 'security' && <Card padding="sm"><h2 className="text-base font-semibold">Вход и доступ</h2><p className="mt-2 text-sm text-slate-500">Для смены пароля обратитесь к администратору университета.</p><div className="mt-4 flex flex-wrap gap-2"><a href="/connections" className="role-link role-link-secondary">Подключить MAX</a><Button variant="danger" onClick={logout}>Выйти из аккаунта</Button></div></Card>}
  </div>;
}
