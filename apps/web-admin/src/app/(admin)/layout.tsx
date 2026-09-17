'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, apiFetchList, getUser, logout, type Me } from '@/lib/api';
import { Avatar, Button } from '@/components/ui';

interface NavItem { href: string; label: string; icon: string; }
interface NavGroup { label: string; items: NavItem[]; }

const groups: NavGroup[] = [
  { label: 'Dashboard', items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  { label: 'University', items: [{ href: '/university', label: 'Университет', icon: 'building' }, { href: '/faculties', label: 'Факультеты', icon: 'layers' }, { href: '/groups', label: 'Группы', icon: 'users' }, { href: '/schedule-import', label: 'Расписание', icon: 'calendar' }] },
  { label: 'Users', items: [{ href: '/users', label: 'Пользователи', icon: 'user' }, { href: '/users?role=student', label: 'Студенты', icon: 'user' }, { href: '/users?role=teacher', label: 'Преподаватели', icon: 'user' }] },
  { label: 'Integrations', items: [{ href: '/connectors', label: 'Connectors', icon: 'plug' }, { href: '/schedule-import', label: 'Импорт расписания', icon: 'upload' }] },
  { label: 'System', items: [{ href: '/dashboard?view=logs', label: 'Логи', icon: 'list' }, { href: '/dashboard?view=system', label: 'Состояние системы', icon: 'pulse' }] },
  { label: 'Settings', items: [{ href: '/university', label: 'Настройки', icon: 'settings' }] },
];

const pageTitles: Record<string, string> = { '/dashboard': 'Dashboard', '/university': 'Университет', '/faculties': 'Факультеты', '/groups': 'Группы', '/users': 'Пользователи', '/connectors': 'Connectors', '/schedule-import': 'Импорт расписания', '/notifications': 'Уведомления' };
const flatItems = groups.flatMap((group) => group.items);

function Glyph({ icon }: { icon: string }) {
  const paths: Record<string, string> = {
    dashboard: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z',
    building: 'M4 20h16M6 20V5l6-2 6 2v15M9 8h1m4 0h1m-6 4h1m4 0h1m-5 4h1m4 0h1',
    layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 17l9 5 9-5',
    users: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1m6-9a4 4 0 100-8 4 4 0 000 8zm6-7a3 3 0 010 6m4 7v-1a4 4 0 00-3-3.87',
    user: 'M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z',
    calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v13H4V6a1 1 0 011-1z',
    plug: 'M9 7V3m6 4V3M7 7h10v4a5 5 0 01-10 0V7zm5 9v5',
    upload: 'M12 16V4m0 0L8 8m4-4l4 4M5 14v5h14v-5',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    pulse: 'M3 12h4l2-7 4 14 2-7h6',
    settings: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 010 2.4l-.5.5-2-1.1a7.8 7.8 0 01-1.5.9L15 20h-3l-.4-2.3a7.8 7.8 0 01-1.5-.9l-2 1.1-.5-.5a1.7 1.7 0 010-2.4l1.1-2a7.8 7.8 0 01-.1-1.8l-1-1.9.5-.5a1.7 1.7 0 012.4 0l1.9 1a7.8 7.8 0 011.8-.1l1.9-1a1.7 1.7 0 012.4 0l.5.5-1 1.9c.1.6.1 1.2 0 1.8l1 2z',
  };
  return <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d={paths[icon] || paths.dashboard} /></svg></span>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [query, setQuery] = useState('');

  useEffect(() => { getUser().then(setUser).catch(() => router.push('/login')); apiFetchList<{ isRead: boolean }>('/notifications').then((items) => setNotificationCount(items.filter((item) => !item.isRead).length)).catch(() => undefined); apiFetch<{ status: string }>('/health').then(() => setSystemStatus('online')).catch(() => setSystemStatus('offline')); }, [router]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true); } if (event.key === 'Escape') { setPaletteOpen(false); setProfileOpen(false); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);

  const currentTitle = pageTitles[pathname] || (pathname.includes('view=logs') ? 'Логи' : pathname.includes('view=system') ? 'Состояние системы' : 'Dashboard');
  const searchItems = useMemo(() => flatItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);
  const active = (item: NavItem) => pathname === item.href || (item.href === '/users' && pathname.startsWith('/users'));
  const renderNav = (item: NavItem) => <Link href={item.href} onClick={() => setDrawerOpen(false)} title={collapsed ? item.label : undefined} className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${active(item) ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}><Glyph icon={item.icon} /><span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span></Link>;

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Загрузка панели…</div>;

  return <div className="flex min-h-screen bg-slate-100 text-slate-900"><div className={`fixed inset-0 z-40 bg-slate-950/50 lg:hidden ${drawerOpen ? 'block' : 'hidden'}`} onClick={() => setDrawerOpen(false)} /><aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:static lg:translate-x-0 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[76px]' : 'w-72 lg:w-64'}`}><div className="flex h-16 items-center justify-between border-b border-slate-200 px-4"><Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-md font-bold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-sm text-white">Н</span><span className={collapsed ? 'lg:hidden' : ''}>NaPare Admin</span></Link><button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 lg:block" aria-label={collapsed ? 'Развернуть sidebar' : 'Свернуть sidebar'}>{collapsed ? '→' : '←'}</button></div><nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Admin navigation">{groups.map((group) => <section key={group.label}><p className={`mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${collapsed ? 'lg:hidden' : ''}`}>{group.label}</p><div className="space-y-0.5">{group.items.map((item) => <div key={`${group.label}-${item.label}`}>{renderNav(item)}</div>)}</div></section>)}</nav><div className="border-t border-slate-200 p-3"><button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${collapsed ? 'lg:justify-center' : ''}`}><Avatar name={`${user.firstName} ${user.lastName}`} size="sm" /><span className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}><span className="block truncate text-sm font-semibold">{user.firstName} {user.lastName}</span><span className="block text-xs text-slate-400">Admin profile</span></span><span className={`text-slate-400 ${collapsed ? 'lg:hidden' : ''}`}>⌄</span></button>{profileOpen && <div className="absolute bottom-20 left-3 right-3 z-50 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"><Link href="/university" className="block rounded-md px-3 py-2 text-sm hover:bg-slate-100">Профиль организации</Link><Link href="/university" className="block rounded-md px-3 py-2 text-sm hover:bg-slate-100">Настройки</Link><button type="button" onClick={logout} className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Выйти</button></div>}</div></aside><div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-7"><button type="button" onClick={() => setDrawerOpen(true)} className="h-10 w-10 rounded-md text-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 lg:hidden" aria-label="Открыть меню">☰</button><div className="min-w-0 shrink-0"><div className="text-xs font-medium text-slate-400">Admin <span aria-hidden="true">/</span></div><h1 className="truncate text-sm font-bold text-slate-900">{currentTitle}</h1></div><button type="button" onClick={() => setPaletteOpen(true)} className="ml-auto hidden h-9 min-w-0 max-w-xl flex-1 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-400 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 lg:flex" aria-label="Открыть command palette"><span>Search users, groups and actions</span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px]">⌘ K</kbd></button><div className="hidden items-center gap-2 text-xs text-slate-500 md:flex"><span className={`h-2 w-2 rounded-full ${systemStatus === 'online' ? 'bg-emerald-500' : systemStatus === 'offline' ? 'bg-red-500' : 'bg-amber-400'}`} />{systemStatus === 'online' ? 'System operational' : systemStatus === 'offline' ? 'System unavailable' : 'Checking system'}</div><Link href="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-md text-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" aria-label="Уведомления">♧{notificationCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}</Link><button type="button" onClick={() => setProfileOpen((value) => !value)} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" aria-label="Открыть профиль"><Avatar name={`${user.firstName} ${user.lastName}`} size="sm" /></button></header><main className="ds-page-enter mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1500px] p-4 sm:p-6 lg:p-7">{children}</main></div>{paletteOpen && <div className="fixed inset-0 z-[60] bg-slate-950/50 p-4 pt-[12vh]" onClick={() => setPaletteOpen(false)}><div role="dialog" aria-modal="true" aria-label="Command Palette" className="mx-auto max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-slate-200 px-4"><span className="font-mono text-slate-400">⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, groups and actions" className="h-14 w-full text-sm outline-none" /></div><div className="max-h-80 overflow-y-auto p-2">{searchItems.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href} onClick={() => { setPaletteOpen(false); setQuery(''); }} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100"><Glyph icon={item.icon} />{item.label}<span className="ml-auto text-xs text-slate-400">Open</span></Link>)}{!searchItems.length && <p className="px-3 py-5 text-center text-sm text-slate-500">No matching commands</p>}</div><div className="border-t border-slate-200 px-4 py-3 font-mono text-[10px] text-slate-400">Ctrl/⌘ K to open · Esc to close</div></div></div>}</div>;
}
