'use client';

import { useEffect, useState } from 'react';
import { Card, Skeleton } from '@/components/ui';
import { apiFetchList } from '@/lib/api';

type Category = 'all' | 'important' | 'schedule' | 'homework' | 'teachers' | 'system';
interface Notification { id?: string; title?: string; body?: string; category?: Category; priority?: string; deepLink?: string; createdAt?: string; isRead?: boolean; }

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>('all');
  useEffect(() => { apiFetchList<Notification>('/notifications').then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  const filters: Array<{ id: Category; label: string }> = [{ id: 'all', label: 'Все' }, { id: 'important', label: 'Важное' }, { id: 'schedule', label: 'Расписание' }, { id: 'homework', label: 'Задания' }, { id: 'teachers', label: 'Преподаватели' }, { id: 'system', label: 'Система' }];
  const visible = category === 'all' ? items : items.filter((item) => item.category === category);
  return <div className="space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><span>Admin</span><span>/</span><span className="text-slate-900">Уведомления</span></div><div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Центр уведомлений</h1><p className="mt-1 text-sm text-slate-500">События университета с прямыми переходами к связанным объектам</p></div><div role="tablist" aria-label="Категории уведомлений" className="flex gap-1 overflow-x-auto border-b border-slate-200">{filters.map((filter) => <button key={filter.id} type="button" role="tab" aria-selected={category === filter.id} onClick={() => setCategory(filter.id)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${category === filter.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>{filter.label}</button>)}</div><Card padding="sm">{loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16" />)}</div> : visible.length ? <div className="divide-y divide-slate-100">{visible.map((item, index) => <div key={item.id || index} className="flex gap-3 py-4 first:pt-1"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? 'bg-slate-200' : item.priority === 'urgent' || item.priority === 'high' ? 'bg-red-500' : 'bg-slate-900'}`} /><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{item.title || 'Системное уведомление'}</p><p className="mt-1 text-sm text-slate-500">{item.body || 'Содержание уведомления недоступно.'}</p><div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">{item.createdAt && <span>{new Date(item.createdAt).toLocaleString('ru-RU')}</span>}{item.deepLink && <a href={item.deepLink} className="font-semibold text-slate-700 hover:text-slate-950">Открыть объект →</a>}</div></div></div>)}</div> : <p className="py-10 text-center text-sm text-slate-500">В этой категории нет уведомлений.</p>}</Card></div>;
}
