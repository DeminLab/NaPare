'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetchList, markAllRead, markNotificationRead } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Notification { id: string; title: string; body: string; type: string; category?: 'all' | 'important' | 'schedule' | 'homework' | 'teachers' | 'system'; isRead: boolean; createdAt: string; deepLink?: string; actions?: Array<{ label: string; href: string }>; data?: Record<string, unknown>; }
type Filter = 'all' | 'important' | 'schedule' | 'homework' | 'teachers' | 'system';

const filters: Array<{ id: Filter; label: string }> = [{ id: 'all', label: 'Все' }, { id: 'important', label: 'Важное' }, { id: 'schedule', label: 'Расписание' }, { id: 'homework', label: 'Задания' }, { id: 'teachers', label: 'Преподаватели' }, { id: 'system', label: 'Система' }];

function timeAgo(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return 'только что'; if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`; if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`; return new Date(value).toLocaleDateString('ru-RU'); }
function actorName(notification: Notification) { const data = notification.data || {}; return String(data.studentName || data.actorName || data.authorName || 'НаПаре'); }
function actionFor(notification: Notification) { return notification.actions?.[0] || (notification.deepLink ? { label: 'Открыть', href: notification.deepLink } : null); }

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => { setLoading(true); setError(''); apiFetchList<Notification>('/notifications').then(setNotifications).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить уведомления.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const unread = notifications.filter((item) => !item.isRead).length;
  const visible = useMemo(() => filter === 'all' ? notifications : notifications.filter((item) => item.category === filter), [filter, notifications]);
  const markRead = async (id: string) => { try { await markNotificationRead(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item)); } catch { /* keep the notification unread when API is unavailable */ } };
  const markEverythingRead = async () => { try { await markAllRead(); setNotifications((items) => items.map((item) => ({ ...item, isRead: true }))); } catch { setError('Не удалось отметить уведомления прочитанными.'); } };

  return <div className="mx-auto max-w-[1180px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><Link href="/today" className="hover:text-sky-600">НаПаре</Link><span>/</span><span className="text-slate-900">Уведомления</span></div><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Уведомления</h1><p className="mt-1 text-sm text-slate-500">{unread ? `${unread} непрочитанных` : 'Все уведомления прочитаны'}</p></div>{unread > 0 && <Button variant="ghost" size="sm" onClick={markEverythingRead}>Отметить все прочитанными</Button>}</div><div role="tablist" aria-label="Фильтры уведомлений" className="flex gap-1 overflow-x-auto border-b border-slate-200">{filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${filter === item.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'}`}>{item.label}</button>)}</div>{loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <Card key={item}><Skeleton className="h-20" /></Card>)}</div> : error ? <RequestState title="Не удалось загрузить уведомления" description={error} onRetry={load} /> : !visible.length ? <EmptyState title="Нет уведомлений" description={filter === 'all' ? 'Здесь появятся события учебного процесса.' : 'В этом разделе пока нет событий.'} /> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="hidden grid-cols-[180px_minmax(0,1fr)_100px_190px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"><span>Кто</span><span>Событие</span><span>Время</span><span>Действие</span></div><div className="divide-y divide-slate-100">{visible.map((notification) => { const action = actionFor(notification); return <div key={notification.id} className={`grid gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_100px_190px] md:items-center md:gap-4 md:px-5 ${!notification.isRead ? 'bg-sky-50/40' : ''}`} onClick={() => !notification.isRead && markRead(notification.id)}><div><span className="text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">Кто</span><p className="mt-1 text-sm font-semibold text-slate-800 md:mt-0">{actorName(notification)}</p></div><div className="min-w-0"><div className="flex items-start gap-2"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden="true" /><div><p className="text-sm font-semibold text-slate-900">{notification.title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{notification.body}</p></div></div></div><div><span className="text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">Время</span><p className="mt-1 text-xs text-slate-500 md:mt-0">{timeAgo(notification.createdAt)}</p></div><div>{action && <Link href={action.href} onClick={() => markRead(notification.id)} className="inline-flex min-h-9 items-center rounded-lg px-2.5 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">{action.label} →</Link>}</div></div>; })}</div></div>}</div>;
}
