'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WorkspaceShell, type NavigationLinkProps, type WorkspaceCommand, type WorkspaceNavGroup } from '@napare/ui/workspace-shell';
import { getUnreadCount, getUser, isLoggedIn, logout, StudentUser } from '@/lib/api';

const groups: WorkspaceNavGroup[] = [
  { label: 'Мой день', items: [{ href: '/today', label: 'Мой день', icon: 'home', keywords: ['сейчас', 'дальше', 'action center'] }] },
  { label: 'Учёба', items: [{ href: '/week', label: 'Расписание', icon: 'calendar', keywords: ['день', 'неделя', 'agenda'] }, { href: '/pair-space', label: 'Пространства пар', icon: 'book', keywords: ['материалы', 'задания', 'обсуждение'] }, { href: '/absences', label: 'Посещаемость', icon: 'clipboard' }] },
  { label: 'Коммуникация', items: [{ href: '/notifications', label: 'Уведомления', icon: 'bell' }] },
  { label: 'Аккаунт', items: [{ href: '/profile', label: 'Профиль', icon: 'user' }, { href: '/settings', label: 'Настройки', icon: 'settings' }] },
];

const AppLink = ({ href, children, ...props }: NavigationLinkProps) => <Link href={href} {...props}>{children}</Link>;

export default function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    getUser().then(setUser).catch(() => router.push('/login'));
    getUnreadCount().then(setUnread).catch(() => undefined);
  }, [router]);

  const commands: WorkspaceCommand[] = [
    { id: 'student:today', label: 'Открыть мой день', description: 'Сейчас, дальше и Action Center', icon: 'home', href: '/today', keywords: ['сейчас', 'задачи'] },
    { id: 'student:schedule', label: 'Открыть расписание', description: 'День, неделя и agenda', icon: 'calendar', href: '/week', keywords: ['расписание', 'agenda'] },
    { id: 'student:pair-space', label: 'Открыть пространства пар', description: 'Материалы, задания и обсуждения', icon: 'book', href: '/pair-space' },
    { id: 'student:notifications', label: 'Открыть уведомления', description: unread ? unread + ' непрочитанных' : 'Всё прочитано', icon: 'bell', href: '/notifications' },
  ];

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-sm text-[var(--color-text-secondary)]">Загрузка…</div>;
  const name = user.firstName + ' ' + user.lastName;
  const resolvedGroups = groups.map(group => ({ ...group, items: group.items.map(item => item.href === '/notifications' ? { ...item, badge: unread } : item) }));
  return <WorkspaceShell LinkComponent={AppLink} pathname={pathname} groups={resolvedGroups} roleLabel="Студент" homeHref="/today" user={{ name, role: user.groupName || 'Студент' }} unreadCount={unread} commands={commands} onLogout={logout}>{children}</WorkspaceShell>;
}
