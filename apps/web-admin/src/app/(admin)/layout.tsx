'use client';

import Link from 'next/link';
import { useCurationContext } from '@napare/ui/curation';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceShell, type NavigationLinkProps, type WorkspaceCommand, type WorkspaceNavGroup } from '@napare/ui/workspace-shell';
import { apiFetch, getUser, logout, readUserCache, type Me } from '@/lib/api';

const groups: WorkspaceNavGroup[] = [
  { label: 'Обзор', items: [{ href: '/dashboard', label: 'Обзор', icon: 'dashboard', keywords: ['overview', 'сводка'] }, { href: '/analytics', label: 'Аналитика', icon: 'chart', keywords: ['метрики', 'статистика'] }] },
  { label: 'Университет', items: [{ href: '/users', label: 'Пользователи', mobileLabel: 'Люди', icon: 'users' }, { href: '/structure', label: 'Структура', icon: 'building', keywords: ['университет', 'факультеты', 'группы'] }, { href: '/faculties', label: 'Факультеты', icon: 'building' }, { href: '/groups', label: 'Группы', icon: 'users' }, { href: '/onboarding', label: 'Подключение вуза', icon: 'plug' }, { href: '/absences', label: 'Отсутствия', mobileLabel: 'Пропуски', icon: 'clipboard', keywords: ['пропуски', 'обращения'] }] },
  { label: 'Обращения', items: [{ href: '/requests', label: 'Обращения', icon: 'clipboard' }, { href: '/requests/reports', label: 'Отчёты по обращениям', icon: 'list' }] },
  { label: 'Расписание и данные', items: [{ href: '/schedule-import', label: 'Расписание', mobileLabel: 'Импорт', icon: 'calendar', keywords: ['расписание', 'импорт'] }, { href: '/connectors', label: 'Источники данных', icon: 'plug', keywords: ['коннекторы', 'интеграции'] }] },
  { label: 'Система', items: [{ href: '/notifications', label: 'Уведомления', icon: 'bell' }, { href: '/audit-log', label: 'Журнал аудита', icon: 'list', keywords: ['аудит', 'логи'] }] },
  { label: 'Настройки', items: [{ href: '/university', label: 'Настройки университета', icon: 'settings' }, { href: '/connections', label: 'Подключения аккаунта', icon: 'plug', keywords: ['max'] }] },
];
const roleLabels: Record<string, string> = {
  student: 'Студент',
  employer: 'Работодатель',
  career_staff: 'Сотрудник карьерного центра',
  career_admin: 'Администратор карьерного центра',
  teacher: 'Преподаватель',
  curator: 'Куратор',
  faculty_dean: 'Декан факультета',
  department_head: 'Заведующий кафедрой',
  university_admin: 'Администратор вуза',
  superadmin: 'Суперадминистратор',
  developer: 'Разработчик',
};
function getScopeLabel(user: Me | null): string {
  if (!user) return 'Область загружается';
  if (user.role === 'superadmin') return 'Весь проект';
  if (user.organizationId === undefined) return 'Область загружается';
  return user.organizationId === null || user.organizationId === '' ? 'Вуз не назначен' : 'Доступ в рамках вуза';
}
const AppLink = ({ href, children, ...props }: NavigationLinkProps) => href === '/connections'
  ? <a href={href} {...props}>{children}</a>
  : <Link href={href} {...props}>{children}</Link>;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Match SSR on the first client render; read the optional profile cache after hydration.
  const [user, setUser] = useState<Me | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const curation = useCurationContext(apiFetch, Boolean(profileReady && user?.role === 'university_admin'));
  const [systemStatus, setSystemStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const isPlatformAdmin = user?.role === 'superadmin';
  useEffect(() => {
    let active = true;
    const cachedProfile = readUserCache();
    if (cachedProfile) setUser(cachedProfile);
    getUser().then((profile) => {
      if (!active) return;
      if (profile.role === 'superadmin') {
        setUser(profile);
        setProfileReady(true);
        return;
      }
      if (profile.role !== 'university_admin') {
        router.replace('/login');
        return;
      }
      if (typeof profile.organizationId !== 'string' || profile.organizationId.trim() === '') {
        router.replace('/login');
        return;
      }
      setUser(profile);
      setProfileReady(true);
      apiFetch<number>('/notifications/unread-count').then((count) => {
        if (active) setNotificationCount(Number.isFinite(count) ? Math.max(0, count) : 0);
      }).catch(() => undefined);
      apiFetch<{ status: string }>('/health').then(({ status }) => {
        if (active) setSystemStatus(status === 'ok' ? 'online' : 'offline');
      }).catch(() => { if (active) setSystemStatus('offline'); });
    }).catch(() => { if (active) router.push('/login'); });
    return () => { active = false; };
  }, [router]);
  useEffect(() => {
    if (profileReady && isPlatformAdmin) window.location.replace('/developer/control');
  }, [isPlatformAdmin, profileReady]);
  const commands: WorkspaceCommand[] = [
    { id: 'admin:users', label: 'Открыть пользователей', description: 'Управление доступами и ролями', icon: 'users', href: '/users', keywords: ['студенты', 'преподаватели'] },
    { id: 'admin:analytics', label: 'Открыть аналитику', icon: 'chart', href: '/analytics', keywords: ['метрики', 'статистика'] },
    { id: 'admin:faculties', label: 'Открыть факультеты', icon: 'building', href: '/faculties' },
    { id: 'admin:groups', label: 'Открыть группы', icon: 'users', href: '/groups' },
    { id: 'admin:onboarding', label: 'Подключение вуза', icon: 'plug', href: '/onboarding' },
    { id: 'admin:requests', label: 'Открыть обращения', icon: 'clipboard', href: '/requests', keywords: ['отчёты'] },
    { id: 'admin:absences', label: 'Открыть обращения об отсутствии', icon: 'clipboard', href: '/absences', keywords: ['пропуски', 'отсутствия'] },
    { id: 'admin:import', label: 'Импортировать расписание', icon: 'upload', href: '/schedule-import', keywords: ['расписание'] },
    { id: 'admin:logs', label: 'Открыть журнал аудита', icon: 'list', href: '/audit-log', keywords: ['логи', 'аудит'] },
  ];
  // Keep university routes and tenant-scoped API calls blocked until /users/me confirms the role.
  const fullName = user ? user.firstName + ' ' + user.lastName : '';
  const currentRole = user?.role || user?.roles?.[0];
  const roleLabel = currentRole ? roleLabels[currentRole] || 'Пользователь кабинета' : 'Роль не указана';
  const scopeLabel = getScopeLabel(user);
  const curationItems: WorkspaceNavGroup['items'] = curation?.canCurate || curation?.canManage ? [{ href: '/curation', label: 'Кураторство', icon: 'users', keywords: ['куратор', 'назначения'] }] : [];
  const canShowUniversityWorkspace = profileReady && user?.role === 'university_admin';
  const resolvedGroups = canShowUniversityWorkspace ? groups.map((group) => ({ ...group, items: [...group.items, ...(group.label === 'Университет' ? curationItems : [])].map((item) => item.href === '/notifications' ? { ...item, badge: notificationCount } : item) })) : [];
  const visibleCommands = canShowUniversityWorkspace ? commands : [];
  const status = systemStatus === 'online' ? { label: 'Система работает', tone: 'success' as const } : systemStatus === 'offline' ? { label: 'Система недоступна', tone: 'danger' as const } : { label: 'Проверка системы', tone: 'warning' as const };
  return <WorkspaceShell LinkComponent={AppLink} pathname={pathname} groups={resolvedGroups} roleLabel={isPlatformAdmin ? 'Панель платформы' : 'Кабинет ВУЗа'} homeHref="/dashboard" user={user ? { name: fullName, role: `${roleLabel} · ${scopeLabel}`, id: user.id } : undefined} unreadCount={notificationCount} status={status} commands={visibleCommands} mobileHrefs={canShowUniversityWorkspace ? ['/dashboard', '/schedule-import', '/users', '/absences'] : []} onLogout={logout}><div className="role-content">{canShowUniversityWorkspace ? children : <p className="p-6 text-sm text-slate-600" role="status">{isPlatformAdmin ? 'Открываем панель платформы…' : 'Проверяем доступ…'}</p>}</div></WorkspaceShell>;
}
