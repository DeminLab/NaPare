'use client';

import { ComponentType, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';

export interface NavigationLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}

export interface WorkspaceNavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  keywords?: string[];
  disabled?: boolean;
}

export interface WorkspaceNavGroup {
  label: string;
  items: WorkspaceNavItem[];
}

export interface WorkspaceCommand {
  id: string;
  label: string;
  description?: string;
  icon?: IconName;
  href?: string;
  keywords?: string[];
  shortcut?: string;
  onSelect?: () => void;
}

interface WorkspaceShellProps {
  children: ReactNode;
  groups: WorkspaceNavGroup[];
  LinkComponent: ComponentType<NavigationLinkProps>;
  pathname: string;
  roleLabel: string;
  homeHref: string;
  user?: { name: string; role?: string };
  unreadCount?: number;
  status?: { label: string; tone?: 'success' | 'warning' | 'danger' };
  commands?: WorkspaceCommand[];
  entityCommands?: WorkspaceCommand[];
  onLogout?: () => void;
  searchPlaceholder?: string;
  className?: string;
}

const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'НП';
}

function fuzzyScore(query: string, value: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedValue = value.toLowerCase();
  if (!normalizedQuery) return 1;
  if (normalizedValue === normalizedQuery) return 100;
  if (normalizedValue.startsWith(normalizedQuery)) return 80;
  if (normalizedValue.includes(normalizedQuery)) return 60;
  let cursor = 0;
  let score = 0;
  for (const character of normalizedQuery) {
    const index = normalizedValue.indexOf(character, cursor);
    if (index === -1) return 0;
    score += index === cursor ? 4 : 1;
    cursor = index + 1;
  }
  return score;
}

function isActive(pathname: string, href: string, hash = '') {
  const [targetPath, targetHash] = href.split('#');
  const pathMatches = pathname === targetPath || (targetPath !== '/' && pathname.startsWith(`${targetPath}/`));
  return pathMatches && (!targetHash || hash === `#${targetHash}`);
}

export function WorkspaceShell({ children, groups, LinkComponent, pathname, roleLabel, homeHref, user, unreadCount = 0, status, commands = [], entityCommands = [], onLogout, searchPlaceholder = 'Поиск страниц, сущностей и действий…', className = '' }: WorkspaceShellProps) {
  const ShellLink = LinkComponent;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [hash, setHash] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  const allNavItems = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({ ...item, keywords: [...(item.keywords || []), group.label] }))), [groups]);
  const navCommands = useMemo<WorkspaceCommand[]>(() => allNavItems.map((item) => ({ id: `nav:${item.href}`, label: item.label, description: item.keywords?.[item.keywords.length - 1], icon: item.icon, href: item.href, keywords: item.keywords })), [allNavItems]);
  const allCommands = useMemo(() => [...navCommands, ...commands, ...entityCommands], [commands, entityCommands, navCommands]);
  const filteredCommands = useMemo(() => {
    const filtered = allCommands.map((command) => ({ command, score: fuzzyScore(query, [command.label, command.description || '', ...(command.keywords || [])].join(' ')) })).filter((item) => item.score > 0);
    const recent = new Map(recentIds.map((id, index) => [id, recentIds.length - index]));
    return filtered.sort((left, right) => (recent.get(right.command.id) || 0) - (recent.get(left.command.id) || 0) || right.score - left.score).slice(0, 12).map((item) => item.command);
  }, [allCommands, query, recentIds]);
  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [pathname]);

  const currentItem = allNavItems.find((item) => isActive(pathname, item.href, hash));
  const currentTitle = currentItem?.label || roleLabel;
  const currentGroup = groups.find((group) => group.items.some((item) => isActive(pathname, item.href, hash)));

  const rememberCommand = (id: string) => {
    setRecentIds((previous) => [id, ...previous.filter((value) => value !== id)].slice(0, 5));
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`napare:recent-commands:${roleLabel}`);
      if (stored) setRecentIds(JSON.parse(stored) as string[]);
    } catch { /* localStorage is optional */ }
  }, [roleLabel]);

  useEffect(() => {
    try { window.localStorage.setItem(`napare:recent-commands:${roleLabel}`, JSON.stringify(recentIds)); } catch { /* localStorage is optional */ }
  }, [recentIds, roleLabel]);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === 'Escape') { setPaletteOpen(false); setDrawerOpen(false); setProfileOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    setSelectedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const trapFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab' || !paletteRef.current) return;
      const focusable = Array.from(paletteRef.current.querySelectorAll<HTMLElement>('input,button,a,[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [paletteOpen]);

  const selectCommand = (command: WorkspaceCommand) => {
    rememberCommand(command.id);
    command.onSelect?.();
    setPaletteOpen(false);
    setQuery('');
  };

  const handlePaletteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex((index) => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0))); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === 'Enter' && filteredCommands[selectedIndex]) { event.preventDefault(); selectCommand(filteredCommands[selectedIndex]); }
    if (event.key === 'Tab' && paletteRef.current) {
      const focusable = paletteRef.current.querySelectorAll<HTMLElement>('input,button,a,[tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  const renderLink = (item: WorkspaceNavItem, mobile = false) => {
    const active = isActive(pathname, item.href, hash);
    return <ShellLink href={item.disabled ? '#' : item.href} onClick={() => { if (!item.disabled) { setDrawerOpen(false); } }} title={collapsed && !mobile ? item.label : undefined} className={cn('group relative flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-[background-color,color] duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]', mobile && 'justify-center px-1 text-[10px] leading-4', collapsed && !mobile && 'lg:justify-center lg:px-2', active ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]', item.disabled && 'pointer-events-none opacity-45')} aria-current={active ? 'page' : undefined} aria-disabled={item.disabled || undefined}><Icon name={item.icon} size={mobile ? 19 : 18} /><span className={cn((collapsed && !mobile) || mobile ? 'lg:hidden' : '', mobile && 'truncate')}>{item.label}</span>{item.badge !== undefined && item.badge > 0 && <span className={cn('rounded-full bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-bold text-white', mobile ? 'absolute right-2 top-0' : 'ml-auto')}>{item.badge > 99 ? '99+' : item.badge}</span>}</ShellLink>;
  };

  const sidebar = <aside className={cn('fixed inset-y-0 left-0 z-[var(--z-overlay)] flex w-72 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-[var(--motion-slow)] lg:static lg:translate-x-0', drawerOpen ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-[76px]' : 'lg:w-64')}><div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4"><ShellLink href={homeHref} className="flex min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] font-bold tracking-tight text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] text-xs font-bold text-white">Н</span><span className={collapsed ? 'lg:hidden' : ''}>NaPare</span></ShellLink><div className="flex gap-1"><button type="button" onClick={() => setDrawerOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] lg:hidden" aria-label="Закрыть меню"><Icon name="close" /></button><button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] lg:inline-flex" aria-label={collapsed ? 'Развернуть sidebar' : 'Свернуть sidebar'} aria-pressed={collapsed}><Icon name={collapsed ? 'chevron-right' : 'chevron-left'} /></button></div></div><nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label={`${roleLabel} navigation`}>{groups.map((group) => <section key={group.label}><p className={cn('mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]', collapsed && 'lg:hidden')}>{group.label}</p><div className="space-y-0.5">{group.items.map((item) => <div key={`${group.label}-${item.href}`}>{renderLink(item)}</div>)}</div></section>)}</nav><div className="border-t border-[var(--color-border)] p-3"><button type="button" onClick={() => setProfileOpen((value) => !value)} className={cn('flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] p-2 text-left hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]', collapsed && 'lg:justify-center')} aria-expanded={profileOpen}><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-xs font-semibold text-[var(--color-brand)]">{initials(user?.name || roleLabel)}</span><span className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}><span className="block truncate text-sm font-semibold text-[var(--color-text)]">{user?.name || roleLabel}</span><span className="block truncate text-xs text-[var(--color-text-secondary)]">{user?.role || roleLabel}</span></span><Icon name="chevron-down" size={16} className={cn('text-[var(--color-text-muted)]', collapsed && 'lg:hidden')} /></button>{profileOpen && <div className="absolute bottom-20 left-3 right-3 z-[var(--z-overlay)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-md)]"><ShellLink href={homeHref} onClick={() => setProfileOpen(false)} className="block rounded-[var(--radius-sm)] px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)]">Обзор</ShellLink>{onLogout && <button type="button" onClick={onLogout} className="block min-h-11 w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]">Выйти</button>}</div>}</div></aside>;

  return <div className={cn('flex min-h-screen bg-[var(--color-background)] text-[var(--color-text)]', className)}><div className={cn('fixed inset-0 z-[var(--z-sticky)] bg-slate-950/30 backdrop-blur-sm lg:hidden', drawerOpen ? 'block' : 'hidden')} onClick={() => setDrawerOpen(false)} aria-hidden="true" />{sidebar}<div className="min-w-0 flex-1"><header className="sticky top-0 z-[var(--z-sticky)] flex min-h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[color:rgb(255_255_255_/_0.9)] px-4 py-2 backdrop-blur lg:px-7"><button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] lg:hidden" aria-label="Открыть меню"><Icon name="menu" /></button><div className="min-w-0 shrink-0"><div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]"><span>{roleLabel}</span><span aria-hidden="true">/</span><span className="truncate">{currentGroup?.label || 'Workspace'}</span></div><h1 className="truncate text-base font-semibold text-[var(--color-text)]">{currentTitle}</h1></div><button type="button" onClick={() => setPaletteOpen(true)} className="ml-auto hidden h-11 min-w-0 max-w-xl flex-1 items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 text-left text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)] lg:flex" aria-label="Открыть command palette"><span className="truncate">{searchPlaceholder}</span><kbd className="ml-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px]">Ctrl/⌘ K</kbd></button>{status && <span className={cn('hidden items-center gap-2 text-xs md:flex', status.tone === 'danger' ? 'text-[var(--color-danger)]' : status.tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]')}><span className={cn('h-2 w-2 rounded-full', status.tone === 'danger' ? 'bg-[var(--color-danger)]' : status.tone === 'warning' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]')} />{status.label}</span>}<ShellLink href={allNavItems.find((item) => item.label.toLowerCase().includes('уведом'))?.href || allNavItems.find((item) => item.label.toLowerCase().includes('notification'))?.href || homeHref} className="relative inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]" aria-label="Уведомления"><Icon name="bell" />{unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-danger)]" />}</ShellLink><button type="button" onClick={() => setProfileOpen((value) => !value)} className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]" aria-label="Открыть профиль"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-xs font-semibold text-[var(--color-brand)]">{initials(user?.name || roleLabel)}</span></button></header><main className="ds-page-enter mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1500px] p-4 pb-24 sm:p-6 lg:p-7 lg:pb-7">{children}</main></div><nav className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] grid grid-cols-5 border-t border-[var(--color-border)] bg-[color:rgb(255_255_255_/_0.96)] px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden" aria-label="Мобильная навигация">{allNavItems.filter((item) => !item.disabled).slice(0, 5).map((item) => <div key={item.href} className="relative">{renderLink(item, true)}</div>)}</nav>{paletteOpen && <div className="fixed inset-0 z-[var(--z-modal)] bg-slate-950/35 p-4 pt-[12vh]" onClick={() => setPaletteOpen(false)}><div ref={paletteRef} role="dialog" aria-modal="true" aria-label="Command Palette" className="mx-auto max-w-xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4"><Icon name="search" className="text-[var(--color-text-muted)]" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handlePaletteKeyDown} className="h-14 w-full bg-transparent text-sm outline-none" placeholder={searchPlaceholder} aria-label="Поиск страниц, сущностей и действий" autoComplete="off" /><kbd className="hidden shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] sm:block">Esc</kbd></div><div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">{query === '' && recentIds.length > 0 && <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Недавние</p>}{filteredCommands.map((command, index) => { const item = command.href ? <ShellLink href={command.href} onClick={() => selectCommand(command)} className={cn('flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm', selectedIndex === index ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : 'text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)]')}><Icon name={command.icon || 'arrow-right'} size={17} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{command.label}</span>{command.description && <span className="block truncate text-xs text-[var(--color-text-secondary)]">{command.description}</span>}</span>{command.shortcut && <kbd className="text-[10px] text-[var(--color-text-muted)]">{command.shortcut}</kbd>}</ShellLink> : <button type="button" onClick={() => selectCommand(command)} className={cn('flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm', selectedIndex === index ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : 'text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)]')}><Icon name={command.icon || 'arrow-right'} size={17} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{command.label}</span>{command.description && <span className="block truncate text-xs text-[var(--color-text-secondary)]">{command.description}</span>}</span>{command.shortcut && <kbd className="text-[10px] text-[var(--color-text-muted)]">{command.shortcut}</kbd>}</button>; return <div key={command.id}>{item}</div>; })}{filteredCommands.length === 0 && <p className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]">Ничего не найдено</p>}</div><div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-[10px] text-[var(--color-text-muted)]"><span>↑↓ выбрать · Enter открыть · Esc закрыть</span><span>{filteredCommands.length} результатов</span></div></div></div>}</div>;
}
