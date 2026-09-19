'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface InboxItem { id: string; title: string; description: string; type: string; status: 'open' | 'snoozed' | 'done'; createdAt: string; deepLink?: string; }
const category = (type: string) => type.includes('message') ? 'Сообщения' : type.includes('absence') ? 'Посещаемость' : type.includes('lesson') || type.includes('room') ? 'Расписание' : type.includes('homework') ? 'Задания' : 'Системные действия';

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = () => { setLoading(true); setError(''); apiFetch<InboxItem[]>('/notifications/inbox').then(setItems).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить inbox.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const grouped = useMemo(() => items.reduce<Record<string, InboxItem[]>>((result, item) => { const key = category(item.type); (result[key] ||= []).push(item); return result; }, {}), [items]);
  return <div className="mx-auto max-w-[1000px] space-y-6"><div><p className="text-sm font-medium text-sky-700">Action Center</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Входящие преподавателя</h1><p className="mt-2 text-sm text-slate-500">Здесь только действия, которые требуют решения, а не весь поток событий.</p></div>{loading ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : error ? <RequestState title="Не удалось загрузить inbox" description={error} onRetry={load} /> : !items.length ? <EmptyState title="Входящие пусты" description="Новые actionable items появятся здесь." /> : <div className="space-y-5">{Object.entries(grouped).map(([name, inboxItems]) => <section key={name}><div className="mb-2 flex items-center gap-2"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{name}</h2><Badge size="sm" variant="slate">{inboxItems.length}</Badge></div><div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">{inboxItems.map((item) => <Link key={item.id} href={item.deepLink || '/notifications'} className={`block px-4 py-4 transition-colors hover:bg-slate-50 ${item.status === 'open' ? 'border-l-2 border-l-sky-500 bg-sky-50/30' : ''}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p></div><div className="text-right"><span className="text-xs font-medium text-slate-400">{item.status === 'done' ? 'Готово' : item.status === 'snoozed' ? 'Отложено' : 'Открыто'}</span><time className="mt-1 block shrink-0 text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString('ru-RU')}</time></div></div></Link>)}</div></section>)}</div>}</div>;
}
