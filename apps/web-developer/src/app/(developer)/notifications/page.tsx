'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, PageHeader, RequestState, Skeleton } from '@/components/ui';
import { apiFetch } from '@/lib/api';

interface Notification { id: string; title?: string; body?: string; createdAt?: string; isRead?: boolean; deepLink?: string | null; actions?: Array<{ label?: string; href?: string }> | null; }
interface NotificationPage { data: Notification[]; meta: { page: number; total: number; totalPages: number } }

function safeDeveloperHref(value?: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const url = new URL(value, 'https://napare.invalid');
    if (url.origin !== 'https://napare.invalid') return null;
    const pathname = url.pathname === '/developer' ? '/overview' : url.pathname.startsWith('/developer/') ? url.pathname.slice('/developer'.length) : url.pathname;
    const routes = ['/overview', '/control', '/api', '/architecture', '/docs', '/notifications', '/session'];
    if (!routes.some(route => pathname === route || pathname.startsWith(`${route}/`))) return null;
    return `${pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

function actionFor(item: Notification) {
  const action = item.actions?.find(candidate => safeDeveloperHref(candidate.href));
  const href = safeDeveloperHref(action?.href) || safeDeveloperHref(item.deepLink);
  if (!href) return null;
  const label = action?.label?.trim();
  return { href, label: label && label.length <= 50 ? label : 'Открыть событие' };
}

function dateLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Дата не указана';
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DeveloperNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true); setLoadError('');
    try {
      const response = await apiFetch<NotificationPage | { data: Notification[]; meta?: NotificationPage['meta'] } | Notification[]>(`/notifications?page=${page}&limit=50`);
      if (requestId !== requestSequence.current) return;
      const data = Array.isArray(response) ? response : response.data;
      const meta = Array.isArray(response) ? undefined : response.meta;
      setItems(data);
      setTotal(meta?.total ?? data.length);
      setPages(Math.max(1, meta?.totalPages ?? 1));
      if (meta) setPage(current => Math.min(current, Math.max(1, meta.totalPages)));
      void apiFetch<{ count: number }>('/notifications/unread-count').then(result => { if (requestId === requestSequence.current) setUnreadCount(result.count); }).catch(() => undefined);
    }
    catch (reason) {
      if (requestId === requestSequence.current) setLoadError(reason instanceof Error ? reason.message : 'Не удалось загрузить уведомления.');
    }
    finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); return () => { requestSequence.current += 1; }; }, [load]);
  const groups = useMemo(() => {
    const result = new Map<string, Notification[]>();
    [...items].filter(item => !unreadOnly || !item.isRead).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).forEach(item => {
      const label = dateLabel(item.createdAt);
      result.set(label, [...(result.get(label) || []), item]);
    });
    return [...result];
  }, [items, unreadOnly]);
  const markRead = async (id: string) => {
      const wasUnread = items.some(item => item.id === id && !item.isRead);
      setSavingId(id); setStatus(''); setActionError('');
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems(current => current.map(item => item.id === id ? { ...item, isRead: true } : item));
      if (wasUnread) setUnreadCount(current => Math.max(0, current - 1));
      setStatus('Уведомление отмечено прочитанным.');
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Не удалось сохранить отметку. Попробуйте ещё раз.'); }
    finally { setSavingId(''); }
  };
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
    <PageHeader eyebrow="Разработчик · аккаунт" title="Уведомления" description="События вашего аккаунта. Общий журнал платформы находится в разделе «Состояние системы»." actions={<Button variant="secondary" loading={loading} onClick={() => void load()}>Обновить</Button>} />
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} className="h-5 w-5 accent-[var(--color-brand)]" />Только непрочитанные</label><Badge>{unreadCount} непрочитанных</Badge></div>
    <p role="status" className="text-sm text-[var(--color-text-secondary)]">{status}</p>
    {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
    {loadError && items.length > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Не удалось обновить уведомления. Показаны ранее загруженные данные; счётчик может быть неактуален.</p>}
    {loading ? <div aria-busy="true" aria-label="Загрузка уведомлений" className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : loadError && !items.length ? <RequestState title="Не удалось загрузить уведомления" description={loadError} onRetry={() => void load()} /> : groups.length ? groups.map(([date, entries]) => <section key={date} className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">{date}</h2>
      <Card padding="sm"><div className="divide-y divide-[var(--color-border)]">{entries.map(item => <article key={item.id} className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-base font-semibold">{item.title || 'Системное уведомление'}</h3>{!item.isRead && <Badge variant="info">Новое</Badge>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text-secondary)]">{item.body || 'Подробности уведомления недоступны.'}</p>{item.createdAt && <time dateTime={item.createdAt} className="mt-2 block text-xs text-[var(--color-text-secondary)]">{Number.isNaN(Date.parse(item.createdAt)) ? 'Время не указано' : new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>}{actionFor(item) && <Link href={actionFor(item)!.href} className="mt-2 inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold text-[var(--color-brand)]">{actionFor(item)!.label} →</Link>}</div>
        {!item.isRead && <Button variant="secondary" loading={savingId === item.id} disabled={Boolean(savingId)} onClick={() => void markRead(item.id)} className="shrink-0">Отметить прочитанным</Button>}
      </article>)}</div></Card>
    </section>) : !loadError && <EmptyState title={unreadOnly ? 'На этой странице нет непрочитанных уведомлений' : 'Уведомлений пока нет'} description={unreadOnly ? 'Смените страницу или снимите фильтр, чтобы посмотреть историю.' : 'События аккаунта появятся здесь.'} />}
    {pages > 1 && <nav aria-label="Страницы уведомлений" className="flex items-center justify-between gap-3"><Button variant="secondary" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Назад</Button><span className="text-sm text-[var(--color-text-secondary)]">{page} из {pages} · {total} событий</span><Button variant="secondary" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Далее</Button></nav>}
  </div>;
}
