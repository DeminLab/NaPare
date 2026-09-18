import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export default function StatCard({ label, value, icon, className = '' }: StatCardProps) {
  return (
    <div className={`rounded-2xl bg-[var(--workspace-paper)] p-5 ring-1 ring-[var(--workspace-line)] ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--workspace-muted)]">{label}</p>
        {icon && <div className="text-[var(--workspace-muted)]">{icon}</div>}
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--workspace-ink)]">{value}</p>
    </div>
  );
}
