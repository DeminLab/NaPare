'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  Icon,
  PageHeader,
  Pagination,
  RequestState,
  SearchInput,
  Select,
} from '@/components/ui';
import { CategoryBadge, SeverityBadge } from '@/components/analytics/Breakdowns';
import { type Access, type Page, useResource } from '../control/control-ui';
import type { EventFacets, EventPage, TelemetryEvent } from '@/lib/analytics';
import {
  categoryLabels,
  eventPath,
  formatDate,
  formatDuration,
  formatNumber,
  relativeTime,
  severityLabels,
  sourceLabels,
} from '@/lib/analytics';

const ranges = [
  { days: 1, label: 'Сутки' },
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
];

export default function EventJournalPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [severity, setSeverity] = useState('');
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TelemetryEvent | null>(null);
  const access = useResource<Access>('/platform/access');
  const universities = useResource<Page<{ id: string; name: string; city: string }>>('/platform/universities?limit=100');
  const [universityId, setUniversityId] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const path = useMemo(() => eventPath({ page, limit: 25, q: search, category, source, severity, days, universityId }), [page, search, category, source, severity, days, universityId]);
  const facetsPath = useMemo(() => eventPath({ limit: 1, days, universityId }).replace('/platform/events?', '/platform/events/facets?'), [days, universityId]);
  const events = useResource<EventPage>(path, 30_000);
  const facets = useResource<EventFacets>(facetsPath, 60_000);
  const forbidden = events.error.toLowerCase().includes('доступ') || events.error.toLowerCase().includes('разреш');

  const columns = [
    {
      key: 'time',
      header: 'Время',
      render: (event: TelemetryEvent) => <div><p className="text-sm">{formatDate(event.createdAt)}</p><p className="text-[11px] text-[var(--color-text-secondary)]">{relativeTime(event.createdAt)}</p></div>,
    },
    {
      key: 'name',
      header: 'Событие',
      render: (event: TelemetryEvent) => <div className="min-w-0"><p className="max-w-[20rem] truncate font-mono text-xs text-[var(--color-text)]">{event.name}</p><p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{event.method ? `${event.method} ` : ''}{event.path || '—'}</p></div>,
    },
    {
      key: 'category',
      header: 'Категория',
      render: (event: TelemetryEvent) => <CategoryBadge category={event.category} />,
    },
    {
      key: 'source',
      header: 'Источник',
      render: (event: TelemetryEvent) => <Badge variant="slate">{sourceLabels[event.source] ?? event.source}</Badge>,
    },
    {
      key: 'user',
      header: 'Пользователь',
      render: (event: TelemetryEvent) => event.user ? <Link href={`/users/${event.user.id}`} className="block min-w-0 hover:text-[var(--color-brand)]"><p className="truncate text-sm">{event.user.firstName} {event.user.lastName}</p><p className="truncate text-[11px] text-[var(--color-text-secondary)]">{event.user.email}</p></Link> : <span className="text-xs text-[var(--color-text-secondary)]">Система</span>,
    },
    {
      key: 'result',
      header: 'Результат',
      render: (event: TelemetryEvent) => <div className="flex items-center gap-1.5">{event.statusCode !== null && <Badge variant={event.statusCode >= 500 ? 'danger' : event.statusCode >= 400 ? 'warning' : 'success'}>{event.statusCode}</Badge>}{event.durationMs !== null && <span className="text-[11px] tabular-nums text-[var(--color-text-secondary)]">{formatDuration(event.durationMs)}</span>}</div>,
    },
    {
      key: 'severity',
      header: 'Уровень',
      render: (event: TelemetryEvent) => <SeverityBadge severity={event.severity} />,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          eyebrow="NaPare · Event journal"
          title="События и логи"
          description="Запросы, ошибки, авторизации и административные действия со всех частей платформы. Пароли, токены и cookies не записываются."
          actions={<Button variant="secondary" onClick={events.refresh} loading={events.loading}><Icon name="refresh" size={16} /> Обновить</Button>}
        />

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-1" role="group" aria-label="Период">
              {ranges.map(range => <button key={range.days} type="button" aria-pressed={days === range.days} onClick={() => { setDays(range.days); setPage(1); }} className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors ${days === range.days ? 'bg-white text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}>{range.label}</button>)}
            </div>
            <span className="text-xs text-[var(--color-text-secondary)]">{events.data ? `${formatNumber(events.data.meta.total)} событий` : 'Загрузка…'}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2"><label htmlFor="event-search" className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Поиск</label><SearchInput id="event-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Имя события, путь, IP или ID пользователя" /></div>
            <Select label="Категория" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}>
              <option value="">Все категории</option>
              {(facets.data?.categories ?? []).map(item => <option key={item.key} value={item.key}>{categoryLabels[item.key] ?? item.key} · {item.count}</option>)}
            </Select>
            <Select label="Источник" value={source} onChange={event => { setSource(event.target.value); setPage(1); }}>
              <option value="">Все источники</option>
              {(facets.data?.sources ?? []).map(item => <option key={item.key} value={item.key}>{sourceLabels[item.key] ?? item.key} · {item.count}</option>)}
            </Select>
            <Select label="Уровень" value={severity} onChange={event => { setSeverity(event.target.value); setPage(1); }}>
              <option value="">Все уровни</option>
              {(facets.data?.severities ?? []).map(item => <option key={item.key} value={item.key}>{severityLabels[item.key] ?? item.key} · {item.count}</option>)}
            </Select>
            {!!universities.data?.data.length && <Select label="Университет" value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все доступные</option>{universities.data.data.map(university => <option key={university.id} value={university.id}>{university.name}</option>)}</Select>}
          </div>
        </div>

        {events.error ? (
          <RequestState kind={forbidden ? 'forbidden' : 'error'} title={forbidden ? 'Нет доступа к журналу' : 'Не удалось загрузить журнал'} description={events.error} onRetry={events.refresh} />
        ) : (
          <div className="space-y-3">
            <DataTable
              columns={columns}
              data={events.data?.data ?? []}
              getRowKey={event => event.id}
              loading={events.loading && !events.data}
              className="min-w-[64rem]"
              empty={<div className="py-10 text-center"><p className="text-sm font-semibold text-[var(--color-text)]">Событий не найдено</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Измените период или фильтры. Пустой результат не заменяется демонстрационными записями.</p></div>}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-text-secondary)]">Нажмите на строку, чтобы открыть метаданные события.</p>
              {events.data && <Pagination page={events.data.meta.page} totalPages={Math.max(1, events.data.meta.totalPages)} onChange={setPage} />}
            </div>
          </div>
        )}

        <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2"><CategoryBadge category={selected.category} /><Badge variant="slate">{sourceLabels[selected.source] ?? selected.source}</Badge><SeverityBadge severity={selected.severity} />{selected.statusCode !== null && <Badge variant={selected.statusCode >= 400 ? 'danger' : 'success'}>{selected.statusCode}</Badge>}</div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Время</dt><dd className="mt-0.5">{formatDate(selected.createdAt)}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Длительность</dt><dd className="mt-0.5">{formatDuration(selected.durationMs)}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Метод и путь</dt><dd className="mt-0.5 break-all font-mono text-xs">{selected.method || '—'} {selected.path || ''}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">IP</dt><dd className="mt-0.5 font-mono text-xs">{selected.ip || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Пользователь</dt><dd className="mt-0.5">{selected.user ? <Link href={`/users/${selected.user.id}`} className="text-[var(--color-brand)] hover:underline">{selected.user.email}</Link> : 'Система'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Сессия</dt><dd className="mt-0.5 break-all font-mono text-xs">{selected.sessionId || '—'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-[var(--color-text-secondary)]">User-Agent</dt><dd className="mt-0.5 break-all text-xs">{selected.userAgent || '—'}</dd></div>
              </dl>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Метаданные</p>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3 text-[11px] leading-5 text-[var(--color-text-secondary)]">{selected.metadata ? JSON.stringify(selected.metadata, null, 2) : 'Нет метаданных'}</pre>
              </div>
            </div>
          )}
        </Dialog>

        {access.data && !access.data.owner && !access.data.permissions.includes('telemetry.read') && <p className="text-xs text-[var(--color-text-secondary)]">Журнал доступен по разрешению telemetry.read.</p>}
      </div>
    </div>
  );
}
