'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--workspace-paper-muted)] text-[var(--workspace-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--workspace-ink)]">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-[var(--workspace-muted)]">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
