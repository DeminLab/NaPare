'use client';

import { useEffect, useState } from 'react';
import { apiFetch, markNotificationRead, markAllRead } from '@/lib/api';
import { Card, Button, EmptyState } from '@/components/ui';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  schedule_change: '📅',
  new_announcement: '📢',
  new_homework: '📝',
  new_file: '📎',
  deadline: '⏰',
  absence_decision: '📋',
  new_absence: '❌',
  system: '⚙️',
  other: '🔔',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return date.toLocaleDateString('ru-RU');
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    setLoading(true);
    apiFetch<Notification[]>('/notifications')
      .then(data => setNotifications(data))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unread = notifications.filter(n => !n.isRead);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Уведомления</h1>
          {unread.length > 0 && <p className="text-sm text-slate-500">{unread.length} непрочитанных</p>}
        </div>
        {unread.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>Прочитать все</Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100">&nbsp;</Card>)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>}
          title="Нет уведомлений"
          description="Здесь будут появляться уведомления об изменениях расписания и важных новостях"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              hover
              padding="sm"
              onClick={() => !n.isRead && handleMarkRead(n.id)}
              className={!n.isRead ? 'border-purple-200 bg-purple-50/50' : ''}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 text-xl">{typeIcons[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{n.title}</h3>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-purple-500" />}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
