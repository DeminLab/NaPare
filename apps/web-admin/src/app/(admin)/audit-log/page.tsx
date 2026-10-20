'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { apiFetchAllPages } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';
import { ListPagination } from '@/components/ListPagination';

interface AuditItem { id: string; userId: string; action: string; entity: string; entityId: string; oldValues?: Record<string, unknown>; newValues?: Record<string, unknown>; source?: string; createdAt: string; }
const printValue = (value: unknown) => value === undefined ? 'Не указано' : typeof value === 'object' ? JSON.stringify(value) : String(value);

function Changes({ item }: { item: AuditItem }) {
  const keys = [...new Set([...Object.keys(item.oldValues || {}), ...Object.keys(item.newValues || {})])].filter(key => JSON.stringify(item.oldValues?.[key]) !== JSON.stringify(item.newValues?.[key]));
  return <details className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-slate-50/70">
    <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--color-brand)]">Изменённые поля · {keys.length}</summary>
    <div className="space-y-2 border-t border-[var(--color-border)] p-3 sm:p-4">
      {keys.length ? keys.map(key => <div key={key} className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3 sm:grid-cols-[minmax(7rem,.4fr)_1fr_1fr] sm:items-start">
        <dt className="break-all text-sm font-semibold text-[var(--color-text)]">{key}</dt>
        <dd className="min-w-0 text-sm"><span className="text-xs text-[var(--color-text-secondary)]">Было</span><p className="mt-1 whitespace-pre-wrap break-words text-[var(--color-text)]">{printValue(item.oldValues?.[key])}</p></dd>
        <dd className="min-w-0 text-sm"><span className="text-xs text-[var(--color-text-secondary)]">Стало</span><p className="mt-1 whitespace-pre-wrap break-words text-[var(--color-text)]">{printValue(item.newValues?.[key])}</p></dd>
      </div>) : <p className="px-1 py-2 text-sm text-[var(--color-text-secondary)]">В записи нет различий полей. Действие сохранено без сравнения значений.</p>}
    </div>
  </details>;
}

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [source, setSource] = useState('');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useWorkspaceQuery({ q: query, action, source, period }, params => {
    setQuery((params.get('q') || '').slice(0, 100));
    setAction(params.get('action') || '');
    setSource(params.get('source') || '');
    const requestedPeriod = params.get('period') || 'all';
    setPeriod(['all', 'day', 'week', 'month'].includes(requestedPeriod) ? requestedPeriod : 'all');
  });
  const load = () => {
    setLoading(true);
    setError('');
    apiFetchAllPages<AuditItem>('/admin/audit-log')
      .then(setItems)
      .catch(err => setError(err instanceof Error ? err.message : 'Не удалось загрузить журнал аудита.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const periodMs: Record<string, number> = { day: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000 };
    const cutoff = periodMs[period] ? Date.now() - periodMs[period] : null;
    return items.filter(item => (!action || item.action === action) && (!source || (item.source || 'система') === source) && (!cutoff || new Date(item.createdAt).getTime() >= cutoff) && (!value || `${item.action} ${item.entity} ${item.entityId} ${item.userId}`.toLowerCase().includes(value)));
  }, [items, query, action, source, period]);
  const pageSize = 25;
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [query, action, source, period]);
  const reset = () => { setQuery(''); setAction(''); setSource(''); setPeriod('all'); };
  const hasFilters = Boolean(query || action || source || period !== 'all');

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-5">
    <header>
      <Link href="/dashboard" className="text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-brand)]">Операционный центр <span aria-hidden="true">→</span></Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">Кабинет ВУЗа · прозрачность действий</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">Журнал аудита</h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Поиск и фильтры применяются ко всем загруженным страницам журнала.</p>
    </header>

    <Card padding="sm">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(11rem,.35fr)_minmax(11rem,.35fr)_minmax(11rem,.35fr)]">
        <label className="text-sm font-semibold text-[var(--color-text)]">Поиск
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Действие, объект, пользователь или ID" className="mt-2 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal outline-none transition focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-focus-ring)]" />
        </label>
        <label className="text-sm font-semibold text-[var(--color-text)]">Действие
          <select value={action} onChange={event => setAction(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"><option value="">Все действия</option>{[...new Set(items.map(item => item.action))].sort().map(value => <option key={value}>{value}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-[var(--color-text)]">Источник
          <select value={source} onChange={event => setSource(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"><option value="">Все источники</option>{[...new Set(items.map(item => item.source || 'система'))].sort().map(value => <option key={value}>{value}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-[var(--color-text)]">Период
          <select value={period} onChange={event => setPeriod(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"><option value="all">Все время</option><option value="day">Последние 24 часа</option><option value="week">Последние 7 дней</option><option value="month">Последние 30 дней</option></select>
        </label>
      </div>
      {hasFilters && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3"><p className="text-sm text-[var(--color-text-secondary)]">Найдено записей: <strong className="text-[var(--color-text)]">{filtered.length}</strong></p><Button variant="ghost" onClick={reset}>Сбросить фильтры</Button></div>}
    </Card>

    {loading ? <div aria-busy="true" className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      : error ? <RequestState title="Не удалось загрузить журнал аудита" description={error} onRetry={load} />
        : !filtered.length ? <EmptyState title={items.length ? 'Нет записей по этим фильтрам' : 'Журнал пока пуст'} description={items.length ? 'Измените запрос или сбросьте фильтры.' : 'Изменения появятся после действий администраторов.'} />
          : <>
            <div className="space-y-3">
              {visible.map(item => <Card key={item.id} padding="sm" className="transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">◉</span>
                    <div className="min-w-0"><h2 className="break-words text-sm font-bold text-[var(--color-text)] sm:text-base">{item.action}</h2><p className="mt-1 break-words text-sm text-[var(--color-text-secondary)]">{item.entity}</p></div>
                  </div>
                  <time dateTime={item.createdAt} className="shrink-0 text-xs text-[var(--color-text-secondary)] sm:pl-4">{new Date(item.createdAt).toLocaleString('ru-RU')}</time>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[3.25rem]">
                  <Badge variant="slate">{item.source || 'система'}</Badge>
                  <details className="min-w-0">
                    <summary className="inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-slate-50 hover:text-[var(--color-brand)]">Идентификаторы записи</summary>
                    <p className="mt-1 max-w-full break-all rounded-lg bg-slate-50 p-3 text-xs leading-5 text-[var(--color-text-secondary)]">Объект: {item.entityId}<br />Пользователь: {item.userId || 'Не указан'}</p>
                  </details>
                </div>
                <div className="pl-0 sm:pl-[3.25rem]"><Changes item={item} /></div>
              </Card>)}
            </div>
            <ListPagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
          </>}
  </div>;
}
