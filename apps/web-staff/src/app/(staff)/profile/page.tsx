'use client';

import { useEffect, useState } from 'react';
import { getUser, logout } from '@/lib/api';
import { Card, Avatar, Badge, Button, Skeleton } from '@/components/ui';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  universityId: string;
  isActive: boolean;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUser()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
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
          <Badge variant="purple">Преподаватель</Badge>
          {user.isActive ? (
            <Badge variant="green" dot>Активен</Badge>
          ) : (
            <Badge variant="red" dot>Неактивен</Badge>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-bold text-slate-900">Информация</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm font-medium text-slate-900">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">ID университета</span>
            <span className="text-sm font-medium text-slate-900">{user.universityId || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Роль</span>
            <span className="text-sm font-medium text-slate-900">Преподаватель</span>
          </div>
        </div>
      </Card>

      <Button variant="danger" fullWidth onClick={logout}>Выйти из аккаунта</Button>
    </div>
  );
}
