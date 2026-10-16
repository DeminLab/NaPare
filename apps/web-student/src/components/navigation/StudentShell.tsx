'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WorkspaceShell, searchCommands, type WorkspaceSearchResponse, type NavigationLinkProps, type WorkspaceCommand, type WorkspaceNavGroup } from '@napare/ui/workspace-shell';
import { apiFetch, getUnreadCount, getUser, isLoggedIn, logout, StudentUser } from '@/lib/api';

const groups: WorkspaceNavGroup[] = [
  { label: 'Главное', items: [{ href: '/today', label: 'Сегодня', icon: 'home', keywords: ['мой день', 'сейчас', 'дальше'] }, { href: '/week', activePaths: ['/month'], label: 'Расписание', icon: 'calendar', keywords: ['день', 'неделя', 'месяц'] }, { href: '/pair-space', label: 'Подготовка', icon: 'book', keywords: ['материалы', 'задания', 'пространства пар'] }, { href: '/notifications', label: 'Уведомления', icon: 'bell' }] },
  { label: 'Другие действия', items: [{ href: '/absences', label: 'Сообщить об отсутствии', icon: 'clipboard' }, { href: '/groups', label: 'Избранное расписание', icon: 'users' }] },
  { label: 'Аккаунт', items: [{ href: '/profile', label: 'Профиль', icon: 'user' }, { href: '/settings', label: 'Настройки', icon: 'settings' }, { href: '/connections', label: 'Подключения аккаунта', icon: 'plug' }] },
];

const AppLink = ({ href, children, ...props }: NavigationLinkProps) => href === '/connections' ? <a href={href} {...props}>{children}</a> : <Link href={href} {...props}>{children}</Link>;
const searchWorkspace = async (query: string, signal: AbortSignal) => searchCommands(await apiFetch<WorkspaceSearchResponse>('/search?q=' + encodeURIComponent(query), { signal }));

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
    { id: 'student:today', label: 'Открыть сегодня', description: 'Ближайшая пара и важные действия', icon: 'home', href: '/today', keywords: ['сейчас', 'задачи'] },
    { id: 'student:schedule', label: 'Открыть расписание', description: 'Неделя и месяц', icon: 'calendar', href: '/week', keywords: ['расписание'] },
    { id: 'student:pair-space', label: 'Открыть подготовку', description: 'Материалы, темы и обсуждения', icon: 'book', href: '/pair-space' },
    { id: 'student:notifications', label: 'Открыть уведомления', description: unread ? unread + ' непрочитанных' : 'Всё прочитано', icon: 'bell', href: '/notifications' },
  ];

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-sm text-[var(--color-text-secondary)]">Загрузка…</div>;
  const name = user.firstName + ' ' + user.lastName;
  const resolvedGroups = groups.map(group => ({ ...group, items: group.items.map(item => item.href === '/notifications' ? { ...item, badge: unread } : item) }));
  return <WorkspaceShell LinkComponent={AppLink} pathname={pathname} groups={resolvedGroups} roleLabel="Студент" homeHref="/today" user={{ name, role: user.groupName || 'Студент', id: user.id }} unreadCount={unread} commands={commands} onSearch={searchWorkspace} searchPlaceholder="Предмет, преподаватель, материал или раздел…" mobileHrefs={['/today', '/week', '/pair-space', '/notifications']} onLogout={logout}>{children}</WorkspaceShell>;
}
