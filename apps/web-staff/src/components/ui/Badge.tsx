'use client';

import { ReactNode } from 'react';

type BadgeVariant = 'sky' | 'green' | 'amber' | 'red' | 'purple' | 'slate' | 'pink' | 'teal' | 'indigo';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  sky: 'bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]',
  green: 'bg-emerald-100 text-[var(--workspace-success)]',
  amber: 'bg-amber-100 text-[var(--workspace-warning)]',
  red: 'bg-red-100 text-[var(--workspace-danger)]',
  purple: 'bg-purple-100 text-purple-700',
  slate: 'bg-[var(--workspace-paper-muted)] text-[var(--workspace-muted)]',
  pink: 'bg-pink-100 text-pink-700',
  teal: 'bg-teal-100 text-teal-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

const dotColors: Record<BadgeVariant, string> = {
  sky: 'bg-[var(--workspace-accent)]',
  green: 'bg-[var(--workspace-success)]',
  amber: 'bg-[var(--workspace-warning)]',
  red: 'bg-[var(--workspace-danger)]',
  purple: 'bg-purple-500',
  slate: 'bg-slate-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
};

const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-xs' };

export function Badge({ children, variant = 'slate', size = 'sm', dot = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${variants[variant]} ${sizes[size]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
