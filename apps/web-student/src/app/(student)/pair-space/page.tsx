'use client';

import Link from 'next/link';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Icon, RequestState, Skeleton } from '@napare/ui';
import { PreparationProgressControl, type PreparationProgress } from '../PreparationProgressControl';
import { readStudentPreparationProgress } from '../preparation-progress-api';

interface Preparation {
  id: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  lessonId: string;
  subject: string;
  progress?: PreparationProgress;
}

interface MyDayResponse {
  upcomingPreparations?: Preparation[];
}

type PreparationFilter = 'all' | 'urgent' | 'week' | 'later' | 'noDeadline' | 'overdue';

const filters: Array<{ id: PreparationFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'urgent', label: 'Сегодня и завтра' },
  { id: 'week', label: 'На неделе' },
  { id: 'later', label: 'Позже' },
  { id: 'overdue', label: 'Срок прошёл' },
  { id: 'noDeadline', label: 'Без срока' },
];

function daysUntil(deadline?: string | null): number | null {
  if (!deadline) return null;
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / 86_400_000);
}

function dueLabel(deadline?: string | null): string {
  if (!deadline) return 'Срок не указан';
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return 'Срок не указан';
  const days = daysUntil(deadline);
  const time = due.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Сегодня, ${time}`;
  if (days === 1) return `Завтра, ${time}`;
  if (days === -1) return `Срок прошёл вчера · ${time}`;
  if (days !== null && days < 0) return `${Math.abs(days)} дн. назад · ${time}`;
  return `${due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · ${time}`;
}

function matchesFilter(preparation: Preparation, filter: PreparationFilter): boolean {
  if (filter === 'all') return true;
  const days = daysUntil(preparation.deadline);
  if (filter === 'noDeadline') return days === null;
  if (days === null) return false;
  if (filter === 'urgent') return days >= 0 && days <= 1;
  if (filter === 'week') return days >= 2 && days <= 7;
  if (filter === 'later') return days > 7;
  return days < 0;
}

export default function PairSpaceIndex() {
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [filter, setFilter] = useState<PreparationFilter>('all');
  const [search, setSearch] = useState('');
  const [unfinishedOnly, setUnfinishedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useWorkspaceQuery({ filter, q: search, unfinished: unfinishedOnly ? '1' : '' }, query => {
    const requested = query.get("filter");
    setFilter(filters.find(item => item.id === requested)?.id || "all");
    setSearch((query.get("q") || "").slice(0, 80));
    setUnfinishedOnly(query.get('unfinished') === '1');
  });

  useEffect(() => {
    let active = true;
    apiFetch<MyDayResponse>('/my-day?timeZone=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'))
      .then((result) => {
        if (active) setPreparations((result.upcomingPreparations || []).map(preparation => ({ ...preparation, progress: readStudentPreparationProgress(preparation.id, preparation.progress || 'todo') })));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить подготовку к парам.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    return preparations.filter((item) => matchesFilter(item, filter) && (!unfinishedOnly || item.progress !== 'done') &&
      (!query || `${item.title} ${item.subject} ${item.description || ''}`.toLocaleLowerCase('ru-RU').includes(query)))
      .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  }, [filter, preparations, search, unfinishedOnly]);
  const bucket = (item: Preparation) => {
    const days = daysUntil(item.deadline);
    return days === null ? 'Без срока' : days < 0 ? 'Срок прошёл' : days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : days <= 7 ? 'На неделе' : 'Позже';
  };
  const grouped = ['Срок прошёл', 'Сегодня', 'Завтра', 'На неделе', 'Позже', 'Без срока'].map(title => ({ title, items: visible.filter(item => bucket(item) === title) })).filter(group => group.items.length);

  if (loading) return <div className="mx-auto max-w-5xl space-y-4"><Skeleton className="h-20" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (error && !preparations.length) return <div className="mx-auto max-w-3xl"><RequestState title="Не удалось загрузить список" description={error} onRetry={() => window.location.reload()} /></div>;

  return (
    <div className="student-preparation-page mx-auto max-w-[1400px] space-y-6">
      <header>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Подготовка</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Материалы, задания и сроки подготовки к вашим занятиям.</p>
      </header>

      {preparations.length > 0 && <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Поиск подготовки</span>
            <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти тему или предмет" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]" />
          </label>
          <p className="text-sm text-slate-500" role="status">Показано {visible.length} из {preparations.length}</p>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Фильтр по сроку">
          {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`min-h-11 shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${filter === item.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{item.label}</button>)}
        </div>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={unfinishedOnly} onChange={event => setUnfinishedOnly(event.target.checked)} className="h-5 w-5 accent-indigo-600" />Незавершённые</label>
      </Card>}

      {visible.length ? <div className="space-y-6">{grouped.map(group => <details key={group.title} open={group.title === 'Срок прошёл' || group.title === 'Сегодня' || group.title === 'Завтра' || filter !== 'all' || Boolean(search.trim()) || unfinishedOnly} className="space-y-3"><summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold text-slate-900"><h2 className="inline">{group.title} <span className="ml-2 text-sm font-normal text-slate-500">{group.items.length}</span></h2></summary>{group.items.map((item) => {
        const days = daysUntil(item.deadline);
        const status = days === null ? 'Без срока' : days < 0 ? 'Срок прошёл' : days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : days <= 7 ? 'На неделе' : 'Позже';
        return <Card key={item.id} padding="sm" className="transition-colors hover:border-indigo-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge variant={days !== null && days < 0 ? 'danger' : days !== null && days <= 1 ? 'warning' : 'default'}>{status}</Badge><span className="text-xs text-slate-500">{dueLabel(item.deadline)}</span></div>
              <h3 className="mt-3 break-words text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm font-medium text-indigo-700">{item.subject}</p>
              {item.description && <details className="mt-2 text-sm text-slate-600"><summary className="min-h-11 cursor-pointer py-2 font-medium text-indigo-700">Что подготовить</summary><p className="whitespace-pre-wrap break-words leading-6">{item.description}</p></details>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end"><PreparationProgressControl preparationId={item.id} initialState={item.progress} onSaved={progress => setPreparations(current => current.map(preparation => preparation.id === item.id ? { ...preparation, progress } : preparation))} /><Link href={`/pair-space/${item.lessonId}?tab=homeworks#preparation-${item.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">Открыть занятие <Icon name="arrow-right" size={16} /></Link></div>
          </div>
        </Card>;
      })}</details>)}</div> : <Card><EmptyState title={preparations.length ? 'Ничего не найдено' : 'Подготовки пока нет'} description={preparations.length ? 'Измените запрос или фильтр.' : 'Все материалы к занятиям появятся здесь.'} action={preparations.length ? <Button variant="secondary" onClick={() => { setSearch(''); setFilter('all'); setUnfinishedOnly(false); }}>Сбросить фильтры</Button> : <Link href="/week" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">Открыть расписание</Link>} /></Card>}
    </div>
  );
}
