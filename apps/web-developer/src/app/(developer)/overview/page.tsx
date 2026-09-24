'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, getHealth, getUser } from '@/lib/api';
import type { HealthInfo, UserInfo } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

interface Notice { id?: string; title?: string; body?: string; }
interface Telemetry { requests?: number; activeSessions?: number; errors?: number; }

const status = (online: boolean | null) => {
  if (online === null) return { label: 'Неизвестно', variant: 'default' as const };
  return online ? { label: 'Работает', variant: 'success' as const } : { label: 'Недоступно', variant: 'danger' as const };
};

function EmptyChart({ title }: { title: string }) {
  return <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 text-center"><div><div className="mx-auto mb-3 h-2 w-28 rounded-full bg-white/10" /><p className="text-sm text-white/45">{title}</p><p className="mt-1 text-xs text-white/25">Телеметрия не подключена</p></div></div>;
}

export default function DeveloperOverviewPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activity, setActivity] = useState<Notice[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [healthData, userData, notifications, telemetryData] = await Promise.all([
      getHealth().catch(() => null),
      getUser().catch(() => null),
      apiFetch<{ data: Notice[] }>('/notifications').then((response) => response.data).catch(() => []),
      apiFetch<Telemetry>('/developer/telemetry').catch(() => null),
    ]);
    setHealth(healthData); setUser(userData); setActivity(notifications); setTelemetry(telemetryData); setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const backend = status(Boolean(health));
  const auth = status(Boolean(user));
  const metrics = [
    { label: 'Статус API', value: backend.label },
    { label: 'Запросы', value: telemetry?.requests ?? '—' },
    { label: 'Активные сессии', value: telemetry?.activeSessions ?? '—' },
    { label: 'Ошибки', value: telemetry?.errors ?? '—' },
  ];
  const actions = [{ label: 'API Explorer', href: '/api' }, { label: 'Документация', href: '/docs' }, { label: 'Архитектура', href: '/architecture' }, { label: 'Сессии', href: '/session' }];

  return <div className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex items-center gap-2 text-xs text-white/40">Разработчик <span>/</span> <span className="text-white/80">Обзор</span></div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Обзор панели разработчика</h1><p className="mt-1 text-sm text-white/45">Состояние API-платформы и операционная телеметрия</p></div><Button variant="secondary" onClick={load}>Обновить</Button></div>
    {loading ? <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map((metric) => <Card key={metric.label} className="border-white/10 bg-white/[0.04]"><Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-7 w-20" /></Card>)}</div> : <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map((metric) => <Card key={metric.label} className="border-white/10 bg-white/[0.04]"><p className="text-xs uppercase tracking-wider text-white/40">{metric.label}</p><p className="mt-3 text-2xl font-bold text-white">{metric.value}</p></Card>)}</div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2"><Card className="border-white/10 bg-white/[0.04]"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-white/70">График использования API</h2><span className="text-xs text-white/35">Последние 24 часа</span></div><EmptyChart title={telemetry ? 'Данные использования готовы к построению' : 'Нет данных об использовании API'} /></Card><Card className="border-white/10 bg-white/[0.04]"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-white/70">График запросов</h2><span className="text-xs text-white/35">Запросы</span></div><EmptyChart title="Нет данных телеметрии запросов" /></Card></div>
      <Card className="border-white/10 bg-white/[0.04]"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Доля ошибок</h2><Badge variant="default">Недоступно</Badge></div><EmptyChart title="Данные о доле ошибок недоступны" /></Card>
      <Card className="border-white/10 bg-white/[0.04]"><h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Последняя активность</h2>{activity.length ? <div className="mt-3 divide-y divide-white/10">{activity.slice(0, 6).map((item, index) => <div key={item.id || index} className="py-3"><p className="text-sm text-white/75">{item.title || 'Системное событие'}</p><p className="mt-1 text-xs text-white/35">{item.body || 'Событие уведомления'}</p></div>)}</div> : <p className="mt-4 text-sm text-white/40">Активности пока нет.</p>}</Card>
    </div><aside className="space-y-6"><Card className="border-white/10 bg-white/[0.04]"><h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Быстрые действия</h2><div className="mt-3 grid gap-2">{actions.map((item) => <Link key={item.href} href={item.href} className="rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">{item.label}<span className="float-right text-white/35">→</span></Link>)}</div></Card><Card className="border-white/10 bg-white/[0.04]"><h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Состояние системы</h2><div className="mt-3 divide-y divide-white/10"><div className="flex items-center justify-between py-3 text-sm text-white/65"><span>Бэкенд</span><Badge variant={backend.variant}>{backend.label}</Badge></div><div className="flex items-center justify-between py-3 text-sm text-white/65"><span>База данных</span><Badge variant="default">Неизвестно</Badge></div><div className="flex items-center justify-between py-3 text-sm text-white/65"><span>Аутентификация</span><Badge variant={auth.variant}>{auth.label}</Badge></div><div className="flex items-center justify-between py-3 text-sm text-white/65"><span>Вебхуки</span><Badge variant="default">Неизвестно</Badge></div></div></Card></aside></div>
  </div></div>;
}
