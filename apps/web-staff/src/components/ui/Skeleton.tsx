'use client';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = '', lines = 1 }: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded-lg bg-slate-200" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
    );
  }
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}
