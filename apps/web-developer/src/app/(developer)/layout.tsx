'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceShell, type NavigationLinkProps, type WorkspaceCommand, type WorkspaceNavGroup } from '@napare/ui/workspace-shell';
import { apiFetch, getHealth, getUser, logout } from '@/lib/api';
import type { HealthInfo, UserInfo } from '@/lib/api';

const groups: WorkspaceNavGroup[] = [
  { label: 'Overview', items: [{ href: '/overview', label: 'Overview', icon: 'home' }] },
  { label: 'Platform', items: [{ href: '/api', label: 'API', icon: 'code', keywords: ['api explorer', 'endpoints'] }, { href: '/api#logs', label: 'Logs', icon: 'list' }, { href: '/api#events', label: 'Events', icon: 'pulse' }, { href: '/api#connectors', label: 'Connectors', icon: 'plug' }] },
  { label: 'Knowledge', items: [{ href: '/docs', label: 'Documentation', icon: 'book' }, { href: '/architecture', label: 'Architecture', icon: 'layers' }] },
  { label: 'Access', items: [{ href: '/session', label: 'Sessions', icon: 'users' }] },
];
const AppLink = ({ href, children, ...props }: NavigationLinkProps) => <Link href={href} {...props}>{children}</Link>;

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    getUser().then(setUser).catch(() => undefined);
    getHealth().then(setHealth).catch(() => setHealth(null));
    apiFetch<{ data: Array<{ isRead: boolean }> }>('/notifications').then((response) => setUnread(response.data.filter((item) => !item.isRead).length)).catch(() => undefined);
  }, []);
  const commands: WorkspaceCommand[] = [
    { id: 'developer:api', label: 'Открыть API Explorer', description: 'Эндпоинты и авторизация', icon: 'code', href: '/api', keywords: ['api', 'endpoints'] },
    { id: 'developer:docs', label: 'Открыть документацию', icon: 'book', href: '/docs' },
    { id: 'developer:session', label: 'Открыть активные сессии', icon: 'users', href: '/session', keywords: ['sessions', 'jobs'] },
  ];
  const name = user ? user.firstName + ' ' + user.lastName : 'Developer';
  return <WorkspaceShell className="developer-shell" LinkComponent={AppLink} pathname={pathname} groups={groups} roleLabel="Developer" homeHref="/overview" user={{ name, role: 'Developer' }} unreadCount={unread} status={{ label: health ? 'API online' : 'API unavailable', tone: health ? 'success' : 'warning' }} commands={commands} onLogout={logout}>{children}</WorkspaceShell>;
}
