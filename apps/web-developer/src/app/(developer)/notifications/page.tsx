'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Notification { id?: string; title?: string; body?: string; createdAt?: string; isRead?: boolean; }

export default function DeveloperNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  useEffect(() => { apiFetch<{ data: Notification[] }>('/notifications').then((response) => setItems(response.data)).catch(() => setItems([])); }, []);
  const markRead = async (id?: string) => { if (!id) return; try { await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }); setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item)); } catch { /* the event stays unread if the request failed */ } };
  return <div className="min-h-full bg-[#0b0e14] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-5xl space-y-7"><div className="flex items-center gap-2 text-xs text-white/40">Разработчик <span>/</span> <span className="text-white/80">Уведомления</span></div><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Уведомления</h1><p className="mt-1 text-sm text-white/45">Системные события портала разработчика</p></div><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">{items.length ? <div className="divide-y divide-white/10">{items.map((item, index) => <button type="button" key={item.id || index} onClick={() => markRead(item.id)} className="flex w-full gap-3 py-4 text-left first:pt-0"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.isRead ? 'bg-white/20' : 'bg-cyan-300'}`} /><span><span className="block text-sm font-medium text-white/85">{item.title || 'Системное уведомление'}</span><span className="mt-1 block text-sm text-white/45">{item.body || 'Подробности уведомления недоступны.'}</span>{item.createdAt && <span className="mt-1 block text-xs text-white/25">{new Date(item.createdAt).toLocaleString('ru-RU')}</span>}</span></button>)}</div> : <p className="py-10 text-center text-sm text-white/40">Нет уведомлений.</p>}</section></div></div>;
}
