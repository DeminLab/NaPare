'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  gradient?: string;
}

export function StatCard({ label, value, icon, gradient = 'from-indigo-500 to-indigo-600' }: StatCardProps) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-extrabold">{value}</p>
          <p className="mt-0.5 text-sm text-white/80">{label}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
          {icon}
        </div>
      </div>
    </div>
  );
}
