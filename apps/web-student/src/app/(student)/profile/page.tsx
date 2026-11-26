'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchList, getUser, StudentUser } from '@/lib/api';
import { Avatar, Badge, Card, Icon, RequestState, Skeleton } from '@/components/ui';
import { EmptyState } from '@napare/ui';

type ProfileTab = 'profile' | 'study' | 'security' | 'activity';

interface MyDayData {
  lessons?: Array<{ id: string; groupName?: string }>;
  upcomingPreparations?: Array<{ id: string }>;
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
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span className="text-sm text-slate-500">{label}</span><span className="break-words text-sm font-medium text-slate-900 sm:text-right">{value}</span></div>;
}

function ActivityList({ items, limit }: { items: ActivityItem[]; limit?: number }) {
  const visibleItems = limit ? items.slice(0, limit) : items;
  if (!visibleItems.length) return <EmptyState title="Активность пока не зафиксирована" description="Здесь появятся уведомления и события вашего учебного процесса." />;
  return <div className="divide-y divide-slate-100">{visibleItems.map((item) => <div key={item.id} className="flex gap-3 py-4 first:pt-1 last:pb-1"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.isRead === false ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}><Icon name={item.type?.toLowerCase().includes('schedule') ? 'CalendarDays' : item.type?.toLowerCase().includes('homework') ? 'FileText' : 'Bell'} className="h-[17px] w-[17px]" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{item.title}</p>{item.isRead === false && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Непрочитано" />}</div><p className="mt-1 text-sm leading-5 text-slate-500">{item.body || item.description || 'Новое событие в НаПаре'}</p><p className="mt-2 text-xs text-slate-400">{formatActivityDate(item.createdAt)}</p></div></div>)}</div>;
}

function ProfileContent({ user }: { user: StudentUser }) {
  return <Card padding="sm"><h2 className="mb-2 text-base font-semibold text-slate-900">Данные аккаунта</h2><Link href="/semester" className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-blue-700">Мой семестр<Icon name="ChevronRight" className="h-4 w-4" /></Link><InfoRow label="Email" value={user.email} /><InfoRow label="Аккаунт" value={user.isActive ? 'Активен' : 'Неактивен'} /><a href="/career?tab=profile" className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-slate-100 text-sm font-semibold text-blue-700">Портфолио и навыки<Icon name="ChevronRight" className="h-4 w-4" /></a></Card>;
}

export default function ProfilePage() {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [day, setDay] = useState<MyDayData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[] | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getUser(), apiFetch<MyDayData>('/my-day?timeZone=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)).catch(() => null), apiFetchList<ActivityItem>('/notifications').catch(() => null)]).then(([profile, today, notificationItems]) => { setUser(profile); setDay(today); setActivities(notificationItems); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль.')).finally(() => setLoading(false));
  }, []);

  const fullName = useMemo(() => user ? `${user.firstName} ${user.lastName}` : '', [user]);
  if (loading) return <div className="mx-auto max-w-[1400px] space-y-6"><h1 className="sr-only">Профиль</h1><Skeleton className="h-44" /><Skeleton className="h-14" /><Skeleton className="h-[420px]" /></div>;
  if (!user) return <div className="mx-auto max-w-[1400px]"><h1 className="sr-only">Профиль</h1><RequestState title="Не удалось загрузить профиль" description={error || 'Данные профиля недоступны.'} onRetry={() => window.location.reload()} /></div>;

  return <div className="student-content student-profile-page mx-auto max-w-[1400px] space-y-6"><header className="student-page-heading"><p className="student-page-kicker">Личный кабинет студента</p><h1>Профиль</h1><p>Персональные данные, учебная информация и подключённые сервисы.</p></header><Card className="student-profile-hero overflow-hidden border-0 bg-gradient-to-r from-blue-950 via-blue-700 to-cyan-500 px-5 py-5 text-white shadow-lg sm:px-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4 sm:gap-5"><Avatar name={fullName} size="lg" /><div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">Студент NaPare</p><h2 className="profile-name text-2xl font-bold tracking-tight text-white">{fullName}</h2><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="brand">Студент</Badge>{(user.groupName || day?.lessons?.some(lesson => lesson.groupName)) && <Badge variant="neutral">{user.groupName || day?.lessons?.find(lesson => lesson.groupName)?.groupName}</Badge>}</div>{user.universityName && <p className="mt-2 text-sm text-cyan-100">{user.universityName}</p>}</div></div><Link href="/settings?section=general" className="inline-flex min-h-11 items-center rounded-xl border border-white/50 bg-white px-4 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50">Редактировать профиль</Link></div></Card><div role="group" aria-label="Разделы профиля" className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 sm:flex">{tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon name={tab.icon} className="h-4 w-4" />{tab.label}</button>)}</div>{activeTab === 'profile' && <div className="student-profile-columns grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><ProfileContent user={user} /><Card padding="sm"><h2 className="mb-2 text-base font-bold text-slate-900">Учебные результаты</h2><p className="text-sm leading-6 text-slate-500">Оценки и экзаменационные результаты появятся здесь после подключения официального источника университета.</p><Link href="/semester" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-50 px-4 text-sm font-semibold text-blue-700">Открыть мой семестр<Icon name="ChevronRight" className="h-4 w-4" /></Link></Card></div>}{activeTab === 'study' && <Card padding="sm"><h2 className="mb-2 text-base font-bold text-slate-900">Учебная информация</h2><InfoRow label="Университет" value={valueOrFallback(user.universityName)} /><InfoRow label="Группа" value={valueOrFallback(user.groupName || day?.lessons?.find(lesson => lesson.groupName)?.groupName)} /><div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Данные учебной группы синхронизируются с университетом.</div></Card>}{activeTab === 'security' && <Card padding="sm"><h2 className="text-base font-bold text-slate-900">Безопасность аккаунта</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Вход и подключения аккаунта. Пароль выдаёт и меняет администратор университета.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/settings?section=security" className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Как изменить пароль</Link><a href="/connections" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Подключить MAX</a></div></Card>}{activeTab === 'activity' && <Card padding="sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Последняя активность</h2><span className="text-sm text-slate-500">{activities === null ? 'Сведения недоступны' : `${activities.length} событий`}</span></div>{activities === null ? <RequestState headingLevel={3} title="Активность недоступна" description="Не удалось загрузить события." onRetry={() => window.location.reload()} /> : <ActivityList items={activities} />}</Card>}</div>;
}
