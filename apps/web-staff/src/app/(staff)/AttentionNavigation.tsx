import Link from 'next/link';

export function AttentionNavigation({ active }: { active: 'tasks' | 'notifications' }) {
  return <nav aria-label="Центр внимания" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-2">
    <Link href="/inbox" aria-current={active === 'tasks' ? 'page' : undefined} className={'inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ' + (active === 'tasks' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50')}>Задачи</Link>
    <Link href="/notifications" aria-current={active === 'notifications' ? 'page' : undefined} className={'inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ' + (active === 'notifications' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50')}>Уведомления</Link>
  </nav>;
}
