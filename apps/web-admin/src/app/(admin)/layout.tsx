'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceShell, type NavigationLinkProps, type WorkspaceCommand, type WorkspaceNavGroup } from '@napare/ui/workspace-shell';
import { apiFetch, apiFetchList, getUser, logout, type Me } from '@/lib/api';

const groups: WorkspaceNavGroup[] = [
  { label: 'Overview', items: [{ href: '/dashboard', label: 'Overview', icon: 'dashboard', keywords: ['overview', 'сводка'] }] },
  { label: 'Университет', items: [{ href: '/users', label: 'Пользователи', icon: 'users' }, { href: '/structure', label: 'Структура', icon: 'building', keywords: ['университет', 'факультеты', 'группы'] }] },
  { label: 'Операции', items: [{ href: '/schedule-import', label: 'Расписание и импорт', icon: 'calendar', keywords: ['расписание', 'импорт', 'pipeline'] }, { href: '/connectors', label: 'Коннекторы', icon: 'plug' }, { href: '/dashboard?view=analytics', label: 'Аналитика', icon: 'chart' }] },
  { label: 'Система', items: [{ href: '/notifications', label: 'Уведомления', icon: 'bell' }, { href: '/audit-log', label: 'Audit Log', icon: 'list' }] },
  { label: 'Настройки', items: [{ href: '/university', label: 'Настройки университета', icon: 'settings' }] },
];
const AppLink = ({ href, children, ...props }: NavigationLinkProps) => <Link href={href} {...props}>{children}</Link>;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    getUser().then(setUser).catch(() => router.push('/login'));
    apiFetchList<{ isRead: boolean }>('/notifications').then((items) => setNotificationCount(items.filter((item) => !item.isRead).length)).catch(() => undefined);
    apiFetch<{ status: string }>('/health').then(() => setSystemStatus('online')).catch(() => setSystemStatus('offline'));
  }, [router]);
  const commands: WorkspaceCommand[] = [
    { id: 'admin:users', label: 'Открыть пользователей', description: 'Управление доступами и ролями', icon: 'users', href: '/users', keywords: ['студенты', 'преподаватели'] },
    { id: 'admin:import', label: 'Импортировать расписание', icon: 'upload', href: '/schedule-import', keywords: ['расписание'] },
    { id: 'admin:logs', label: 'Открыть Audit Log', icon: 'list', href: '/audit-log', keywords: ['логи', 'аудит'] },
  ];
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-sm text-[var(--color-text-secondary)]">Загрузка панели…</div>;
  const fullName = user.firstName + ' ' + user.lastName;
  const resolvedGroups = groups.map((group) => ({ ...group, items: group.items.map((item) => item.href === '/notifications' ? { ...item, badge: notificationCount } : item) }));
  const status = systemStatus === 'online' ? { label: 'Система работает', tone: 'success' as const } : systemStatus === 'offline' ? { label: 'Система недоступна', tone: 'danger' as const } : { label: 'Проверка системы', tone: 'warning' as const };
  return <WorkspaceShell LinkComponent={AppLink} pathname={pathname} groups={resolvedGroups} roleLabel="Администратор" homeHref="/dashboard" user={{ name: fullName, role: 'Admin profile' }} unreadCount={notificationCount} status={status} commands={commands} onLogout={logout}>{children}</WorkspaceShell>;
}
