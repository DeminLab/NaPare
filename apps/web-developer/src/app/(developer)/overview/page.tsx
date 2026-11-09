'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  RequestState,
  Skeleton,
} from '@/components/ui';
import { BreakdownList, FunnelView, SectionCard, SeverityBadge, UniversityList } from '@/components/analytics/Breakdowns';
import { MetricCard } from '@/components/analytics/MetricCard';
import { TrendChart } from '@/components/analytics/TrendChart';
import { type Access, type Page, useResource } from '../control/control-ui';
import type { AnalyticsOverview, EventPage, Granularity } from '@/lib/analytics';
import {
  categoryLabels,
  clientLabels,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  overviewPath,
  relativeTime,
  sourceLabels,
} from '@/lib/analytics';

const ranges = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
];

export default function DeveloperOverviewPage() {
  const [days, setDays] = useState(30);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [universityId, setUniversityId] = useState('');
  const path = useMemo(() => overviewPath(days, granularity, universityId || undefined), [days, granularity, universityId]);
  const overview = useResource<AnalyticsOverview>(path, 60_000);
  const access = useResource<Access>('/platform/access');
  const universities = useResource<Page<{ id: string; name: string; city: string }>>('/platform/universities?limit=100');
  const canReadEvents = !!access.data && (access.data.owner || access.data.permissions.includes('telemetry.read'));
  const recentEvents = useResource<EventPage>(canReadEvents ? '/platform/events?limit=8' : null, 60_000);

  const data = overview.data;
  const forbidden = overview.error.toLowerCase().includes('доступ') || overview.error.toLowerCase().includes('разреш');
  const totals = data?.totals;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="NaPare · Platform intelligence"
          title="Аналитика платформы"
          description="Реальные регистрации, входы, сессии, события и активность. Пустые состояния означают отсутствие данных, а не нулевую активность."
          actions={
            <Button variant="secondary" onClick={overview.refresh} loading={overview.loading} disabled={overview.loading}>
              <Icon name="refresh" size={16} /> Обновить
            </Button>
          }
        />

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-1" role="group" aria-label="Период">
              {ranges.map(range => (
                <button
                  key={range.days}
                  type="button"
                  aria-pressed={days === range.days}
                  onClick={() => setDays(range.days)}
                  className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors ${days === range.days ? 'bg-white text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="granularity">Гранулярность</label>
            <select id="granularity" value={granularity} onChange={event => setGranularity(event.target.value as Granularity)} className="min-h-9 rounded-lg border border-[var(--color-border-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]">
              <option value="day">По дням</option>
              <option value="week">По неделям</option>
              <option value="month">По месяцам</option>
            </select>
            {!!universities.data?.data.length && (
              <>
                <label className="sr-only" htmlFor="university">Университет</label>
                <select id="university" value={universityId} onChange={event => setUniversityId(event.target.value)} className="min-h-9 max-w-[16rem] rounded-lg border border-[var(--color-border-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]">
                  <option value="">Все доступные вузы</option>
                  {universities.data.data.map(university => <option key={university.id} value={university.id}>{university.name}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <Badge variant={data ? 'success' : overview.error ? 'danger' : 'slate'} dot>
              {overview.error ? 'Ошибка загрузки' : data ? 'Данные из БД' : 'Загрузка'}
            </Badge>
            {data && <span>Обновлено {relativeTime(data.generatedAt)}</span>}
          </div>
        </div>

        {overview.error && (
          <RequestState
            kind={forbidden ? 'forbidden' : 'error'}
            title={forbidden ? 'Нет доступа к аналитике' : 'Не удалось загрузить аналитику'}
            description={overview.error}
            onRetry={overview.refresh}
          />
        )}

        {!overview.error && overview.loading && !data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => <Card key={index} className="border-[var(--color-border)] bg-white p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-8 w-28" /><Skeleton className="mt-3 h-3 w-36" /></Card>)}
            </div>
            <Card className="border-[var(--color-border)] bg-white p-5"><Skeleton className="h-5 w-48" /><Skeleton className="mt-4 h-[280px] w-full" /></Card>
          </div>
        )}

        {data && totals && (
          <>
            {!data.collectionStartedAt && (
              <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Телеметрия ещё не записала ни одного события. Показатели ниже равны нулю, потому что данных действительно нет, а не потому что сбор отключён в интерфейсе.
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Пользователи" value={formatNumber(totals.users.total)} hint={<><span className="font-semibold text-[var(--color-success)]">+{formatNumber(totals.users.new)}</span> новых за период · {formatNumber(totals.users.blocked)} заблокировано</>} icon={<Icon name="users" />} />
              <MetricCard label="Активны сейчас" value={formatNumber(totals.sessions.activeNow)} hint={`${formatNumber(totals.sessions.users)} пользователей с сессиями за период`} icon={<Icon name="pulse" />} tone="success" />
              <MetricCard label="Входы" value={formatNumber(totals.auth.logins)} hint={`${formatPercent(totals.auth.successRate)} успешных · ${formatNumber(totals.auth.failedLogins)} ошибок`} icon={<Icon name="lock" />} />
              <MetricCard label="События" value={formatNumber(totals.events.total)} hint={`${formatNumber(totals.events.errors)} ошибок · ${formatNumber(totals.events.requests)} запросов`} icon={<Icon name="list" />} tone={totals.events.errors ? 'warning' : 'brand'} />
              <MetricCard label="Сессии" value={formatNumber(totals.sessions.total)} hint={`${formatNumber(totals.sessions.users)} уникальных пользователей`} icon={<Icon name="dashboard" />} />
              <MetricCard label="Android" value={formatNumber(totals.mobile.users)} hint={`${formatNumber(totals.mobile.installs)} установок · ${formatNumber(totals.mobile.appOpens)} запусков`} icon={<Icon name="pulse" />} tone="success" />
              <MetricCard label="Средний ответ API" value={formatDuration(totals.events.avgDurationMs)} hint={`По ${formatNumber(totals.events.requests)} запросам с измеренным временем`} icon={<Icon name="code" />} tone="neutral" />
              <MetricCard label="Выходы" value={formatNumber(totals.auth.logouts)} hint={`${formatNumber(totals.auth.loginUsers)} пользователей входили за период`} icon={<Icon name="arrow-right" />} tone="neutral" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)]">
              <SectionCard
                title="Динамика активности"
                description={`${formatDate(data.range.from)} — ${formatDate(data.range.to)}. Наведите курсор, чтобы увидеть точку.`}
              >
                <TrendChart data={data.series} granularity={data.range.granularity} />
              </SectionCard>
              <SectionCard title="Воронка новых пользователей" description="Регистрация → первый вход → действие в продукте за 7 дней.">
                <FunnelView funnel={data.funnel} />
              </SectionCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SectionCard title="Клиенты" description="Сессии по типу клиента">
                <BreakdownList rows={data.breakdowns.clients} valueKey="sessions" labelFor={key => clientLabels[key] ?? key} secondaryLabel="Пользователей" emptyTitle="Сессий пока нет" />
              </SectionCard>
              <SectionCard title="Устройства" description="Тип устройства из User-Agent">
                <BreakdownList rows={data.breakdowns.devices} valueKey="sessions" labelFor={key => ({ desktop: 'Компьютер', mobile: 'Смартфон', tablet: 'Планшет', unknown: 'Неизвестно' } as Record<string, string>)[key] ?? key} emptyTitle="Устройства не определены" />
              </SectionCard>
              <SectionCard title="Операционные системы" description="ОС авторизованных устройств">
                <BreakdownList rows={data.breakdowns.os} valueKey="sessions" emptyTitle="ОС не определены" />
              </SectionCard>
              <SectionCard title="Браузеры" description="Браузер авторизованных устройств">
                <BreakdownList rows={data.breakdowns.browsers} valueKey="sessions" emptyTitle="Браузеры не определены" />
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="География" description="Города университетов, у которых были реальные сессии. IP-геолокация не подключена.">
                <UniversityList rows={data.breakdowns.universities} />
              </SectionCard>
              <SectionCard title="Популярность функций" description="Клиентские UI-события по именам функций">
                <BreakdownList rows={data.breakdowns.features} valueKey="events" secondaryLabel="Пользователей" emptyTitle="Функции пока не измеряются" emptyDescription="Клиентские события появятся после подключения beacon на web и Android." />
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="Популярные маршруты API" description="Нормализованные пути без идентификаторов">
                <BreakdownList rows={data.breakdowns.paths} valueKey="requests" secondaryLabel="Пользователей" emptyTitle="Запросы ещё не записаны" />
              </SectionCard>
              <SectionCard title="Категории событий" description="Распределение технического журнала">
                <BreakdownList rows={data.breakdowns.categories} valueKey="events" labelFor={key => categoryLabels[key] ?? key} emptyTitle="Событий пока нет" />
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]">
              <SectionCard
                title="Последние события"
                description="Сырые записи журнала без паролей и токенов."
                action={<Link href="/events" className="text-xs font-semibold text-[var(--color-brand)] hover:underline">Открыть журнал →</Link>}
              >
                {recentEvents.error ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">Журнал недоступен по текущим правам: {recentEvents.error}</p>
                ) : recentEvents.loading && !recentEvents.data ? (
                  <Skeleton lines={5} />
                ) : recentEvents.data?.data.length ? (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {recentEvents.data.data.map(event => (
                      <li key={event.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-[var(--color-text)]">{event.name}</p>
                          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                            {event.user ? `${event.user.firstName} ${event.user.lastName} · ${event.user.email}` : 'Системное событие'} · {relativeTime(event.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Badge variant="slate">{sourceLabels[event.source] ?? event.source}</Badge>
                          <SeverityBadge severity={event.severity} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="Событий пока нет" description="Журнал начнёт заполняться после первого запроса к API или клиентского события." />
                )}
              </SectionCard>

              <SectionCard title="Источники и ограничения" description="Что измеряется, а что честно недоступно.">
                <ul className="space-y-2.5">
                  {data.availability.map(item => (
                    <li key={item.key} className="flex items-start gap-2.5 text-xs leading-5">
                      <Badge variant={item.available ? 'success' : 'warning'}>{item.available ? 'Есть' : 'Нет'}</Badge>
                      <span className="text-[var(--color-text-secondary)]">{item.reason ?? 'Источник подключён.'}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Ограничения</p>
                  <ul className="mt-2 space-y-2 text-[11px] leading-5 text-[var(--color-text-secondary)]">
                    {data.limitations.map(item => <li key={item}>· {item}</li>)}
                  </ul>
                </div>
                {data.collectionStartedAt && <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">Сбор данных начат {formatDate(data.collectionStartedAt)}</p>}
              </SectionCard>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>Роли:</span>
              {data.breakdowns.roles.filter(row => row.users).map(row => <Badge key={row.key} variant="slate">{row.key}: {formatNumber(row.users)}</Badge>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
