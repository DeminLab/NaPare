'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchList, getUser, StudentUser } from '@/lib/api';
import { Avatar, Badge, Button, Card, EmptyState, Icon, RequestState, Skeleton } from '@/components/ui';

type ProfileTab = 'profile' | 'study' | 'security' | 'activity';

interface MyDayData {
  lessons?: Array<{ id: string }>;
  pairSpaces?: Array<{ homeworks?: Array<{ id: string; isCompleted?: boolean }> }>;
}

interface ActivityItem {
  id: string;
  title: string;
  body?: string;
  description?: string;
  createdAt: string;
  isRead?: boolean;
  type?: string;
}

const tabs: Array<{ id: ProfileTab; label: string; icon: 'User' | 'BookOpen' | 'Settings' | 'Clock' }> = [
  { id: 'profile', label: 'Профиль', icon: 'User' },
  { id: 'study', label: 'Учёба', icon: 'BookOpen' },
  { id: 'security', label: 'Безопасность', icon: 'Settings' },
  { id: 'activity', label: 'Активность', icon: 'Clock' },
];

const valueOrFallback = (value?: string | null) => value?.trim() || 'Не указано';

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Недавно';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span className="text-sm text-slate-500">{label}</span><span className="break-words text-sm font-medium text-slate-900 sm:text-right">{value}</span></div>;
}

function ActivityList({ items, limit }: { items: ActivityItem[]; limit?: number }) {
  const visibleItems = limit ? items.slice(0, limit) : items;
  if (!visibleItems.length) return <EmptyState title="Активность пока не зафиксирована" description="Здесь появятся уведомления и события вашего учебного процесса." />;
  return <div className="divide-y divide-slate-100">{visibleItems.map((item) => <div key={item.id} className="flex gap-3 py-4 first:pt-1 last:pb-1"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.isRead === false ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}><Icon name={item.type?.toLowerCase().includes('schedule') ? 'CalendarDays' : item.type?.toLowerCase().includes('homework') ? 'FileText' : 'Bell'} className="h-[17px] w-[17px]" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{item.title}</p>{item.isRead === false && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="Непрочитано" />}</div><p className="mt-1 text-sm leading-5 text-slate-500">{item.body || item.description || 'Новое событие в НаПаре'}</p><p className="mt-2 text-xs text-slate-400">{formatActivityDate(item.createdAt)}</p></div></div>)}</div>;
}

function ProfileContent({ user, day, activities }: { user: StudentUser; day: MyDayData | null; activities: ActivityItem[] }) {
  const homeworkCount = day?.pairSpaces?.flatMap((space) => space.homeworks || []).filter((homework) => !homework.isCompleted).length;
  const stats = [
    { label: 'Посещаемость', value: '—', note: 'Нет данных' },
    { label: 'Задания', value: homeworkCount === undefined ? '—' : String(homeworkCount), note: 'На сегодня' },
    { label: 'Уведомления', value: String(activities.length), note: 'Всего' },
    { label: 'Пары', value: day?.lessons ? String(day.lessons.length) : '—', note: 'Сегодня' },
  ];
  return <div className="space-y-6"><div className="grid gap-6 lg:grid-cols-2"><Card padding="sm"><h2 className="mb-2 text-base font-bold text-slate-900">Личная информация</h2><InfoRow label="Имя" value={user.firstName} /><InfoRow label="Фамилия" value={user.lastName} /><InfoRow label="Статус" value="Студент" /></Card><Card padding="sm"><h2 className="mb-2 text-base font-bold text-slate-900">Контакты</h2><InfoRow label="Email" value={user.email} /><InfoRow label="Телефон" value="Не указан" /><InfoRow label="Аккаунт" value={user.isActive ? 'Активен' : 'Неактивен'} /></Card></div><Card padding="sm"><h2 className="mb-2 text-base font-bold text-slate-900">Учебная информация</h2><InfoRow label="Университет" value={valueOrFallback(user.universityName || user.universityId)} /><InfoRow label="Факультет" value="Не указан" /><InfoRow label="Группа" value={valueOrFallback(user.groupName)} /></Card><section><h2 className="mb-3 text-base font-bold text-slate-900">Статистика</h2><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map((stat) => <Card key={stat.label} padding="sm" className="min-h-[108px]"><p className="text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p><p className="mt-1 text-sm font-medium text-slate-700">{stat.label}</p><p className="mt-1 text-xs text-slate-400">{stat.note}</p></Card>)}</div></section><Card padding="sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold text-slate-900">Последняя активность</h2>{activities.length > 4 && <span className="text-xs text-slate-400">{activities.length} событий</span>}</div><ActivityList items={activities} limit={4} /></Card></div>;
}

export default function ProfilePage() {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [day, setDay] = useState<MyDayData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getUser(), apiFetch<MyDayData>('/my-day').catch(() => null), apiFetchList<ActivityItem>('/notifications').catch(() => [])]).then(([profile, today, notificationItems]) => { setUser(profile); setDay(today); setActivities(notificationItems); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль.')).finally(() => setLoading(false));
  }, []);

  const fullName = useMemo(() => user ? `${user.firstName} ${user.lastName}` : '', [user]);
  if (loading) return <div className="mx-auto max-w-[1400px] space-y-6"><Skeleton className="h-44" /><Skeleton className="h-14" /><Skeleton className="h-[420px]" /></div>;
  if (!user) return <div className="mx-auto max-w-[1400px]"><RequestState title="Не удалось загрузить профиль" description={error || 'Данные профиля недоступны.'} onRetry={() => window.location.reload()} /></div>;

  return <div className="mx-auto max-w-[1400px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><Link href="/today" className="transition-colors hover:text-indigo-600">НаПаре</Link><span>/</span><span className="text-slate-900">Профиль</span></div><Card className="overflow-hidden px-5 py-5 sm:px-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4 sm:gap-5"><Avatar name={fullName} size="lg" /><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{fullName}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="brand">Студент</Badge><Badge variant="neutral">{valueOrFallback(user.groupName)}</Badge></div><p className="mt-2 text-sm text-slate-500">{valueOrFallback(user.universityName || user.universityId)}</p></div></div><Link href="/settings"><Button variant="secondary">Редактировать</Button></Link></div></Card><div role="tablist" aria-label="Разделы профиля" className="flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'}`}><Icon name={tab.icon} className="h-4 w-4" />{tab.label}</button>)}</div>{activeTab === 'profile' && <ProfileContent user={user} day={day} activities={activities} />}{activeTab === 'study' && <Card padding="sm"><h2 className="mb-2 text-base font-bold text-slate-900">Учебная информация</h2><InfoRow label="Университет" value={valueOrFallback(user.universityName || user.universityId)} /><InfoRow label="Факультет" value="Не указан" /><InfoRow label="Группа" value={valueOrFallback(user.groupName)} /><div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Данные учебной группы синхронизируются с университетом.</div></Card>}{activeTab === 'security' && <Card padding="sm"><h2 className="text-base font-bold text-slate-900">Безопасность аккаунта</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Управляйте паролем и настройками доступа в разделе настроек.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/settings"><Button>Открыть настройки</Button></Link><Link href="/settings"><Button variant="secondary">Изменить пароль</Button></Link></div></Card>}{activeTab === 'activity' && <Card padding="sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Последняя активность</h2><span className="text-sm text-slate-500">{activities.length} событий</span></div><ActivityList items={activities} /></Card>}</div>;
}
