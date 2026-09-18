import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--workspace-paper-muted)] text-[var(--workspace-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--workspace-ink)]">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-[var(--workspace-muted)]">{description}</p>}
    </div>
  );
}
