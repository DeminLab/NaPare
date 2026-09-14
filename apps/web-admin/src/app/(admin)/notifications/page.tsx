'use client';

import { useEffect, useState } from 'react';
import { Card, Skeleton } from '@/components/ui';
import { apiFetchList } from '@/lib/api';

interface Notification { id?: string; title?: string; message?: string; createdAt?: string; isRead?: boolean; }

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetchList<Notification>('/notifications').then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><span>Admin</span><span>/</span><span className="text-slate-900">Уведомления</span></div><div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Уведомления</h1><p className="mt-1 text-sm text-slate-500">Системные события и уведомления университета</p></div><Card padding="sm">{loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16" />)}</div> : items.length ? <div className="divide-y divide-slate-100">{items.map((item, index) => <div key={item.id || index} className="flex gap-3 py-4 first:pt-1"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? 'bg-slate-200' : 'bg-red-500'}`} /><div><p className="text-sm font-semibold text-slate-900">{item.title || 'Системное уведомление'}</p><p className="mt-1 text-sm text-slate-500">{item.message || 'Содержание уведомления недоступно.'}</p>{item.createdAt && <p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('ru-RU')}</p>}</div></div>)}</div> : <p className="py-10 text-center text-sm text-slate-500">Новых уведомлений нет.</p>}</Card></div>;
}
