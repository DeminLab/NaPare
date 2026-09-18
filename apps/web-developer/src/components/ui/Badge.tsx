import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variantClasses: Record<string, string> = {
  default: 'bg-[var(--workspace-paper-muted)] text-[var(--workspace-muted)]',
  success: 'bg-emerald-500/15 text-[var(--workspace-success)]',
  warning: 'bg-amber-500/15 text-[var(--workspace-warning)]',
  danger: 'bg-red-500/15 text-[var(--workspace-danger)]',
  info: 'bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]',
  purple: 'bg-violet-100 text-violet-700',
};

export default function Badge({ variant = 'default', size = 'sm', className = '', children, ...props }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${variantClasses[variant]} ${sizeClasses} ${className}`} {...props}>
      {children}
    </span>
  );
}
