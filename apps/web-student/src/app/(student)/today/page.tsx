'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, Badge, Skeleton, EmptyState } from '@/components/ui';

interface Lesson {
  id: string;
  subject: string;
  subjectType: string;
  teacherName: string;
  room: string;
  startTime: string;
  endTime: string;
  pairNumber: number;
  isChanged: boolean;
  changeDescription: string;
  groupName: string;
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

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

export default function TodayPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    apiFetch<Lesson[]>(`/schedule?date=${selectedDate}`)
      .then(data => setLessons(data))
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const today = new Date(selectedDate);
  const dayLabel = isToday(selectedDate) ? 'Сегодня' : formatDate(today);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Date selector */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigateDate(-1)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">{dayLabel}</h1>
          <p className="text-sm text-slate-500">{formatDate(today)}</p>
        </div>
        <button onClick={() => navigateDate(1)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Lessons */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <Skeleton className="h-24" />
            </Card>
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
          title="Нет пар"
          description="В этот день нетcheduled занятий"
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
                    <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                      {lesson.teacherName && (
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          {lesson.teacherName}
                        </span>
                      )}
                      {lesson.room && (
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {lesson.room}
                        </span>
                      )}
                    </div>
                    {lesson.isChanged && (
                      <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700">
                        ⚠️ {lesson.changeDescription || 'Изменение'}
                      </div>
                    )}
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
