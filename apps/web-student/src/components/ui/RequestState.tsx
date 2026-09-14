'use client';

import { ReactNode } from 'react';

interface RequestStateProps {
  kind?: 'error' | 'forbidden' | 'offline';
  title: string;
  description: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function RequestState({ kind = 'error', title, description, onRetry, action }: RequestStateProps) {
  const accent = kind === 'forbidden' ? 'bg-amber-50 text-amber-700' : kind === 'offline' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600';
  const symbol = kind === 'forbidden' ? '!' : kind === 'offline' ? '↗' : '×';
  return <div className="flex min-h-[240px] flex-col items-center justify-center px-5 py-12 text-center"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${accent}`}>{symbol}</div><h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p><div className="mt-6 flex flex-wrap justify-center gap-3">{onRetry && <button onClick={onRetry} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">Повторить</button>}{action}</div></div>;
}
