'use client';

import { useEffect, useState } from 'react';
import { getUser, getHealth, getToken, getRefreshToken } from '@/lib/api';
import type { UserInfo, HealthInfo } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Skeleton from '@/components/ui/Skeleton';

export default function SessionPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([
      getUser().then(setUser).catch((e) => setError(e instanceof Error ? e.message : 'Ошибка')),
      getHealth().then(setHealth).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const accessToken = typeof window !== 'undefined' ? getToken() : null;
  const refreshToken = typeof window !== 'undefined' ? getRefreshToken() : null;

  const roleColors: Record<string, string> = {
    admin: 'danger',
    developer: 'purple',
    teacher: 'info',
    student: 'success',
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Текущая сессия</h1>
          <p className="mt-1 text-sm text-slate-500">
            Информация об авторизованном пользователе и токенах
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {/* User card */}
        <Card className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">Пользователь</h2>
          </div>

          {loading ? (
            <Skeleton className="h-32" />
          ) : user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <Avatar name={`${user.firstName} ${user.lastName}`} size="lg" />
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">ID</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 font-mono">{user.id}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Роль</p>
                  <div className="mt-0.5">
                    <Badge variant={(roleColors[user.role] as 'danger' | 'purple' | 'info' | 'success') || 'default'}>
                      {user.role}
                    </Badge>
                  </div>
                </div>
                {user.universityId && (
                  <div className="col-span-2 rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">Университет</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 font-mono">{user.universityId}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Данные пользователя недоступны</p>
            </div>
          )}
        </Card>

        {/* Tokens */}
        <Card className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">Токены</h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Access Token</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {accessToken ? `${accessToken.slice(0, 40)}...` : 'Отсутствует'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Refresh Token</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {refreshToken ? `${refreshToken.slice(0, 40)}...` : 'Отсутствует'}
              </p>
            </div>
          </div>
        </Card>

        {/* Server info */}
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">Сервер</h2>
          </div>

          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Статус</p>
                <div className="mt-1">
                  <Badge variant={health?.status === 'ok' ? 'success' : 'danger'}>
                    <span className={`h-1.5 w-1.5 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {health?.status ?? 'Недоступен'}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Время сервера</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 font-mono">
                  {health?.timestamp ?? '—'}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
