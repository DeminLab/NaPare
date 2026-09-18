'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  gradient?: string;
}

export function StatCard({ label, value, icon, gradient = 'from-[var(--workspace-accent)] to-[var(--workspace-accent-hover)]' }: StatCardProps) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg shadow-black/10`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-extrabold">{typeof value === 'number' ? value.toLocaleString('ru-RU') : value}</p>
          <p className="mt-0.5 text-sm text-white/80">{label}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
          {icon}
        </div>
      </div>
    </div>
  );
}
