'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const variants = {
  primary: 'bg-[var(--workspace-accent)] text-white shadow-sm hover:bg-[var(--workspace-accent-hover)] hover:shadow-md',
  secondary: 'border border-[var(--workspace-line)] bg-[var(--workspace-paper)] text-[var(--workspace-ink)] hover:bg-[var(--workspace-paper-muted)]',
  danger: 'bg-[var(--workspace-danger)] text-white shadow-lg hover:brightness-95',
  ghost: 'text-[var(--workspace-muted)] hover:bg-[var(--workspace-paper-muted)]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-sm rounded-xl',
};

export function Button({ children, variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, className = '', ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--workspace-focus-ring)] disabled:opacity-50 disabled:shadow-none ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
