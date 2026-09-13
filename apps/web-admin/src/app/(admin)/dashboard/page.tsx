'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface AdminStats {
  totalUsers?: number;
  totalStudents?: number;
  totalTeachers?: number;
  totalGroups?: number;
  recentActivity?: Activity[];
}

interface Activity {
  action?: string;
  user?: string;
  time?: string;
  createdAt?: string;
}

interface ChangedLesson {
  id: string;
  subject: string;
  subjectType?: string;
  groupName?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  changeDescription?: string;
}

interface SyncStatus {
  status?: string;
  lastSync?: string | null;
}

const numberFormatter = new Intl.NumberFormat('ru-RU');

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatTime(value?: string) {
  if (!value) return '—';
  return value.slice(0, 5);
}

function formatSyncDate(value?: string | null) {
  if (!value) return 'Ещё не запускалась';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
      <h2 className="ds-meta font-semibold uppercase tracking-[0.08em] text-slate-700">{title}</h2>
      {meta && <span className="text-xs text-slate-400">{meta}</span>}
    </div>
  );
}

function Metric({ label, value, detail, tone = 'indigo' }: { label: string; value: string | number; detail: string; tone?: 'indigo' | 'green' | 'slate' }) {
  const tones = {
    indigo: 'bg-indigo-500',
    green: 'bg-emerald-500',
    slate: 'bg-slate-400',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1 ${tones[tone]}`} />
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [changes, setChanges] = useState<ChangedLesson[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [statsError, setStatsError] = useState('');
  const [operationsError, setOperationsError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = todayIso();
    Promise.allSettled([
      apiFetch<AdminStats>('/admin/stats'),
      apiFetch<ChangedLesson[]>(`/schedule/changes?date=${date}`),
      apiFetch<SyncStatus>('/admin/schedule/sync-status'),
    ]).then(([statsResult, changesResult, syncResult]) => {
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      else setStatsError(statsResult.reason instanceof Error ? statsResult.reason.message : 'Не удалось загрузить статистику');

      if (changesResult.status === 'fulfilled') setChanges(changesResult.value || []);
      else setOperationsError('Часть операционных данных недоступна');

      if (syncResult.status === 'fulfilled') setSync(syncResult.value);
      else setOperationsError('Часть операционных данных недоступна');

      setLoading(false);
    });
  }, []);

  const dateLabel = useMemo(() => formatDate(new Date()), []);
  const imports = (stats?.recentActivity || []).filter((item) => item.action?.toLowerCase().includes('импорт'));
  const activePercent = stats?.totalUsers && stats.totalUsers > 0 ? '—' : '—';
  const statValue = (value?: number) => (value !== undefined ? numberFormatter.format(value) : '—');
  const syncUnavailable = !sync;
  const syncFailed = sync?.status === 'error';

  if (statsError && !stats) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">{statsError}</div>;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">Операционный центр</p>
          <h1 className="ds-page-title mt-1 text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm capitalize text-slate-500">Сегодня · {dateLabel}</p>
        </div>
        <Link href="/schedule" className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800">
          Открыть расписание →
        </Link>
      </div>

      <section>
        <SectionHeading title="Сегодня" meta={loading ? 'Загрузка…' : 'Сводка университета'} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Студенты" value={loading ? '…' : statValue(stats?.totalStudents)} detail="Всего в университете" />
          <Metric label="Активные" value={loading ? '…' : activePercent} detail="Доля активных пользователей" tone="green" />
          <Metric label="Группы" value={loading ? '…' : statValue(stats?.totalGroups)} detail="Учебные группы" tone="slate" />
          <Metric label="Преподаватели" value={loading ? '…' : statValue(stats?.totalTeachers)} detail="Всего преподавателей" />
        </div>
      </section>

      <section>
        <SectionHeading title="Изменения расписания" meta={`${changes.length} за сегодня`} />
        {operationsError && <p className="mb-3 text-xs text-amber-700">{operationsError}</p>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {changes.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">Изменений за сегодня нет</p>
              <p className="mt-1 text-xs text-slate-400">Данные появятся после синхронизации расписания</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {changes.map((lesson) => (
                <div key={lesson.id} className="grid gap-3 px-5 py-4 md:grid-cols-[92px_1fr_auto] md:items-center">
                  <p className="font-mono text-sm font-semibold text-slate-600">{formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}</p>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{lesson.subject || 'Без названия'}</p>
                    <p className="mt-1 text-xs text-slate-500">{lesson.groupName || 'Группа не указана'} · {lesson.room || 'Аудитория не указана'}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-700">{lesson.changeDescription || 'Расписание изменено'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <SectionHeading title="Последние импорты" />
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {imports.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">История импортов пока пуста</p>
                <p className="mt-1 text-xs text-slate-400">После подключения журнала здесь появятся последние операции</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {imports.slice(0, 5).map((item, index) => (
                  <div key={`${item.createdAt || item.time || 'import'}-${index}`} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.action}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.user || 'Система'}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-400">{item.time || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionHeading title="Состояние коннекторов" />
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${syncFailed ? 'bg-red-500' : syncUnavailable ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Синхронизация расписания</p>
                  <p className="mt-1 text-xs text-slate-500">Статус: {sync?.status || 'неизвестен'}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${syncFailed ? 'bg-red-50 text-red-700' : syncUnavailable ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                {syncFailed ? 'Ошибка' : syncUnavailable ? 'Нет данных' : 'Работает'}
              </span>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
              <span className="text-slate-400">Последний запуск</span>
              <span className="font-medium text-slate-600">{formatSyncDate(sync?.lastSync)}</span>
            </div>
            <Link href="/settings" className="mt-4 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Управлять подключениями →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
