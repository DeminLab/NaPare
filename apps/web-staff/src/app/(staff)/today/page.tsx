'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, Badge, StatCard, EmptyState, Skeleton } from '@/components/ui';

interface Lesson {
  id: string;
  subject: string;
  subjectType: string;
  room: string;
  startTime: string;
  endTime: string;
  pairNumber: number;
  isChanged: boolean;
  changeDescription: string;
  groupName: string;
}

interface MyDayResponse {
  date: string;
  lessons: Lesson[];
  summary: {
    totalLessons: number;
    changedLessons: number;
    totalAbsences: number;
  };
}

const typeLabels: Record<string, string> = {
  lecture: 'Лекция',
  practice: 'Практика',
  lab: 'Лабораторная',
  exam: 'Экзамен',
  consultation: 'Консультация',
  coursework: 'Курсовая',
  test: 'Зачёт',
};

const typeBadgeVariant: Record<string, 'sky' | 'green' | 'amber' | 'pink' | 'purple' | 'indigo' | 'teal'> = {
  lecture: 'sky',
  practice: 'green',
  lab: 'amber',
  exam: 'pink',
  consultation: 'purple',
  coursework: 'indigo',
  test: 'teal',
};

const typeColor: Record<string, string> = {
  lecture: 'border-l-sky-500',
  practice: 'border-l-emerald-500',
  lab: 'border-l-amber-500',
  exam: 'border-l-pink-500',
  consultation: 'border-l-purple-500',
  coursework: 'border-l-indigo-500',
  test: 'border-l-teal-500',
};

function formatDate(date: Date): string {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

export default function TodayPage() {
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<MyDayResponse>('/my-day')
      .then(setDay)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const lessons = day?.lessons ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Сегодня</h1>
        <p className="text-sm capitalize text-slate-500">{formatDate(today)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Пар"
          value={day?.summary?.totalLessons ?? 0}
          gradient="from-sky-500 to-sky-600"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
        />
        <StatCard
          label="Изменений"
          value={day?.summary?.changedLessons ?? 0}
          gradient="from-amber-400 to-amber-500"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
        />
        <StatCard
          label="Пропусков"
          value={day?.summary?.totalAbsences ?? 0}
          gradient="from-purple-500 to-purple-600"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
        />
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
          title="Нет пар"
          description="На сегодня нет запланированных занятий"
        />
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <Link key={lesson.id} href={`/pair-space/${lesson.id}`}>
              <Card hover className={`border-l-4 ${typeColor[lesson.subjectType] || 'border-l-slate-300'}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-center">
                    <p className="text-lg font-bold text-slate-900">{lesson.startTime}</p>
                    <p className="text-xs text-slate-400">{lesson.endTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{lesson.subject}</h3>
                      <Badge variant={typeBadgeVariant[lesson.subjectType] || 'slate'}>
                        {typeLabels[lesson.subjectType] || lesson.subjectType}
                      </Badge>
                    </div>
                    {lesson.groupName && (
                      <p className="mt-1.5 text-sm font-medium text-purple-600">{lesson.groupName}</p>
                    )}
                    {lesson.isChanged && lesson.changeDescription && (
                      <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700">
                        {lesson.changeDescription}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5">
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span className="text-sm font-bold text-slate-700">{lesson.room || '—'}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
