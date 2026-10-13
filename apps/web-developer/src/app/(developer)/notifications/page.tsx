'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, PageHeader, RequestState, Skeleton } from '@/components/ui';
import { apiFetch } from '@/lib/api';

interface Notification { id: string; title?: string; body?: string; createdAt?: string; isRead?: boolean; }

function dateLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Дата не указана';
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DeveloperNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [status, setStatus] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch<Notification[] | { data: Notification[] }>('/notifications');
      setItems(Array.isArray(response) ? response : response.data);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить уведомления.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const groups = useMemo(() => {
    const result = new Map<string, Notification[]>();
    [...items].filter(item => !unreadOnly || !item.isRead).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).forEach(item => {
      const label = dateLabel(item.createdAt);
      result.set(label, [...(result.get(label) || []), item]);
    });
    return [...result];
  }, [items, unreadOnly]);
  const markRead = async (id: string) => {
    setSavingId(id); setStatus(''); setError('');
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems(current => current.map(item => item.id === id ? { ...item, isRead: true } : item));
      setStatus('Уведомление отмечено прочитанным.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить отметку. Попробуйте ещё раз.'); }
    finally { setSavingId(''); }
  };
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
    <PageHeader eyebrow="Разработчик · аккаунт" title="Уведомления" description="События вашего аккаунта. Общий журнал платформы находится в разделе «Состояние системы»." actions={<Button variant="secondary" loading={loading} onClick={() => void load()}>Обновить</Button>} />
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} className="h-5 w-5 accent-[var(--color-brand)]" />Только непрочитанные</label><Badge>{items.filter(item => !item.isRead).length} непрочитанных</Badge></div>
    <p role="status" className="text-sm text-[var(--color-text-secondary)]">{status}</p>
    {error && <RequestState title="Не удалось выполнить действие" description={error} onRetry={() => void load()} />}
    {loading ? <div aria-busy="true" aria-label="Загрузка уведомлений" className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : groups.length ? groups.map(([date, entries]) => <section key={date} className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">{date}</h2>
      <Card padding="sm"><div className="divide-y divide-[var(--color-border)]">{entries.map(item => <article key={item.id} className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-base font-semibold">{item.title || 'Системное уведомление'}</h3>{!item.isRead && <Badge variant="info">Новое</Badge>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text-secondary)]">{item.body || 'Подробности уведомления недоступны.'}</p>{item.createdAt && <time dateTime={item.createdAt} className="mt-2 block text-xs text-[var(--color-text-secondary)]">{Number.isNaN(Date.parse(item.createdAt)) ? 'Время не указано' : new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>}</div>
        {!item.isRead && <Button variant="secondary" loading={savingId === item.id} disabled={Boolean(savingId)} onClick={() => void markRead(item.id)} className="shrink-0">Отметить прочитанным</Button>}
      </article>)}</div></Card>
    </section>) : !error && <EmptyState title={unreadOnly ? 'Все уведомления прочитаны' : 'Уведомлений пока нет'} description={unreadOnly ? 'Снимите фильтр, чтобы посмотреть историю.' : 'События аккаунта появятся здесь.'} />}
  </div>;
}
