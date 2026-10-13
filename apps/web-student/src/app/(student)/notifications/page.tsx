'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { useRouter } from 'next/navigation';
import { apiFetchList, markAllRead, markNotificationRead } from '@/lib/api';
import { getInternalHref } from '../internal-navigation';
import { Badge, Button, EmptyState, Icon, IconName, RequestState, Skeleton } from '@/components/ui';

type Notification = { id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string; deepLink?: string; priority?: string; category?: string; };
interface NotificationCache {
  savedAt: string;
  notifications: Notification[];
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
  const router = useRouter(); const [notifications, setNotifications] = useState<Notification[]>([]); const [loading, setLoading] = useState(true); const [cacheRefreshing, setCacheRefreshing] = useState(false); const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null); const [isOnline, setIsOnline] = useState(true); const [error, setError] = useState(''); const [tab, setTab] = useState('all'); const [busy, setBusy] = useState(false);
  useWorkspaceQuery({ filter: tab }, query => setTab(tabs.some(([id]) => id === query.get('filter')) ? query.get('filter')! : 'all'));
  const cacheKeyRef = useRef<string | null>(null); const cacheRef = useRef<NotificationCache | null>(null); const loadInFlightRef = useRef(false);
  const load = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const cached = cacheRef.current;
    setError('');
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
      const data = (await apiFetchList<Notification>('/notifications')).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const nextCache: NotificationCache = { savedAt: new Date().toISOString(), notifications: data, pendingReadAll: false, pendingReadIds: [] };
      cacheRef.current = nextCache;
      storeNotificationCache(cacheKeyRef.current, nextCache);
      setNotifications(data);
      setOfflineSavedAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить уведомления.');
      if (cached) {
        setNotifications(cached.notifications);
        setOfflineSavedAt(cached.savedAt);
      }
    } finally {
      setLoading(false);
      setCacheRefreshing(false);
      loadInFlightRef.current = false;
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
        setOfflineSavedAt(value.savedAt);
        setLoading(false);
      }
    } catch { /* Corrupt or unavailable local cache should not block the server request. */ }
    void load();
  }, [load]);
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); void load(); };
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [load]);
  const filtered = useMemo(() => notifications.filter(notification => tab === 'all' ? true : tab === 'unread' ? !notification.isRead : tab === 'important' ? ['high','urgent'].includes(notification.priority || '') || notification.category === 'important' : tabTypes[tab]?.includes(notification.type)), [notifications, tab]);
  const grouped = useMemo(() => ['Сегодня', 'Вчера', 'Ранее'].map(label => ({ label, items: filtered.filter(item => groupName(item.createdAt) === label) })).filter(group => group.items.length), [filtered]);
  const unread = notifications.filter(item => !item.isRead).length; const pendingSyncMessage = cacheRef.current?.pendingReadAll ? "Отметка всех уведомлений синхронизируется при восстановлении сети." : cacheRef.current?.pendingReadIds.length ? `${cacheRef.current.pendingReadIds.length} отметок прочтения ожидают соединения.` : "";
  const openNotification = async (notification: Notification, navigate = true) => { if (!notification.isRead) { if (typeof navigator !== 'undefined' && !navigator.onLine && cacheRef.current) { const nextNotifications = notifications.map(item => item.id === notification.id ? { ...item, isRead: true } : item); const nextCache = { ...cacheRef.current, notifications: nextNotifications, pendingReadIds: [...new Set([...cacheRef.current.pendingReadIds, notification.id])] }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); setNotifications(nextNotifications); } else { try { await markNotificationRead(notification.id); const nextNotifications = notifications.map(item => item.id === notification.id ? { ...item, isRead: true } : item); setNotifications(nextNotifications); if (cacheRef.current) { const nextCache = { ...cacheRef.current, notifications: nextNotifications }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); } } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось отметить уведомление прочитанным.'); return; } } } const href = getInternalHref(notification.deepLink); if (navigate && href) router.push(href); };
  const markEverythingRead = async () => { setBusy(true); try { if (typeof navigator !== 'undefined' && !navigator.onLine && cacheRef.current) { const nextNotifications = notifications.map(item => ({ ...item, isRead: true })); const nextCache = { ...cacheRef.current, notifications: nextNotifications, pendingReadAll: true, pendingReadIds: [] }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); setNotifications(nextNotifications); } else { await markAllRead(); const nextNotifications = notifications.map(item => ({ ...item, isRead: true })); setNotifications(nextNotifications); if (cacheRef.current) { const nextCache = { ...cacheRef.current, notifications: nextNotifications, pendingReadAll: false, pendingReadIds: [] }; cacheRef.current = nextCache; storeNotificationCache(cacheKeyRef.current, nextCache); } } } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось обновить уведомления.'); } finally { setBusy(false); } };
  const item = (notification: Notification) => <article key={notification.id} className={`group rounded-2xl border p-4 text-left transition hover:border-indigo-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${notification.isRead ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/30'}`}><div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}><Icon name={icons[notification.type] || 'Bell'} className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:gap-3"><div className="flex min-w-0 items-center gap-2"><h2 className="break-words text-sm font-semibold text-slate-900">{notification.title}</h2>{!notification.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="Непрочитано"/>}</div><time className="shrink-0 text-xs text-slate-400">{ago(notification.createdAt)}</time></div><p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>{['high','urgent'].includes(notification.priority || '') && <Badge variant="danger">{notification.priority === 'urgent' ? 'Срочно' : 'Важно'}</Badge>}<div className="mt-3 flex flex-wrap gap-2">{ctaLabel(notification) && <button type="button" onClick={() => void openNotification(notification)} className="min-h-11 rounded-xl border border-indigo-200 px-3 text-sm font-semibold text-indigo-700">{ctaLabel(notification)} →</button>}{!notification.isRead && <button type="button" onClick={() => void openNotification(notification,false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">Отметить прочитанным</button>}</div></div></div></article>;
  return <div className="mx-auto max-w-[1400px] space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium text-slate-400">НаПаре / Уведомления</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Уведомления</h1><p className="mt-2 text-sm text-slate-500">{loading ? 'Загружаем события…' : unread ? `${unread} непрочитанных` : 'Все уведомления прочитаны'}</p></div>{unread > 0 && <Button variant="ghost" size="sm" loading={busy} onClick={() => void markEverythingRead()}>Отметить все прочитанными</Button>}</header>{offlineSavedAt && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status"><span>{cacheRefreshing ? "Сохранённая копия · проверяем актуальность" : `${isOnline ? "Сохранённая копия" : "Офлайн"} · последнее обновление ${new Date(offlineSavedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}`}{error ? ` · ${error}` : ""}{pendingSyncMessage ? ` · ${pendingSyncMessage}` : ""}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Обновить</button></div>}<div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1" role="group" aria-label="Фильтр уведомлений">{tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`min-h-10 shrink-0 rounded-xl px-3 text-sm font-semibold transition ${tab === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>{label}{id === 'unread' && unread > 0 && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${tab === id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>{unread}</span>}</button>)}</div>{loading ? <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl"/>)}</div></div> : error && !cacheRef.current ? <RequestState title="Не удалось загрузить уведомления" description={error} onRetry={load}/> : <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0 space-y-7">{grouped.length ? grouped.map(group => <div key={group.label}><h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{group.label}</h2><div className="space-y-3">{group.items.map(item)}</div></div>) : <EmptyState icon={<Icon name="Bell" className="h-8 w-8"/>} title="Уведомлений не найдено" description="Попробуйте выбрать другой фильтр."/>}</section><aside className="hidden xl:block"><section className="student-panel p-5"><h2 className="text-base font-bold text-slate-950">Настройте поток событий</h2><p className="mt-3 text-sm leading-6 text-slate-600">Выберите нужные категории и канал доставки. Важные изменения доступны здесь даже без подключённого мессенджера.</p><Link href="/settings?section=notifications" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700">Настройки уведомлений →</Link><a href="/connections" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700">Подключить сайт →</a></section></aside></div>}</div>;
}
