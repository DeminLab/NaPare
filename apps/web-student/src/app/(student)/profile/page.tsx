'use client';

import { useEffect, useState } from 'react';
import { apiFetch, getUser, logout } from '@/lib/api';
import { Card, Avatar, Badge, Button, Skeleton } from '@/components/ui';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  universityId: string;
  isActive: boolean;
  phone?: string;
}

interface AbsenceStats {
  total: number;
  confirmed: number;
  pending: number;
  excused: number;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<AbsenceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getUser(),
      apiFetch<AbsenceStats>('/absences/stats/me').catch(() => null),
    ]).then(([u, s]) => {
      setUser(u);
      setStats(s);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Профиль</h1>

      <Card className="text-center">
        <Avatar name={`${user.firstName} ${user.lastName}`} size="lg" className="mx-auto" />
        <h2 className="mt-4 text-xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
        <p className="text-sm text-slate-500">{user.email}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge variant="sky">Студент</Badge>
          {user.isActive ? (
            <Badge variant="green" dot>Активен</Badge>
          ) : (
            <Badge variant="red" dot>Неактивен</Badge>
          )}
        </div>
      </Card>

      {stats && (
        <Card>
          <h3 className="mb-4 font-bold text-slate-900">Пропуски</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Всего</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-emerald-600">{stats.confirmed}</p>
              <p className="text-xs text-slate-500">Подтв.</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-slate-500">Ожидает</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-purple-600">{stats.excused}</p>
              <p className="text-xs text-slate-500">Уважит.</p>
            </div>
          </div>
        </Card>
      )}

      <Button variant="danger" fullWidth onClick={logout}>Выйти из аккаунта</Button>
    </div>
  );
}
