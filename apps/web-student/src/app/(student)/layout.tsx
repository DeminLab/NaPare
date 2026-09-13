'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, getUser, logout, getUnreadCount } from '@/lib/api';
import { Avatar, Icon, IconName } from '@/components/ui';

const navigationItems = [
  { href: '/today', label: 'Сегодня', icon: 'CalendarDays' as IconName },
  { href: '/week', label: 'Расписание', icon: 'CalendarRange' as IconName },
  { href: '/absences', label: 'Пропуски', icon: 'ClipboardCheck' as IconName },
  { href: '/notifications', label: 'Уведомления', icon: 'Bell' as IconName },
];

const accountItems = [
  { href: '/profile', label: 'Профиль', icon: 'User' as IconName },
  { href: '/settings', label: 'Настройки', icon: 'Settings' as IconName },
];

const pageTitles: Record<string, string> = {
  '/today': 'Сегодня',
  '/week': 'Расписание',
  '/absences': 'Пропуски',
  '/notifications': 'Уведомления',
  '/profile': 'Профиль',
  '/settings': 'Настройки',
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    getUser().then(u => { setUser(u); }).catch(() => { router.push('/login'); });
    getUnreadCount().then(c => setUnread(c)).catch(() => {});
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      getUnreadCount().then(c => setUnread(c)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const renderNavItem = (item: { href: string; label: string; icon: IconName }) => {
    const active = pathname === item.href;
    return (
      <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
        <Icon name={item.icon} className="h-5 w-5" />
        <span>{item.label}</span>
        {item.href === '/notifications' && unread > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{unread}</span>}
      </Link>
    );
  };
  const pageTitle = pageTitles[pathname] || 'НаПаре';
  const contextDate = pathname === '/today'
    ? new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-[var(--motion-sidebar)] lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">Н</div>
          <span className="text-lg font-bold text-slate-900">НаПаре</span>
        </div>
        <nav className="flex-1 space-y-6 p-4">
          <div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Навигация</p><div className="space-y-1">{navigationItems.map(renderNavItem)}</div></div>
          <div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Аккаунт</p><div className="space-y-1">{accountItems.map(renderNavItem)}</div></div>
        </nav>
        <div className="border-t border-slate-100 p-3">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50">
            <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}</span><span className="block truncate text-xs text-slate-400">{user.groupName || 'Студент'}</span></span>
            <span className="text-lg text-slate-400" aria-hidden="true">→</span>
          </Link>
          <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-xs font-medium text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"><Icon name="LogOut" className="h-4 w-4" />Выйти</button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* TopBar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">НП</div>
            <span className="text-lg font-bold text-slate-900">НаПаре</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="order-first rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Открыть меню">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="hidden min-w-0 flex-1 lg:block">
            <h1 className="truncate text-sm font-semibold text-slate-900">{pageTitle}{contextDate && <span className="font-normal text-slate-400"> · {contextDate}</span>}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
              )}
            </Link>
            <Link href="/profile" className="flex items-center gap-2">
              <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
              <span className="hidden text-sm font-medium text-slate-700 lg:block">{user.firstName} {user.lastName}</span>
              <svg className="hidden h-4 w-4 text-slate-400 lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 9l6 6 6-6" /></svg>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="ds-page-enter flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
