'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { useRouter } from 'next/navigation';
import { apiFetch, getUnreadCount, markAllRead, markNotificationRead } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api';
import { getInternalHref } from '../internal-navigation';
import { Badge, Icon, IconName, RequestState, Skeleton } from '@/components/ui';
import { EmptyState, Button } from '@napare/ui';

type Notification = { id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string; deepLink?: string; priority?: string; category?: string; };
interface NotificationCache {
  savedAt: string;
  notifications: Notification[];
  loadedPage?: number;
  total?: number;
  totalPages?: number;
  unreadCount?: number;
  pendingReadAll: boolean;
  pendingReadIds: string[];
}

function notificationCacheKey(): string | null {
  try {
    const encodedClaims = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!encodedClaims) return null;
    const normalized = encodedClaims.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `napare:student-notifications:${encodeURIComponent(claims.universityId)}:${encodeURIComponent(claims.sub)}`;
  } catch {
    return null;
  }
}

function isNotificationCache(value: unknown): value is NotificationCache {
  if (!value || typeof value !== 'object') return false;
  const cache = value as Partial<NotificationCache>;
  return typeof cache.savedAt === 'string'
    && Array.isArray(cache.notifications)
    && cache.notifications.every(notification => !!notification && typeof notification === 'object' && typeof notification.id === 'string' && typeof notification.title === 'string' && typeof notification.body === 'string' && typeof notification.type === 'string' && typeof notification.isRead === 'boolean' && typeof notification.createdAt === 'string')
    && (cache.loadedPage === undefined || (typeof cache.loadedPage === 'number' && Number.isInteger(cache.loadedPage) && cache.loadedPage >= 0))
    && (cache.total === undefined || (typeof cache.total === 'number' && Number.isInteger(cache.total) && cache.total >= 0))
    && (cache.totalPages === undefined || (typeof cache.totalPages === 'number' && Number.isInteger(cache.totalPages) && cache.totalPages >= 0))
    && (cache.unreadCount === undefined || (typeof cache.unreadCount === 'number' && Number.isInteger(cache.unreadCount) && cache.unreadCount >= 0))
    && typeof cache.pendingReadAll === 'boolean'
    && Array.isArray(cache.pendingReadIds)
    && cache.pendingReadIds.every(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}

function storeNotificationCache(key: string | null, cache: NotificationCache): void {
  if (!key) return;
  try { window.localStorage.setItem(key, JSON.stringify(cache)); } catch { /* Keep the live notification list usable if local storage is unavailable. */ }
}
const icons: Record<string, IconName> = { schedule_change: 'CalendarDays', new_announcement: 'Megaphone', new_homework: 'FileText', new_file: 'Paperclip', deadline: 'Clock', absence_decision: 'ClipboardCheck', new_absence: 'XCircle', system: 'Settings', other: 'Bell' };
const tabs = [['all', 'Все'], ['important', 'Важное'], ['unread', 'Непрочитанные'], ['schedule', 'Расписание'], ['homework', 'Подготовка'], ['messages', 'Сообщения'], ['system', 'Система']];
const tabTypes: Record<string, string[]> = { schedule: ['schedule_change'], homework: ['new_homework', 'deadline'], messages: ['new_announcement', 'new_file'], system: ['system'] };
const ago = (value: string) => { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return 'только что'; if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`; if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`; return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); };
const groupName = (value: string) => { const date = new Date(value); const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1); if (date.toDateString() === today.toDateString()) return 'Сегодня'; if (date.toDateString() === yesterday.toDateString()) return 'Вчера'; return 'Ранее'; };
const ctaLabel = (notification: Notification) => notification.type === 'schedule_change' ? (getInternalHref(notification.deepLink)?.includes('/pair-space/') ? 'Посмотреть изменения пары' : 'Открыть расписание') : getInternalHref(notification.deepLink) ? 'Открыть' : '';

export default function NotificationsPage() {
  const router = useRouter(); const [notifications, setNotifications] = useState<Notification[]>([]); const [loading, setLoading] = useState(true); const [cacheRefreshing, setCacheRefreshing] = useState(false); const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null); const [isOnline, setIsOnline] = useState(true); const [error, setError] = useState(''); const [unreadCountError, setUnreadCountError] = useState(''); const [unreadCount, setUnreadCount] = useState<number | null>(null); const [loadMoreError, setLoadMoreError] = useState(''); const [loadedPage, setLoadedPage] = useState(1); const [totalCount, setTotalCount] = useState(0); const [totalPages, setTotalPages] = useState(1); const [loadingMore, setLoadingMore] = useState(false); const [tab, setTab] = useState('all'); const [busy, setBusy] = useState(false);
  useWorkspaceQuery({ filter: tab }, query => setTab(tabs.some(([id]) => id === query.get('filter')) ? query.get('filter')! : 'all'));
  const cacheKeyRef = useRef<string | null>(null); const cacheRef = useRef<NotificationCache | null>(null); const loadInFlightRef = useRef(false); const retryWhenIdleRef = useRef(false);
  const load = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const cached = cacheRef.current;
    setError('');
    setUnreadCountError('');
    if (cached) setCacheRefreshing(true); else setLoading(true);
    try {
      if (cached?.pendingReadAll) {
        await markAllRead();
        cached.pendingReadAll = false;
        cached.pendingReadIds = [];
        storeNotificationCache(cacheKeyRef.current, cached);
      } else if (cached?.pendingReadIds.length) {
        const completed = new Set<string>();
        for (const id of cached.pendingReadIds) {
          await markNotificationRead(id);
          completed.add(id);
          cached.pendingReadIds = cached.pendingReadIds.filter(pendingId => !completed.has(pendingId));
          storeNotificationCache(cacheKeyRef.current, cached);
        }
      }
      const pageSize = 50;
      const pagesToRefresh = Math.max(1, cached?.loadedPage ?? 1);
      const data: Notification[] = [];
      let latestTotalPages = 1;
      let latestTotal = 0;
      for (let page = 1; page <= pagesToRefresh; page += 1) {
        const result = await apiFetch<PaginatedResponse<Notification>>(`/notifications?page=${page}&limit=${pageSize}`);
        data.push(...result.data);
        latestTotal = result.meta.total;
        latestTotalPages = result.meta.totalPages;
        if (page >= latestTotalPages) break;
      }
      const uniqueData = [...new Map(data.map(notification => [notification.id, notification])).values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastLoadedPage = Math.min(pagesToRefresh, latestTotalPages);
      const nextCache: NotificationCache = { savedAt: new Date().toISOString(), notifications: uniqueData, loadedPage: lastLoadedPage, total: latestTotal, totalPages: latestTotalPages, pendingReadAll: false, pendingReadIds: [] };
      cacheRef.current = nextCache;
      storeNotificationCache(cacheKeyRef.current, nextCache);
      setNotifications(uniqueData);
      setLoadedPage(lastLoadedPage);
      setTotalCount(latestTotal);
      setTotalPages(latestTotalPages);
      setLoadMoreError('');
      setOfflineSavedAt(null);
      try {
        const latestUnreadCount = await getUnreadCount();
        const countedCache = { ...nextCache, unreadCount: latestUnreadCount };
        cacheRef.current = countedCache;
        storeNotificationCache(cacheKeyRef.current, countedCache);
        setUnreadCount(latestUnreadCount);
      } catch (countError) {
        setUnreadCountError(countError instanceof Error ? countError.message : 'Не удалось обновить счётчик непрочитанных.');
      }
    } catch (err) {
      setError(typeof navigator !== 'undefined' && !navigator.onLine
        ? 'Нет подключения к интернету. Сохранённые уведомления останутся доступны, а новые загрузятся после восстановления сети.'
        : err instanceof Error ? err.message : 'Не удалось обновить уведомления.');
      if (cached) {
        setNotifications(cached.notifications);
        setOfflineSavedAt(cached.savedAt);
      }
    } finally {
      setLoading(false);
      setCacheRefreshing(false);
      loadInFlightRef.current = false;
      if (retryWhenIdleRef.current && navigator.onLine) {
        retryWhenIdleRef.current = false;
        window.setTimeout(() => void load(), 0);
      }
    }
  }, []);
  useEffect(() => {
    const key = notificationCacheKey();
    cacheKeyRef.current = key;
    try {
      const raw = key ? window.localStorage.getItem(key) : null;
      const value: unknown = raw ? JSON.parse(raw) : null;
      if (isNotificationCache(value)) {
        cacheRef.current = value;
        setNotifications(value.notifications);
        setLoadedPage(value.loadedPage ?? 1);
        setTotalCount(value.total ?? value.notifications.length);
        setTotalPages(value.totalPages ?? 1);
        setUnreadCount(typeof value.unreadCount === 'number' ? value.unreadCount : null);
        setOfflineSavedAt(value.savedAt);
        setLoading(false);
      }
    } catch { /* Corrupt or unavailable local cache should not block the server request. */ }
    void load();
  }, [load]);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (loadInFlightRef.current) retryWhenIdleRef.current = true;
      else void load();
    };
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [load]);
  const filtered = useMemo(() => notifications.filter(notification => tab === 'all' ? true : tab === 'unread' ? !notification.isRead : tab === 'important' ? ['high','urgent'].includes(notification.priority || '') || notification.category === 'important' : tabTypes[tab]?.includes(notification.type)), [notifications, tab]);
  const loadMore = async () => {
    if (loadInFlightRef.current || loadingMore || loadedPage >= totalPages) return;
    loadInFlightRef.current = true;
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const nextPage = loadedPage + 1;
      const result = await apiFetch<PaginatedResponse<Notification>>(`/notifications?page=${nextPage}&limit=50`);
      const merged = [...new Map([...notifications, ...result.data].map(notification => [notification.id, notification])).values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const nextCache: NotificationCache = { ...(cacheRef.current ?? { pendingReadAll: false, pendingReadIds: [] }), savedAt: new Date().toISOString(), notifications: merged, loadedPage: nextPage, total: result.meta.total, totalPages: result.meta.totalPages };
      cacheRef.current = nextCache;
      storeNotificationCache(cacheKeyRef.current, nextCache);
      setNotifications(merged);
      setLoadedPage(nextPage);
      setTotalCount(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err.message : 'Не удалось загрузить предыдущие уведомления.');
    } finally {
      setLoadingMore(false);
      loadInFlightRef.current = false;
      if (retryWhenIdleRef.current && navigator.onLine) {
        retryWhenIdleRef.current = false;
        window.setTimeout(() => void load(), 0);
      }
    }
  };
  const grouped = useMemo(() => ['Сегодня', 'Вчера', 'Ранее'].map(label => ({ label, items: filtered.filter(item => groupName(item.createdAt) === label) })).filter(group => group.items.length), [filtered]);
  const loadedUnreadCount = notifications.filter(item => !item.isRead).length;
  const visibleUnreadCount = unreadCount ?? loadedUnreadCount;
  const pendingSyncMessage = cacheRef.current?.pendingReadAll ? "Отметка всех уведомлений синхронизируется при восстановлении сети." : cacheRef.current?.pendingReadIds.length ? `${cacheRef.current.pendingReadIds.length} отметок прочтения ожидают соединения.` : "";
  const openNotification = async (notification: Notification, navigate = true) => { if (!notification.isRead) { if (typeof navigator !== 'undefined' && !navigator.onLine && cacheRef.current) { const nextNotifications = notifications.map(item => item.id === notification.id ? { ...item, isRead: true } : item); const baseCount = cacheRef.current.unreadCount ?? unreadCount; const nextUnreadCount = baseCount === null || baseCount === undefined ? undefined : Math.max(0, baseCount - 1); const nextCache = { ...cacheRef.current, notifications: nextNotifications, ...(nextUnreadCount === undefined ? {} : { unreadCount: nextUnreadCount }), pendingReadIds: [...new Set([...cacheRef.current.pendingReadIds, notification.id])] }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); setNotifications(nextNotifications); if (nextUnreadCount !== undefined) setUnreadCount(nextUnreadCount); } else { try { await markNotificationRead(notification.id); const nextNotifications = notifications.map(item => item.id === notification.id ? { ...item, isRead: true } : item); const baseCount = cacheRef.current?.unreadCount ?? unreadCount; const nextUnreadCount = baseCount === null || baseCount === undefined ? undefined : Math.max(0, baseCount - 1); setNotifications(nextNotifications); if (nextUnreadCount !== undefined) setUnreadCount(nextUnreadCount); if (cacheRef.current) { const nextCache = { ...cacheRef.current, notifications: nextNotifications, ...(nextUnreadCount === undefined ? {} : { unreadCount: nextUnreadCount }) }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); } } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось отметить уведомление прочитанным.'); return; } } } const href = getInternalHref(notification.deepLink); if (navigate && href) router.push(href); };
  const markEverythingRead = async () => { setBusy(true); try { if (typeof navigator !== 'undefined' && !navigator.onLine && cacheRef.current) { const nextNotifications = notifications.map(item => ({ ...item, isRead: true })); const nextCache = { ...cacheRef.current, unreadCount: 0, notifications: nextNotifications, pendingReadAll: true, pendingReadIds: [] }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); setNotifications(nextNotifications); setUnreadCount(0); } else { await markAllRead(); const nextNotifications = notifications.map(item => ({ ...item, isRead: true })); setNotifications(nextNotifications); setUnreadCount(0); if (cacheRef.current) { const nextCache = { ...cacheRef.current, unreadCount: 0, notifications: nextNotifications, pendingReadAll: false, pendingReadIds: [] }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); } } } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось обновить уведомления.'); } finally { setBusy(false); } };
  const item = (notification: Notification) => <article key={notification.id} className={`group rounded-2xl border p-4 text-left transition hover:border-indigo-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${notification.isRead ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/30'}`}><div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}><Icon name={icons[notification.type] || 'Bell'} className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:gap-3"><div className="flex min-w-0 items-center gap-2"><h2 className="break-words text-sm font-semibold text-slate-900">{notification.title}</h2>{!notification.isRead && <><span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-hidden="true"/><span className="sr-only">Непрочитано</span></>}</div><time dateTime={notification.createdAt} className="shrink-0 text-xs text-slate-400">{ago(notification.createdAt)}</time></div><p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>{['high','urgent'].includes(notification.priority || '') && <Badge variant="danger">{notification.priority === 'urgent' ? 'Срочно' : 'Важно'}</Badge>}<div className="mt-3 flex flex-wrap gap-2">{ctaLabel(notification) && <button type="button" onClick={() => void openNotification(notification)} className="min-h-11 rounded-xl border border-indigo-200 px-3 text-sm font-semibold text-indigo-700">{ctaLabel(notification)} →</button>}{!notification.isRead && <button type="button" onClick={() => void openNotification(notification,false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">Отметить прочитанным</button>}</div></div></div></article>;
  return <div className="mx-auto max-w-[1400px] space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Уведомления</h1><p className="mt-2 text-sm text-slate-500">{loading ? 'Загружаем события…' : unreadCount !== null ? (unreadCount ? `${unreadCount} непрочитанных` : 'Все уведомления прочитаны') : unreadCountError ? 'Не удалось проверить непрочитанные' : loadedUnreadCount ? `${loadedUnreadCount} непрочитанных в загруженных событиях` : 'Непрочитанных в загруженных событиях нет'}</p></div>{visibleUnreadCount > 0 && <Button variant="ghost" size="sm" loading={busy} onClick={() => void markEverythingRead()}>Отметить все прочитанными</Button>}</header>{offlineSavedAt && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status"><span>{cacheRefreshing ? "Сохранённая копия · проверяем актуальность" : `${isOnline ? "Сохранённая копия" : "Офлайн"} · последнее обновление ${new Date(offlineSavedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}`}{error ? ` · ${error}` : ""}{unreadCountError ? ` · ${unreadCountError}` : ""}{pendingSyncMessage ? ` · ${pendingSyncMessage}` : ""}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Обновить</button></div>}{unreadCountError && !offlineSavedAt && <p role="status" className="text-sm text-amber-700">Счётчик непрочитанных не обновлён. {unreadCount !== null ? `Последнее значение: ${unreadCount}.` : 'Показано количество среди уже загруженных событий.'}</p>}<div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1" role="group" aria-label="Фильтр уведомлений">{tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold transition ${tab === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>{label}{id === 'unread' && visibleUnreadCount > 0 && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${tab === id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>{visibleUnreadCount}</span>}</button>)}</div>{loading ? <div className="grid min-w-0 grid-cols-1 gap-6 "><div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl"/>)}</div></div> : error && !cacheRef.current ? <RequestState title="Не удалось загрузить уведомления" description={error} onRetry={load}/> : <div className="grid min-w-0 grid-cols-1 gap-6 "><section className="min-w-0 space-y-7">{grouped.length ? grouped.map(group => <div key={group.label}><h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{group.label}</h2><div className="space-y-3">{group.items.map(item)}</div></div>) : <EmptyState icon={<Icon name="Bell" className="h-8 w-8"/>} title={notifications.length ? "По этому фильтру ничего нет" : "Уведомлений пока нет"} />}{loadMoreError && <p role="alert" className="text-sm text-red-700">{loadMoreError}</p>}{loadedPage < totalPages && <div className="space-y-2 text-center"><Button variant="secondary" disabled={!isOnline} loading={loadingMore} onClick={() => void loadMore()}>Загрузить предыдущие</Button><p className="text-xs text-slate-500">Показано {notifications.length} из {totalCount}</p></div>}</section></div>}</div>;
}
