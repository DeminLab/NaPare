'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceShell, type NavigationLinkProps, type WorkspaceCommand, type WorkspaceNavGroup } from '@napare/ui/workspace-shell';
import { getUnreadCount, getUser, isLoggedIn, logout } from '@/lib/api';

const groups: WorkspaceNavGroup[] = [
  { label: 'Сегодня', items: [{ href: '/today', label: 'Сегодня', icon: 'calendar', keywords: ['мой день', 'ближайшая пара'] }] },
  { label: 'Работа', items: [{ href: '/week', label: 'Расписание', icon: 'calendar', keywords: ['неделя', 'пары'] }, { href: '/groups', label: 'Группы', icon: 'users' }, { href: '/attendance', label: 'Посещаемость', icon: 'check' }, { href: '/pair-space', label: 'Пространства пар', icon: 'book' }] },
  { label: 'Коммуникация', items: [{ href: '/inbox', label: 'Входящие', icon: 'bell' }, { href: '/notifications', label: 'Уведомления', icon: 'bell' }] },
  { label: 'Аккаунт', items: [{ href: '/profile', label: 'Профиль', icon: 'user' }, { href: '/settings', label: 'Настройки', icon: 'settings' }] },
];
const AppLink = ({ href, children, ...props }: NavigationLinkProps) => <Link href={href} {...props}>{children}</Link>;

export default function StaffLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    getUser().then(setUser).catch(() => router.push('/login'));
    getUnreadCount().then(setUnread).catch(() => undefined);
  }, [router]);
  const commands: WorkspaceCommand[] = [
    { id: 'staff:today', label: 'Открыть мой рабочий день', description: 'Ближайшие пары и задачи', icon: 'calendar', href: '/today', keywords: ['сегодня', 'мой день'] },
    { id: 'staff:notifications', label: 'Открыть уведомления', description: unread ? unread + ' непрочитанных' : 'Новых уведомлений нет', icon: 'bell', href: '/notifications' },
    { id: 'staff:inbox', label: 'Открыть входящие', description: 'Сообщения и действия преподавателя', icon: 'bell', href: '/inbox', keywords: ['сообщения', 'вопросы', 'работы'] },
    { id: 'staff:profile', label: 'Открыть профиль', icon: 'user', href: '/profile' },
  ];
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-sm text-[var(--color-text-secondary)]">Загрузка…</div>;
  const fullName = user.firstName + ' ' + user.lastName;
  const resolvedGroups = groups.map((group) => ({ ...group, items: group.items.map((item) => item.href === '/notifications' ? { ...item, badge: unread } : item) }));
  return <WorkspaceShell LinkComponent={AppLink} pathname={pathname} groups={resolvedGroups} roleLabel="Преподаватель" homeHref="/today" user={{ name: fullName, role: 'Преподаватель' }} unreadCount={unread} commands={commands} onLogout={logout}>{children}</WorkspaceShell>;
}
