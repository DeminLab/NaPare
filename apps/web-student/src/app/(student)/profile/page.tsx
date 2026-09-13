'use client';

import { useEffect, useState } from 'react';
import { apiFetch, getUser, logout } from '@/lib/api';
import { Card, Avatar, Badge, Button, Skeleton } from '@/components/ui';

interface User {
  id: string; email: string; firstName: string; lastName: string; role: string; universityId: string; isActive: boolean;
  phone?: string; groupName?: string; faculty?: string; direction?: string; universityName?: string; course?: number; createdAt?: string;
}
interface AbsenceStats { total: number; confirmed: number; pending: number; excused: number; }

const valueOrFallback = (value?: string | number | null) => value === undefined || value === null || value === '' ? 'Не указано' : String(value);
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Не указано';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<AbsenceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUser(), apiFetch<AbsenceStats>('/absences/stats/me').catch(() => null)])
      .then(([u, s]) => { setUser(u); setStats(s); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mx-auto max-w-3xl space-y-6"><Skeleton className="h-64" /><Skeleton className="h-52" /></div>;
  if (!user) return null;

  const attendance = stats && stats.total > 0 ? Math.round(((stats.confirmed + stats.excused) / stats.total) * 100) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div><h1 className="ds-page-title text-slate-900">Профиль</h1><p className="ds-body mt-1 text-slate-500">Личная информация и данные об обучении</p></div>
      <Card className="px-6 py-8 text-center sm:px-10">
        <Avatar name={`${user.firstName} ${user.lastName}`} size="lg" className="mx-auto" />
        <h2 className="mt-4 text-2xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
        <p className="mt-1 text-sm text-slate-500">{valueOrFallback(user.groupName)}</p>
        <p className="mt-1 text-sm text-slate-500">{user.course ? `${user.course} курс` : 'Курс не указан'}</p>
        {attendance !== null && <p className="mt-5 text-lg font-bold text-indigo-600">{attendance}% <span className="text-sm font-medium text-slate-500">посещаемость</span></p>}
        <div className="mt-4 flex items-center justify-center gap-2"><Badge variant="brand">Студент</Badge><Badge variant={user.isActive ? 'success' : 'danger'} dot>{user.isActive ? 'Активен' : 'Неактивен'}</Badge></div>
      </Card>

      <section><h2 className="mb-3 text-lg font-bold text-slate-900">Обучение</h2><Card padding="sm" className="divide-y divide-slate-100">
        <div className="flex items-center justify-between gap-4 py-3 first:pt-1"><span className="text-sm text-slate-500">Университет</span><span className="text-right text-sm font-medium text-slate-900">{valueOrFallback(user.universityName || user.universityId)}</span></div>
        <div className="flex items-center justify-between gap-4 py-3"><span className="text-sm text-slate-500">Факультет</span><span className="text-right text-sm font-medium text-slate-900">{valueOrFallback(user.faculty)}</span></div>
        <div className="flex items-center justify-between gap-4 py-3"><span className="text-sm text-slate-500">Направление</span><span className="text-right text-sm font-medium text-slate-900">{valueOrFallback(user.direction)}</span></div>
        <div className="flex items-center justify-between gap-4 py-3 last:pb-1"><span className="text-sm text-slate-500">Группа</span><span className="text-right text-sm font-medium text-slate-900">{valueOrFallback(user.groupName)}</span></div>
      </Card></section>

      <section><h2 className="mb-3 text-lg font-bold text-slate-900">Аккаунт</h2><Card padding="sm" className="divide-y divide-slate-100">
        <div className="flex items-center justify-between gap-4 py-3 first:pt-1"><span className="text-sm text-slate-500">Email</span><span className="break-all text-right text-sm font-medium text-slate-900">{user.email}</span></div>
        <div className="flex items-center justify-between gap-4 py-3"><span className="text-sm text-slate-500">Телефон</span><span className="text-right text-sm font-medium text-slate-900">{valueOrFallback(user.phone)}</span></div>
        <div className="flex items-center justify-between gap-4 py-3 last:pb-1"><span className="text-sm text-slate-500">Дата регистрации</span><span className="text-right text-sm font-medium text-slate-900">{formatDate(user.createdAt)}</span></div>
      </Card></section>

      {stats && <Card padding="sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Пропуски</h2><span className="text-sm text-slate-500">{stats.total} всего</span></div><div className="mt-4 grid grid-cols-3 gap-3 text-center"><div><p className="text-xl font-bold text-emerald-600">{stats.confirmed}</p><p className="text-xs text-slate-500">Подтверждено</p></div><div><p className="text-xl font-bold text-amber-600">{stats.pending}</p><p className="text-xs text-slate-500">Ожидает</p></div><div><p className="text-xl font-bold text-slate-700">{stats.excused}</p><p className="text-xs text-slate-500">Уважительных</p></div></div></Card>}
      <Button variant="danger" fullWidth onClick={logout}>Выйти из аккаунта</Button>
    </div>
  );
}
