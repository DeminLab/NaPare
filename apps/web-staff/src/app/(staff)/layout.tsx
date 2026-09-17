'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getNotifications, getUnreadCount, getUser, isLoggedIn, logout } from '@/lib/api';
import { Avatar, Button } from '@/components/ui';

type NavItem = { href: string; label: string; icon: string; badge?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: 'Главное', items: [{ href: '/today', label: 'Сегодня', icon: 'calendar' }, { href: '/week', label: 'Расписание', icon: 'calendar-range' }] },
  { label: 'Учёба', items: [{ href: '/groups', label: 'Группы', icon: 'users' }, { href: '/attendance', label: 'Посещаемость', icon: 'check' }, { href: '/pair-space', label: 'Пространства пар', icon: 'book' }] },
  { label: 'Общение', items: [{ href: '/notifications', label: 'Уведомления', icon: 'bell', badge: true }] },
  { label: 'Аккаунт', items: [{ href: '/profile', label: 'Профиль', icon: 'user' }, { href: '/settings', label: 'Настройки', icon: 'settings' }] },
];

const mobileItems = [groups[0].items[0], groups[0].items[1], groups[1].items[0], groups[2].items[0], groups[3].items[0]];

const pageTitles: Record<string, string> = Object.fromEntries(groups.flatMap((group) => group.items.map((item) => [item.href, item.label])));

function NavGlyph({ symbol }: { symbol: string }) {
  const paths: Record<string, string> = {
    calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v13H4V6a1 1 0 011-1zm3 8h3m-3 3h5',
    'calendar-range': 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v13H4V6a1 1 0 011-1zm3 7h3m-3 3h6',
    users: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1m6-9a4 4 0 100-8 4 4 0 000 8zm6-7a3 3 0 010 6m4 7v-1a4 4 0 00-3-3.87',
    check: 'M5 12l4 4L19 6',
    book: 'M5 4h10a4 4 0 014 4v12H9a4 4 0 00-4 0V4zm0 0v12a4 4 0 014 0h10',
    bell: 'M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4',
    user: 'M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z',
    settings: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 010 2.4l-.5.5-2-1.1a7.8 7.8 0 01-1.5.9L15 20h-3l-.4-2.3a7.8 7.8 0 01-1.5-.9l-2 1.1-.5-.5a1.7 1.7 0 010-2.4l1.1-2a7.8 7.8 0 01-.1-1.8l-1-1.9.5-.5a1.7 1.7 0 012.4 0l1.9 1a7.8 7.8 0 011.8-.1l1.9-1a1.7 1.7 0 012.4 0l.5.5-1 1.9c.1.6.1 1.2 0 1.8l1 2z',
  };
  return <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d={paths[symbol] || paths.calendar} /></svg></span>;
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Array<{ id?: string; title?: string; message?: string; createdAt?: string }>>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    getUser().then(setUser).catch(() => router.push('/login'));
    getUnreadCount().then(setUnread).catch(() => undefined);
    getNotifications().then((items) => setNotifications(items.slice(0, 3))).catch(() => undefined);
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === 'Escape') { setPaletteOpen(false); setNotificationsOpen(false); setProfileOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const title = pageTitles[pathname] || (pathname.startsWith('/pair-space') ? 'Пространство пары' : 'Сегодня');
  const allItems = useMemo(() => groups.flatMap((group) => group.items), []);
  const filteredItems = allItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  const isActive = (item: NavItem) => pathname === item.href || (item.href === '/pair-space' && pathname.startsWith('/pair-space/'));
  const renderLink = (item: NavItem, mobile = false) => <Link href={item.href} onClick={() => setDrawerOpen(false)} title={mobile ? undefined : item.label} className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${mobile ? 'justify-center px-1 text-[10px] leading-4' : ''} ${isActive(item) ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><NavGlyph symbol={item.icon} /><span className={mobile ? 'truncate' : ''}>{item.label}</span>{item.badge && unread > 0 && <span className={`${mobile ? 'absolute right-2 top-0' : 'ml-auto'} rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white`}>{unread > 99 ? '99+' : unread}</span>}</Link>;

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Загрузка…</div>;

  return <div className="flex min-h-screen bg-slate-50"><div className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden ${drawerOpen ? 'block' : 'hidden'}`} onClick={() => setDrawerOpen(false)} /><aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:w-64 lg:translate-x-0 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex h-16 items-center border-b border-slate-100 px-4"><Link href="/today" className="flex items-center gap-2.5 rounded-lg font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-sm text-white">Н</span><span>НаПаре</span></Link></div><nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Основная навигация">{groups.map((group) => <div key={group.label}><p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p><div className="space-y-1">{group.items.map((item) => <div key={item.href}>{renderLink(item)}</div>)}</div></div>)}</nav><div className="relative border-t border-slate-100 p-3"><button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"><Avatar name={fullName} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{fullName}</span><span className="block text-xs text-slate-400">Преподаватель</span></span><span aria-hidden="true" className="text-slate-400">⌄</span></button>{profileOpen && <div className="absolute bottom-20 left-3 right-3 z-50 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"><Link href="/profile" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Профиль</Link><Link href="/settings" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Настройки</Link><a href="mailto:support@napare.ru" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Помощь</a><button type="button" onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Выйти</button></div>}</div></aside><div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur lg:px-7"><button type="button" onClick={() => setDrawerOpen(true)} className="h-11 w-11 rounded-lg text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:hidden" aria-label="Открыть меню">☰</button><div className="min-w-0 shrink-0"><div className="text-xs text-slate-400">НаПаре <span aria-hidden="true">/</span></div><h1 className="truncate text-base font-bold text-slate-900">{title}</h1></div><button type="button" onClick={() => setPaletteOpen(true)} className="ml-auto hidden h-10 min-w-0 max-w-xl flex-1 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:flex" aria-label="Открыть глобальный поиск"><span className="truncate">Поиск по расписанию, группам и заданиям</span><kbd className="ml-3 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">Ctrl/⌘ K</kbd></button><span className="hidden text-sm text-slate-500 xl:block">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span><div className="relative"><button type="button" onClick={() => setNotificationsOpen((value) => !value)} className="relative flex h-11 w-11 items-center justify-center rounded-xl text-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Открыть уведомления" aria-expanded={notificationsOpen}>♧{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}</button>{notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><div className="flex items-center justify-between"><p className="font-semibold text-slate-900">Последние уведомления</p><span className="text-xs text-slate-400">{unread} непрочитанных</span></div>{notifications.length ? <div className="mt-3 divide-y divide-slate-100">{notifications.map((notification, index) => <div key={notification.id || index} className="py-3 first:pt-1"><p className="text-sm font-medium text-slate-800">{notification.title || notification.message || 'Новое уведомление'}</p>{notification.createdAt && <p className="mt-1 text-xs text-slate-400">{new Date(notification.createdAt).toLocaleDateString('ru-RU')}</p>}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">Новых уведомлений нет.</p>}<Link href="/notifications" className="mt-3 block text-sm font-semibold text-sky-600 hover:text-sky-700">Открыть все уведомления →</Link></div>}</div><Link href="/profile" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Открыть профиль"><Avatar name={fullName} size="sm" /></Link></header><main className="ds-page-enter mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1400px] p-4 pb-24 sm:p-6 lg:p-7 lg:pb-7">{children}</main></div><nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 py-1.5 backdrop-blur lg:hidden" aria-label="Мобильная навигация">{mobileItems.map((item) => <div key={item.href} className="relative">{renderLink(item, true)}</div>)}</nav>{paletteOpen && <div className="fixed inset-0 z-[60] bg-slate-950/40 p-4 pt-[12vh]" onClick={() => setPaletteOpen(false)}><div role="dialog" aria-modal="true" aria-label="Command Palette" className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-2 border-b border-slate-100 px-4"><span className="text-lg text-slate-400">⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-14 w-full text-sm outline-none" placeholder="Перейти к разделу…" aria-label="Поиск раздела" /></div><div className="max-h-80 overflow-y-auto p-2">{filteredItems.map((item) => <Link key={item.href} href={item.href} onClick={() => { setPaletteOpen(false); setQuery(''); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"><NavGlyph symbol={item.icon} />{item.label}<span className="ml-auto text-xs text-slate-400">Перейти</span></Link>)}{!filteredItems.length && <p className="px-3 py-5 text-center text-sm text-slate-500">Ничего не найдено</p>}</div><div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">Ctrl/⌘ K — открыть · Esc — закрыть</div></div></div>}</div>;
}
