import type { ReactNode } from 'react';
import { Badge, Card, EmptyState } from '@/components/ui';
import type { AnalyticsOverview, BreakdownRow } from '@/lib/analytics';
import { categoryLabels, formatNumber, formatPercent, severityLabels } from '@/lib/analytics';

export function SectionCard({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-[var(--color-border)] bg-white p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-text)]">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function BreakdownList({
  rows,
  valueKey,
  labelFor,
  emptyTitle,
  emptyDescription,
  limit = 8,
  secondaryLabel,
}: {
  rows: BreakdownRow[];
  valueKey: 'sessions' | 'users' | 'events' | 'requests' | 'errors';
  labelFor?: (key: string) => string;
  emptyTitle: string;
  emptyDescription?: string;
  limit?: number;
  secondaryLabel?: string;
}) {
  const visible = rows.filter(row => Number(row[valueKey] ?? 0) > 0).slice(0, limit);
  const max = Math.max(1, ...visible.map(row => Number(row[valueKey] ?? 0)));
  if (!visible.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className="space-y-3">
      {visible.map(row => {
        const value = Number(row[valueKey] ?? 0);
        return (
          <li key={row.key || 'unknown'}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-[var(--color-text)]">{labelFor ? labelFor(row.key) : row.key || 'Не определено'}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">{formatNumber(value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-tertiary)]">
              <div className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-500" style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />
            </div>
            {secondaryLabel && row.users !== undefined && (
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{secondaryLabel}: {formatNumber(row.users)}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FunnelView({ funnel }: { funnel: AnalyticsOverview['funnel'] }) {
  if (!funnel.cohort) {
    return <EmptyState title="Когорта пока пуста" description="В выбранном периоде не было новых аккаунтов, поэтому воронку нельзя построить без выдуманных значений." />;
  }
  const max = Math.max(1, ...funnel.steps.map(step => step.value));
  return (
    <div>
      <ol className="space-y-3">
        {funnel.steps.map((step, index) => (
          <li key={step.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-[var(--color-text)]"><span className="mr-2 font-mono text-[11px] text-[var(--color-text-muted)]">0{index + 1}</span>{step.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">{formatNumber(step.value)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-7 flex-1 overflow-hidden rounded-md bg-[var(--color-surface-tertiary)]">
                <div className={`h-full rounded-md transition-[width] duration-500 ${index === 0 ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-brand)]/70'}`} style={{ width: `${Math.max(4, (step.value / max) * 100)}%` }} />
              </div>
              <span className="w-14 text-right text-xs tabular-nums text-[var(--color-text-secondary)]">{formatPercent(step.rate)}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5 text-xs leading-5 text-[var(--color-text-secondary)]">
        {funnel.retention.available
          ? <>Возврат на 7–30 день: <span className="font-semibold text-[var(--color-text)]">{formatNumber(funnel.retention.retained)}</span> из {formatNumber(funnel.retention.cohort)} · {formatPercent(funnel.retention.rate)}</>
          : 'Возврат на 7–30 день появится, когда накопится когорта старше 30 дней.'}
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity === 'critical' || severity === 'error' ? 'danger' : severity === 'warning' ? 'warning' : severity === 'debug' ? 'slate' : 'info';
  return <Badge variant={variant}>{severityLabels[severity] ?? severity}</Badge>;
}

export function CategoryBadge({ category }: { category: string }) {
  const variant = category === 'error' ? 'danger' : category === 'admin' ? 'purple' : category === 'auth' ? 'teal' : category === 'request' ? 'slate' : 'info';
  return <Badge variant={variant}>{categoryLabels[category] ?? category}</Badge>;
}

export function UniversityList({ rows }: { rows: AnalyticsOverview['breakdowns']['universities'] }) {
  if (!rows.length) return <EmptyState title="Нет сессий по вузам" description="География строится по городам университетов, у которых были реальные сессии за период." />;
  const max = Math.max(1, ...rows.map(row => row.sessions));
  return (
    <ul className="space-y-3">
      {rows.slice(0, 8).map(row => (
        <li key={row.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-[var(--color-text)]">{row.name}<span className="ml-1.5 text-xs text-[var(--color-text-muted)]">{row.city}</span></span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">{formatNumber(row.sessions)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-tertiary)]">
            <div className="h-full rounded-full bg-[var(--color-brand)]/80" style={{ width: `${Math.max(3, (row.sessions / max) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{formatNumber(row.users)} пользователей · последняя активность {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleDateString('ru-RU') : '—'}</p>
        </li>
      ))}
    </ul>
  );
}
