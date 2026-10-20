'use client';

import Link from 'next/link';
import { useCurationContext } from '@napare/ui/curation';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceShell, type NavigationLinkProps, type WorkspaceCommand, type WorkspaceNavGroup } from '@napare/ui/workspace-shell';
import { apiFetch, getUser, logout, type Me } from '@/lib/api';

const groups: WorkspaceNavGroup[] = [
  { label: 'Обзор', items: [{ href: '/dashboard', label: 'Обзор', icon: 'dashboard', keywords: ['overview', 'сводка'] }] },
  { label: 'Университет', items: [{ href: '/users', label: 'Пользователи', mobileLabel: 'Люди', icon: 'users' }, { href: '/structure', label: 'Структура', icon: 'building', keywords: ['университет', 'факультеты', 'группы'] }, { href: '/absences', label: 'Отсутствия', mobileLabel: 'Пропуски', icon: 'clipboard', keywords: ['пропуски', 'обращения'] }] },
  { label: 'Расписание и данные', items: [{ href: '/schedule-import', label: 'Расписание', mobileLabel: 'План', icon: 'calendar', keywords: ['расписание', 'импорт'] }, { href: '/connectors', label: 'Источники данных', icon: 'plug', keywords: ['коннекторы', 'интеграции'] }] },
  { label: 'Система', items: [{ href: '/notifications', label: 'Уведомления', icon: 'bell' }, { href: '/audit-log', label: 'Журнал аудита', icon: 'list', keywords: ['аудит', 'логи'] }] },
  { label: 'Настройки', items: [{ href: '/university', label: 'Настройки университета', icon: 'settings' }, { href: '/connections', label: 'Подключения аккаунта', icon: 'plug', keywords: ['max'] }] },
];
const AppLink = ({ href, children, ...props }: NavigationLinkProps) => href === '/connections'
  ? <a href={href} {...props}>{children}</a>
  : <Link href={href} {...props}>{children}</Link>;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const curation = useCurationContext(apiFetch, Boolean(user));
  const [systemStatus, setSystemStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    getUser().then(setUser).catch(() => router.push('/login'));
    apiFetch<number>('/notifications/unread-count').then((count) => setNotificationCount(Number.isFinite(count) ? Math.max(0, count) : 0)).catch(() => undefined);
    apiFetch<{ status: string }>('/health').then(({ status }) => setSystemStatus(status === 'ok' ? 'online' : 'offline')).catch(() => setSystemStatus('offline'));
  }, [router]);
  const commands: WorkspaceCommand[] = [
    { id: 'admin:users', label: 'Открыть пользователей', description: 'Управление доступами и ролями', icon: 'users', href: '/users', keywords: ['студенты', 'преподаватели'] },
    { id: 'admin:absences', label: 'Открыть обращения об отсутствии', icon: 'clipboard', href: '/absences', keywords: ['пропуски', 'отсутствия'] },
    { id: 'admin:import', label: 'Импортировать расписание', icon: 'upload', href: '/schedule-import', keywords: ['расписание'] },
    { id: 'admin:logs', label: 'Открыть журнал аудита', icon: 'list', href: '/audit-log', keywords: ['логи', 'аудит'] },
  ];
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-sm text-[var(--color-text-secondary)]">Загрузка панели…</div>;
  const fullName = user.firstName + ' ' + user.lastName;
  const curationItems: WorkspaceNavGroup['items'] = curation?.canCurate || curation?.canManage ? [{ href: '/curation', label: 'Кураторство', icon: 'users', keywords: ['куратор', 'назначения'] }] : [];
  const resolvedGroups = groups.map((group) => ({ ...group, items: [...group.items, ...(group.label === 'Университет' ? curationItems : [])].map((item) => item.href === '/notifications' ? { ...item, badge: notificationCount } : item) }));
  const status = systemStatus === 'online' ? { label: 'Система работает', tone: 'success' as const } : systemStatus === 'offline' ? { label: 'Система недоступна', tone: 'danger' as const } : { label: 'Проверка системы', tone: 'warning' as const };
  return <WorkspaceShell LinkComponent={AppLink} pathname={pathname} groups={resolvedGroups} roleLabel="Кабинет ВУЗа" homeHref="/dashboard" user={{ name: fullName, role: 'Сотрудник ВУЗа', id: user.id }} unreadCount={notificationCount} status={status} commands={commands} mobileHrefs={['/dashboard', '/schedule-import', '/users', '/absences']} onLogout={logout}><div className="role-content">{children}</div></WorkspaceShell>;
}
