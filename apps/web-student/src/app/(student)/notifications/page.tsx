'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetchList, markNotificationRead, markAllRead } from '@/lib/api';
import { Card, Button, EmptyState, Icon, IconName, Badge, RequestState, Skeleton } from '@/components/ui';

interface Notification { id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string; deepLink?: string; }

const typeIcons: Record<string, IconName> = { schedule_change: 'CalendarDays', new_announcement: 'Megaphone', new_homework: 'FileText', new_file: 'Paperclip', deadline: 'Clock', absence_decision: 'ClipboardCheck', new_absence: 'XCircle', system: 'Settings', other: 'Bell' };
const importantTypes = new Set(['schedule_change', 'deadline', 'new_absence', 'system']);

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(dateStr).toLocaleDateString('ru-RU');
}
const isToday = (dateStr: string) => new Date(dateStr).toDateString() === new Date().toDateString();

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = () => { setLoading(true); setError(''); apiFetchList<Notification>('/notifications').then(data => setNotifications(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))).catch(err => setError(err instanceof Error ? err.message : 'Не удалось загрузить уведомления.')).finally(() => setLoading(false)); };
  useEffect(() => { loadNotifications(); }, []);

  const handleNotification = async (notification: Notification) => {
    if (!notification.isRead) await handleMarkRead(notification.id);
    if (notification.deepLink?.startsWith('/')) router.push(notification.deepLink);
  };
  const handleMarkRead = async (id: string) => { await markNotificationRead(id); setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n)); };
  const handleMarkAllRead = async () => { await markAllRead(); setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); };
  const unread = notifications.filter(n => !n.isRead);
  const today = notifications.filter(n => isToday(n.createdAt));
  const earlier = notifications.filter(n => !isToday(n.createdAt));

  const renderNotification = (n: Notification) => {
    const important = importantTypes.has(n.type);
    return <Card key={n.id} hover padding="sm" onClick={() => void handleNotification(n)} className={`${!n.isRead ? 'border-indigo-200 bg-indigo-50/40' : ''} ${important ? 'border-l-4 border-l-amber-400' : ''} ${n.deepLink?.startsWith('/') ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start gap-3"><div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${important ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}><Icon name={typeIcons[n.type] || 'Bell'} className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{n.title}</h3>{important && <Badge variant="warning" size="sm">Важно</Badge>}{!n.isRead && <span className="h-2 w-2 rounded-full bg-indigo-500" />}</div><p className="mt-1 text-sm leading-relaxed text-slate-600">{n.body}</p><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-slate-400">{timeAgo(n.createdAt)}</p>{n.deepLink?.startsWith('/') && <span className="text-xs font-semibold text-indigo-600">Открыть →</span>}</div></div></div>
    </Card>;
  };

  return <div className="mx-auto max-w-3xl space-y-8">
    <div className="flex items-center justify-between"><div><h1 className="ds-page-title text-slate-900">Уведомления</h1>{unread.length > 0 && <p className="ds-body mt-1 text-slate-500">{unread.length} непрочитанных</p>}</div>{unread.length > 0 && <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>Прочитать все</Button>}</div>
    {loading ? <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i}><Skeleton className="h-16" /></Card>)}</div> : error ? <RequestState title="Не удалось загрузить уведомления" description={error} onRetry={loadNotifications} /> : notifications.length === 0 ? <EmptyState icon={<Icon name="Bell" className="h-8 w-8" />} title="Нет уведомлений" description="Здесь будут появляться изменения расписания и важные новости" /> : <div className="space-y-8">
      {today.length > 0 && <section><h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Сегодня</h2><div className="space-y-2">{today.map(renderNotification)}</div></section>}
      {earlier.length > 0 && <section><div className="mb-3 flex items-center gap-3"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Ранее</h2><div className="h-px flex-1 bg-slate-200" /></div><div className="space-y-2">{earlier.map(renderNotification)}</div></section>}
    </div>}
  </div>;
}
