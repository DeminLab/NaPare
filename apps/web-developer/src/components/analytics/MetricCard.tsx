import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const tones = {
    brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    neutral: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  };
  return (
    <Card className="group relative overflow-hidden border-[var(--color-border)] bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brand)]/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">{label}</p>
        {icon && <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>}
      </div>
      <p className="mt-3 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-[var(--color-text)] tabular-nums">{value}</p>
      {hint && <p className="mt-2.5 text-xs leading-5 text-[var(--color-text-secondary)]">{hint}</p>}
    </Card>
  );
}
