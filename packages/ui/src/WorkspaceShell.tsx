'use client';

import { ComponentType, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';
import { activeNavigationIndex, uniqueCommands } from './workspace-navigation';
export { searchCommands, lessonTabFromSearch, parseCalendarDate, type WorkspaceSearchResponse } from './workspace-navigation';
export { useWorkspaceQuery } from './useWorkspaceQuery';

export interface NavigationLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> { href: string; children: ReactNode }
export interface WorkspaceNavItem { href: string; label: string; icon: IconName; badge?: number; keywords?: string[]; disabled?: boolean; activePaths?: string[]; mobileLabel?: string }
export interface WorkspaceNavGroup { label: string; items: WorkspaceNavItem[] }
export interface WorkspaceCommand { id: string; label: string; description?: string; icon?: IconName; href?: string; keywords?: string[]; shortcut?: string; onSelect?: () => void }
export interface WorkspaceHelp { title: string; description: string; steps: Array<{ title: string; description: string; href: string }> }
interface WorkspaceShellProps {
  children: ReactNode; groups: WorkspaceNavGroup[]; LinkComponent: ComponentType<NavigationLinkProps>; pathname: string; roleLabel: string; homeHref: string;
  user?: { name: string; role?: string; id?: string }; unreadCount?: number; notificationHref?: string;
  status?: { label: string; tone?: 'success' | 'warning' | 'danger' }; commands?: WorkspaceCommand[]; entityCommands?: WorkspaceCommand[];
  onSearch?: (query: string, signal: AbortSignal) => Promise<WorkspaceCommand[]>;
  mobileHrefs?: string[]; help?: WorkspaceHelp; onLogout?: () => void; searchPlaceholder?: string; className?: string;
}
const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
const control = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]';
function initials(name: string) { return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'НП'; }
function fuzzyScore(query: string, value: string) {
  const term = query.trim().toLowerCase(); const text = value.toLowerCase();
  if (!term) return 1;
  if (text.startsWith(term)) return 80;
  if (text.includes(term)) return 60;
  let cursor = 0;
  for (const character of term) { const index = text.indexOf(character, cursor); if (index === -1) return 0; cursor = index + 1; }
  return 10;
}

export function WorkspaceShell({ children, groups, LinkComponent: ShellLink, pathname, roleLabel, homeHref, user, unreadCount = 0, notificationHref, status, commands = [], entityCommands = [], onSearch, mobileHrefs = [], help, onLogout, searchPlaceholder = 'Найти раздел или действие…', className = '' }: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remote, setRemote] = useState<{ query: string; items: WorkspaceCommand[] }>({ query: '', items: [] });
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [location, setLocation] = useState({ search: '', hash: '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const queryTerm = query.trim();
  const allNavItems = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))), [groups]);
  const activeIndex = activeNavigationIndex(allNavItems, pathname, location.search, location.hash);
  const currentItem = allNavItems[activeIndex];
  const mobileItems = mobileHrefs.map((href) => allNavItems.find((item) => item.href === href)).filter((item): item is typeof allNavItems[number] => !!item && !item.disabled).slice(0, 4);
  const allCommands = useMemo<WorkspaceCommand[]>(() => uniqueCommands([
    ...allNavItems.filter((item) => !item.disabled).map((item) => ({ id: 'nav:' + item.href, label: item.label, description: item.group, icon: item.icon, href: item.href, keywords: item.keywords })),
    ...commands, ...entityCommands,
  ]), [allNavItems, commands, entityCommands]);
  const filteredCommands = useMemo(() => {
    const local = allCommands.map((command) => ({ command, score: fuzzyScore(queryTerm, [command.label, command.description || '', ...(command.keywords || [])].join(' ')) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.command);
    return uniqueCommands([...(remote.query === queryTerm ? remote.items : []), ...(searchState === 'error' && !local.length ? allCommands : local)]).slice(0, 16);
  }, [allCommands, queryTerm, remote, searchState]);
  const welcomeKey = user?.id ? 'napare:welcome:v1:' + roleLabel + ':' + user.id : undefined;
  const hasHelp = !!help;

  useEffect(() => {
    const sync = () => setLocation({ search: window.location.search, hash: window.location.hash });
    sync(); window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, [pathname]);
  useEffect(() => {
    if (!welcomeKey || !hasHelp) return;
    try { setShowWelcome(window.localStorage.getItem(welcomeKey) !== 'seen'); } catch { setShowWelcome(false); }
  }, [welcomeKey, hasHelp]);
  const dismissWelcome = () => { setShowWelcome(false); if (welcomeKey) { try { window.localStorage.setItem(welcomeKey, 'seen'); } catch { /* Optional preference */ } } };
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setHelpOpen(false); setDrawerOpen(false); setPaletteOpen(true); }
      if (event.key === 'Escape') { setPaletteOpen(false); setHelpOpen(false); setDrawerOpen(false); setProfileOpen(false); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => { setDrawerOpen(false); setProfileOpen(false); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => { if (media.matches) setDrawerOpen(false); };
    media.addEventListener('change', sync); return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (!paletteOpen || !onSearch || queryTerm.length < 2 || queryTerm.length > 80) { setSearchState('idle'); return; }
    const controller = new AbortController();
    setSearchState('loading');
    const timer = window.setTimeout(() => {
      onSearch(queryTerm, controller.signal).then((items) => {
        if (!controller.signal.aborted) { setRemote({ query: queryTerm, items }); setSearchState('idle'); }
      }).catch(() => { if (!controller.signal.aborted) { setRemote({ query: queryTerm, items: [] }); setSearchState('error'); } });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [paletteOpen, onSearch, queryTerm, searchAttempt]);
  useEffect(() => { setSelectedIndex(0); }, [queryTerm, remote]);
  useEffect(() => {
    if (paletteOpen) dialogRef.current?.querySelector('[data-command-index="' + selectedIndex + '"]')?.scrollIntoView({ block: 'nearest' });
  }, [paletteOpen, selectedIndex]);

  // Overlays share keyboard, scroll and focus behaviour.
  useEffect(() => {
    if (!paletteOpen && !helpOpen && !drawerOpen) return;
    const container = drawerOpen ? sidebarRef.current : dialogRef.current;
    if (!container) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    contentRef.current?.setAttribute('inert', '');
    if (!drawerOpen) sidebarRef.current?.setAttribute('inert', '');
    const frame = requestAnimationFrame(() => (paletteOpen ? inputRef.current : container.querySelector<HTMLElement>('button,a'))?.focus());
    const trapFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = Array.from(container.querySelectorAll<HTMLElement>('input,button,a[href],[tabindex="0"]')).filter((node) => node.getClientRects().length > 0);
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      cancelAnimationFrame(frame); document.body.style.overflow = previousOverflow;
      contentRef.current?.removeAttribute('inert'); sidebarRef.current?.removeAttribute('inert');
      document.removeEventListener('keydown', trapFocus); previousFocus?.focus();
    };
  }, [paletteOpen, helpOpen, drawerOpen]);

  const selectCommand = (command: WorkspaceCommand) => { command.onSelect?.(); setPaletteOpen(false); setQuery(''); };
  const handlePaletteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex((index) => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0))); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === 'Enter') {
      event.preventDefault();
      // Activate the actual link so Next.js applies the workspace base path.
      dialogRef.current?.querySelector<HTMLElement>('[data-command-index="' + selectedIndex + '"] a, [data-command-index="' + selectedIndex + '"] button')?.click();
    }
  };
  const renderLink = (item: WorkspaceNavItem, mobile = false) => {
    const active = currentItem?.href === item.href;
    return <ShellLink href={item.href} onClick={() => setDrawerOpen(false)} title={collapsed && !mobile ? item.label : undefined} aria-label={mobile && item.mobileLabel ? item.label : undefined} aria-current={active ? 'page' : undefined} className={cn('relative flex gap-2 rounded-[var(--radius-md)] font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]', mobile ? 'min-h-[52px] flex-col items-center justify-start px-0.5 py-1 text-[10px] leading-3' : 'min-h-11 items-center px-3 py-2.5 text-sm', collapsed && !mobile && 'lg:justify-center lg:px-2', active ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]')}>
      <Icon name={item.icon} size={19} /><span className={cn(collapsed && !mobile && 'lg:hidden', 'min-w-0 max-w-full', mobile ? 'w-full whitespace-normal break-words text-center hyphens-manual' : 'truncate')}>{mobile ? item.mobileLabel || (item.label === 'Уведомления' ? 'Уведом\u00adления' : item.label) : item.label}</span>
      {!!item.badge && item.badge > 0 && <span className={cn('rounded-full bg-[var(--color-danger)] px-1.5 text-[10px] font-bold text-white', mobile ? 'absolute right-1 top-1' : 'ml-auto')}>{item.badge > 99 ? '99+' : item.badge}</span>}
    </ShellLink>;
  };
  return <div className={cn('flex min-h-screen bg-[var(--color-background)] text-[var(--color-text)]', className)}>
    {drawerOpen && <div className="fixed inset-0 z-[var(--z-sticky)] bg-slate-950/30 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
    <aside ref={sidebarRef} aria-label="Все разделы" role={drawerOpen ? 'dialog' : undefined} aria-modal={drawerOpen || undefined} className={cn('fixed inset-y-0 left-0 z-[var(--z-overlay)] shrink-0 w-72 max-w-[85vw] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:sticky lg:top-0 lg:h-screen lg:max-w-none', drawerOpen ? 'flex' : 'hidden lg:flex', collapsed ? 'lg:w-[76px]' : 'lg:w-64')}>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
        <ShellLink href={homeHref} className={cn("flex min-h-11 min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] font-bold tracking-tight", collapsed && "lg:hidden")}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] text-xs font-bold text-white">Н</span><span className={collapsed ? 'lg:hidden' : ''}>NaPare</span></ShellLink>
        <button type="button" onClick={() => setDrawerOpen(false)} className={cn(control, 'lg:hidden')} aria-label="Закрыть меню"><Icon name="close" /></button>
        <button type="button" onClick={() => setCollapsed(!collapsed)} className={cn(control, 'hidden lg:inline-flex')} aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'} aria-pressed={collapsed}><Icon name={collapsed ? 'chevron-right' : 'chevron-left'} /></button>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label={'Навигация: ' + roleLabel}>
        {groups.map((group) => <section key={group.label}><p className={cn('mb-1 px-3 text-xs font-semibold text-[var(--color-text-muted)]', collapsed && 'lg:hidden')}>{group.label}</p><div className="space-y-0.5">{group.items.filter((item) => !item.disabled).map((item) => <div key={item.href}>{renderLink(item)}</div>)}</div></section>)}
      </nav>
      <div className="shrink-0 border-t border-[var(--color-border)] p-3"><p className={cn('truncate px-3 text-sm font-semibold', collapsed && 'lg:hidden')}>{user?.name || roleLabel}</p><p className={cn('truncate px-3 text-xs text-[var(--color-text-secondary)]', collapsed && 'lg:hidden')}>{user?.role || roleLabel}</p>{help && <button type="button" className={cn(control, 'mt-2 w-full gap-2')} onClick={() => { setDrawerOpen(false); setHelpOpen(true); }} title="Как пользоваться кабинетом"><Icon name="info" /><span className={collapsed ? 'lg:hidden' : ''}>Помощь по кабинету</span></button>}{onLogout && <button type="button" className={cn(control, 'w-full')} onClick={onLogout}>Выйти</button>}</div>
    </aside>
    <div ref={contentRef} className="min-w-0 flex-1">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-modal)] focus:rounded-lg focus:bg-[var(--color-surface)] focus:p-3">К содержимому</a>
      <header className="sticky top-0 z-[var(--z-sticky)] flex h-16 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 sm:gap-3 lg:px-7">
        <button type="button" onClick={() => setDrawerOpen(true)} className={cn(control, 'lg:hidden')} aria-label="Все разделы" aria-expanded={drawerOpen}><Icon name="menu" /></button>
        <div className="min-w-0 flex-1 lg:flex-none"><p className="truncate text-xs text-[var(--color-text-muted)]">{roleLabel}</p><p className="truncate text-base font-semibold"><span className="lg:hidden">{currentItem?.mobileLabel || currentItem?.label || roleLabel}</span><span className="hidden lg:inline">{currentItem?.label || roleLabel}</span></p></div>
        <button type="button" onClick={() => setPaletteOpen(true)} className={cn(control, 'lg:ml-auto lg:max-w-lg lg:flex-1 lg:justify-between lg:gap-3 lg:border lg:border-[var(--color-border)] lg:px-3')} aria-label="Поиск по кабинету"><Icon name="search" /><span className="hidden min-w-0 flex-1 truncate text-left text-sm lg:block">{searchPlaceholder}</span><kbd className="hidden text-xs lg:block">Ctrl/⌘ K</kbd></button>
        {status && <span className={cn('hidden text-xs xl:block', status.tone === 'danger' ? 'text-[var(--color-danger)]' : status.tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]')}>{status.label}</span>}
        {help && <button type="button" onClick={() => setHelpOpen(true)} className={cn(control, 'hidden sm:inline-flex')} aria-label="Как пользоваться кабинетом"><Icon name="info" /></button>}
        <ShellLink href={notificationHref || allNavItems.find((item) => item.href === '/notifications')?.href || homeHref} className={cn(control, 'relative')} aria-label={'Уведомления' + (unreadCount ? ': ' + unreadCount + ' непрочитанных' : '')}><Icon name="bell" />{unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-danger)]" />}</ShellLink>
        <div className="relative"><button type="button" onClick={() => setProfileOpen(!profileOpen)} className={control} aria-label="Меню аккаунта" aria-expanded={profileOpen}><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-xs font-semibold text-[var(--color-brand)]">{initials(user?.name || roleLabel)}</span></button>
          {profileOpen && <div className="absolute right-0 top-full mt-2 w-60 max-w-[85vw] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-md)]"><p className="break-words px-3 py-2 text-sm font-semibold">{user?.name || roleLabel}</p>{allNavItems.filter((item) => ['/profile', '/settings', '/connections', '/university'].includes(item.href)).map((item) => <ShellLink key={item.href} href={item.href} onClick={() => setProfileOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-[var(--color-surface-secondary)]">{item.label}</ShellLink>)}{help && <button className={cn(control, 'w-full justify-start px-3 text-sm')} type="button" onClick={() => { setProfileOpen(false); setHelpOpen(true); }}>Помощь по кабинету</button>}{onLogout && <button className={cn(control, 'w-full justify-start px-3 text-sm')} type="button" onClick={onLogout}>Выйти</button>}</div>}
        </div>
      </header>
      <main id="workspace-content" tabIndex={-1} className={cn('ds-page-enter mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-7', mobileItems.length ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-7' : 'pb-6')}>
        {showWelcome && pathname.replace(/\/$/, "") === homeHref.replace(/\/$/, "") && help && <section aria-label="Знакомство с кабинетом" className="relative mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="min-w-0 pr-10"><p className="font-semibold">{help.title}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{help.description}</p></div><button className={cn(control, 'mt-2 gap-2 px-3 text-sm')} type="button" onClick={() => setHelpOpen(true)}><Icon name="info" />Как начать</button><button className={cn(control, 'absolute right-2 top-2')} type="button" onClick={dismissWelcome} aria-label="Скрыть приветствие"><Icon name="close" /></button></section>}
        {children}
      </main>
      {!!mobileItems.length && <nav aria-label="Основные разделы" className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] grid grid-cols-5 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">{mobileItems.map((item) => <div key={item.href} className="min-w-0">{renderLink(item, true)}</div>)}<button type="button" className={cn(control, 'min-h-[52px] min-w-0 flex-col gap-1 py-1 text-[10px] leading-3')} onClick={() => setDrawerOpen(true)} aria-label="Ещё разделы" aria-expanded={drawerOpen}><Icon name="menu" />Ещё</button></nav>}
    </div>
    {(paletteOpen || helpOpen) && <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-[6svh] sm:p-6 sm:pt-[10svh]" onClick={() => { setPaletteOpen(false); setHelpOpen(false); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={paletteOpen ? 'Поиск по кабинету' : 'Как пользоваться кабинетом'} className="w-full max-w-xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]" onClick={(event) => event.stopPropagation()}>
        {paletteOpen ? <><div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3"><Icon name="search" /><input ref={inputRef} value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} onKeyDown={handlePaletteKeyDown} className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]" placeholder={searchPlaceholder} aria-label="Поиск по кабинету" aria-describedby="workspace-search-status" autoComplete="off" /><button type="button" className={control} onClick={() => setPaletteOpen(false)} aria-label="Закрыть поиск"><Icon name="close" /></button></div>
          <div id="workspace-search-status" role="status" className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{searchState === 'loading' ? 'Ищем занятия и материалы…' : onSearch && queryTerm.length < 2 ? 'Разделы доступны сразу. Для поиска занятий и материалов введите от 2 символов.' : filteredCommands.length + ' результатов'}</div>
          {searchState === 'error' && <div role="alert" className="mx-3 mb-2 rounded-lg bg-[var(--color-warning-soft)] p-3 text-sm">Не удалось найти занятия и материалы. Разделы кабинета доступны ниже.<button type="button" className={cn(control, 'ml-2 px-3 text-sm')} onClick={() => setSearchAttempt((value) => value + 1)}>Повторить</button></div>}
          <div className="max-h-[min(28rem,55svh)] overflow-y-auto p-2">{filteredCommands.map((command, index) => { const body = <><Icon name={command.icon || 'arrow-right'} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{command.label}</span>{command.description && <span className="block truncate text-xs text-[var(--color-text-secondary)]">{command.description}</span>}</span></>; const style = cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]', selectedIndex === index ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : 'hover:bg-[var(--color-surface-secondary)]'); return <div key={command.id} data-command-index={index}>{command.href ? <ShellLink href={command.href} onClick={() => selectCommand(command)} className={style}>{body}</ShellLink> : <button type="button" onClick={() => selectCommand(command)} className={style}>{body}</button>}</div>; })}
            {!filteredCommands.length && searchState !== 'loading' && <p className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]">Ничего не найдено. Попробуйте название предмета, преподавателя или раздела.</p>}
          </div><p className="border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-muted)]">↑↓ выбрать · Enter открыть · Esc закрыть</p></> : help && <><div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-4"><h2 className="text-lg font-semibold">{help.title}</h2><button type="button" className={control} onClick={() => setHelpOpen(false)} aria-label="Закрыть помощь"><Icon name="close" /></button></div><div className="max-h-[65svh] space-y-4 overflow-y-auto p-5"><p className="text-sm text-[var(--color-text-secondary)]">{help.description}</p><ol className="space-y-3">{help.steps.map((step, index) => <li key={step.href}><ShellLink href={step.href} onClick={() => { setHelpOpen(false); dismissWelcome(); }} className="flex min-h-11 gap-3 rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface-secondary)]"><span className="text-sm font-semibold text-[var(--color-brand)]">{index + 1}</span><span className="min-w-0"><span className="block text-sm font-semibold">{step.title}</span><span className="block text-sm text-[var(--color-text-secondary)]">{step.description}</span></span><Icon name="arrow-right" className="ml-auto shrink-0" /></ShellLink></li>)}</ol><p className="text-xs text-[var(--color-text-secondary)]">Поиск в шапке открывается также по Ctrl/⌘ K. Все разделы доступны в меню «Ещё» на телефоне.</p></div></>}
      </div>
    </div>}
  </div>;
}
