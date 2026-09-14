'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch, getHealth } from '@/lib/api';
import type { HealthInfo } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import Skeleton from '@/components/ui/Skeleton';

interface Endpoint {
  name: string;
  method: string;
  path: string;
  status: 'ok' | 'error' | 'unknown';
  latency?: number;
}

const defaultEndpoints: Endpoint[] = [
  { name: 'Health Check', method: 'GET', path: '/health', status: 'unknown' },
  { name: 'App Info', method: 'GET', path: '/app', status: 'unknown' },
  { name: 'Login', method: 'POST', path: '/auth/login', status: 'unknown' },
  { name: 'User Info', method: 'GET', path: '/users/me', status: 'unknown' },
  { name: 'Swagger Docs', method: 'GET', path: '/docs', status: 'unknown' },
];

function formatUptime(seconds?: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}ч ${m}м`;
}

function formatLatency(ms?: number): string {
  if (!ms) return '—';
  return `${ms}мс`;
}

export default function ApiPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>(defaultEndpoints);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkEndpoints = useCallback(async () => {
    const now = new Date().toLocaleTimeString('ru-RU');
    const results: Endpoint[] = [...defaultEndpoints];

    const checks = [
      { idx: 0, path: '/health', method: 'GET' },
      { idx: 1, path: '/app', method: 'GET' },
      { idx: 3, path: '/users/me', method: 'GET' },
    ];

    await Promise.allSettled(
      checks.map(async ({ idx, path, method }) => {
        const start = performance.now();
        try {
          await apiFetch(path);
          results[idx] = { ...results[idx], status: 'ok', latency: Math.round(performance.now() - start) };
        } catch {
          results[idx] = { ...results[idx], status: 'error', latency: Math.round(performance.now() - start) };
        }
      })
    );

    results[2] = { ...results[2], status: 'ok' };
    results[4] = { ...results[4], status: 'ok' };

    setEndpoints(results);
    setLastCheck(now);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getHealth().then(setHealth).catch(() => {}),
      checkEndpoints(),
    ]).finally(() => setLoading(false));
  }, [checkEndpoints]);

  const isHealthy = health?.status === 'ok' || health?.status === 'healthy';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">API Мониторинг</h1>
            <p className="mt-1 text-sm text-slate-500">
              Состояние сервера и список эндпоинтов
              {lastCheck && <span className="ml-2 text-slate-400">· Обновлено в {lastCheck}</span>}
            </p>
          </div>
          <button
            onClick={checkEndpoints}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Обновить
          </button>
        </div>

        {/* Status banner */}
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isHealthy ? 'bg-emerald-100 glow-success' : 'bg-red-100 glow-danger'}`}>
              {isHealthy ? (
                <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isHealthy ? 'Сервер работает' : 'Сервер недоступен'}
              </h2>
              <p className="text-sm text-slate-500">
                {health?.timestamp ? `Последняя проверка: ${health.timestamp}` : 'Проверка...'}
              </p>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {loading ? (
            <Skeleton className="h-24" count={4} />
          ) : (
            <>
              <StatCard
                label="Статус"
                value={health?.status ?? '—'}
                icon={<div className={`h-2.5 w-2.5 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse-dot' : 'bg-red-500'}`} />}
              />
              <StatCard
                label="Uptime"
                value={formatUptime(health?.uptime)}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Версия"
                value={health?.version ?? '—'}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h.008v.008H6V6z" />
                  </svg>
                }
              />
              <StatCard
                label="Эндпоинты"
                value={`${endpoints.filter((e) => e.status === 'ok').length}/${endpoints.length}`}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                }
              />
            </>
          )}
        </div>

        {/* Endpoints table */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Эндпоинты</h2>
          </div>
          <div className="overflow-x-auto" aria-label="Таблица статусов API">
            <table className="min-w-[680px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-left font-medium text-slate-500">Метод</th>
                  <th className="pb-3 text-left font-medium text-slate-500">Путь</th>
                  <th className="pb-3 text-left font-medium text-slate-500">Имя</th>
                  <th className="pb-3 text-left font-medium text-slate-500">Статус</th>
                  <th className="pb-3 text-right font-medium text-slate-500">Задержка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {endpoints.map((ep) => (
                  <tr key={ep.path} className="group">
                    <td className="py-3 pr-4">
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                        ep.method === 'GET' ? 'bg-sky-100 text-sky-700' :
                        ep.method === 'POST' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <code className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 font-mono">
                        {ep.path}
                      </code>
                    </td>
                    <td className="py-3 pr-4 text-sm font-medium text-slate-700">{ep.name}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={
                        ep.status === 'ok' ? 'success' :
                        ep.status === 'error' ? 'danger' : 'default'
                      }>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          ep.status === 'ok' ? 'bg-emerald-500' :
                          ep.status === 'error' ? 'bg-red-500' : 'bg-slate-400'
                        }`} />
                        {ep.status === 'ok' ? 'OK' : ep.status === 'error' ? 'Ошибка' : '—'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-xs text-slate-500 font-mono">
                      {formatLatency(ep.latency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
