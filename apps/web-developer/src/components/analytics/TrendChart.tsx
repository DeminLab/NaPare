'use client';

import { useId, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui';
import type { AnalyticsSeriesPoint, Granularity } from '@/lib/analytics';
import { formatDay, formatNumber } from '@/lib/analytics';

type MetricKey = 'activeUsers' | 'registrations' | 'logins' | 'events' | 'errors';

const metrics: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'activeUsers', label: 'Активные', color: '#5146e8' },
  { key: 'registrations', label: 'Регистрации', color: '#0f766e' },
  { key: 'logins', label: 'Входы', color: '#b45309' },
  { key: 'events', label: 'События', color: '#64748b' },
  { key: 'errors', label: 'Ошибки', color: '#b91c1c' },
];

const WIDTH = 860;
const HEIGHT = 300;
const PADDING = { top: 18, right: 18, bottom: 34, left: 46 };

const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

function linePath(values: number[], x: (index: number) => number, y: (value: number) => number): string {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
}

export function TrendChart({
  data,
  granularity,
}: {
  data: AnalyticsSeriesPoint[];
  granularity: Granularity;
}) {
  const gradientId = useId().replace(/:/g, '');
  const [visible, setVisible] = useState<MetricKey[]>(['activeUsers', 'registrations', 'logins', 'events']);
  const [hover, setHover] = useState<number | null>(null);

  const hasData = data.some(point => metrics.some(metric => point[metric.key] > 0));
  const shown = metrics.filter(metric => visible.includes(metric.key));
  const max = useMemo(() => {
    const values = data.flatMap(point => shown.map(metric => point[metric.key]));
    return Math.max(1, ...values);
  }, [data, shown]);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const x = (index: number) => data.length <= 1 ? PADDING.left + plotWidth / 2 : PADDING.left + (index / (data.length - 1)) * plotWidth;
  const y = (value: number) => PADDING.top + plotHeight - (value / max) * plotHeight;
  const activeIndex = hover ?? data.length - 1;
  const activePoint = data[activeIndex];

  const xTicks = useMemo(() => {
    if (!data.length) return [];
    const count = Math.min(6, data.length);
    return [...new Set(Array.from({ length: count }, (_, index) => Math.round((index / Math.max(1, count - 1)) * (data.length - 1))))];
  }, [data.length]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => Math.round(max * ratio));

  const toggle = (key: MetricKey) => {
    setVisible(current => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter(item => item !== key);
      }
      return [...current, key];
    });
  };

  if (!hasData) {
    return (
      <EmptyState
        title="Данных за период пока нет"
        description="График появится после первых записанных событий, входов или регистраций. Нулевые значения не подменяются демонстрационными данными."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-[var(--color-text-secondary)]">
            {activePoint ? formatDay(activePoint.bucket) : '—'} · {granularity === 'day' ? 'по дням' : granularity === 'week' ? 'по неделям' : 'по месяцам'}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
            {activePoint ? `${formatNumber(activePoint.activeUsers)} активных · ${formatNumber(activePoint.registrations)} регистраций · ${formatNumber(activePoint.logins)} входов` : 'Нет точки'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Показатели графика">
          {metrics.map(metric => {
            const active = visible.includes(metric.key);
            return (
              <button
                key={metric.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(metric.key)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${active ? 'border-[var(--color-border-strong)] bg-white text-[var(--color-text)]' : 'border-transparent bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: metric.color }} />
                {metric.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-3 w-full">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[260px] w-full sm:h-[300px]"
          role="img"
          aria-label="Динамика активности платформы"
          onMouseMove={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            const position = ((event.clientX - rect.left) / rect.width) * WIDTH;
            const index = Math.round(((position - PADDING.left) / plotWidth) * Math.max(1, data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, index)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5146e8" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#5146e8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map(value => (
            <g key={value}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(value)} y2={y(value)} stroke="var(--color-border)" strokeWidth="1" />
              <text x={PADDING.left - 10} y={y(value) + 4} textAnchor="end" className="fill-[var(--color-text-muted)] text-[11px]">{compact.format(value)}</text>
            </g>
          ))}

          {xTicks.map(index => (
            <text key={index} x={x(index)} y={HEIGHT - 10} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} className="fill-[var(--color-text-muted)] text-[11px]">
              {formatDay(data[index]?.bucket)}
            </text>
          ))}

          {visible.includes('activeUsers') && (
            <path
              d={`${linePath(data.map(point => point.activeUsers), x, y)} L${x(data.length - 1)},${PADDING.top + plotHeight} L${x(0)},${PADDING.top + plotHeight} Z`}
              fill={`url(#${gradientId}-area)`}
            />
          )}

          {shown.map(metric => (
            <path
              key={metric.key}
              d={linePath(data.map(point => point[metric.key]), x, y)}
              fill="none"
              stroke={metric.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {activePoint && (
            <line x1={x(activeIndex)} x2={x(activeIndex)} y1={PADDING.top} y2={PADDING.top + plotHeight} stroke="var(--color-border-strong)" strokeDasharray="3 3" />
          )}
          {activePoint && shown.map(metric => (
            <circle key={metric.key} cx={x(activeIndex)} cy={y(activePoint[metric.key])} r="3.5" fill="white" stroke={metric.color} strokeWidth="2" />
          ))}
        </svg>
      </div>
    </div>
  );
}
