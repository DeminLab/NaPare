'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui';

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
  groupName: string;
}

interface DaySchedule {
  date: string;
  dayName: string;
  lessons: Lesson[];
}

const typeLabels: Record<string, string> = {
  lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная',
  exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт',
};

const typeBadgeVariant: Record<string, 'sky' | 'green' | 'amber' | 'pink' | 'purple' | 'indigo' | 'teal'> = {
  lecture: 'sky', practice: 'green', lab: 'amber', exam: 'pink',
  consultation: 'purple', coursework: 'indigo', test: 'teal',
};

function getWeekDates(baseDate: Date): { start: Date; end: Date } {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  return { start, end };
}

function formatMonth(date: Date): string {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return `${days[d.getDay()]} ${d.getDate()}`;
}

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekDates(new Date()).start);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 5);
    const start = weekStart;
    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    setLoading(true);
    apiFetch<Lesson[]>(`/schedule/range?startDate=${startDate}&endDate=${endDate}`)
      .then(lessons => {
        const days: DaySchedule[] = [];
        for (let i = 0; i < 6; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
          days.push({
            date: dateStr,
            dayName: dayNames[d.getDay()],
            lessons: lessons.filter(l => l.startTime?.startsWith(dateStr)),
          });
        }
        setSchedule(days);
      })
      .catch(() => setSchedule([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const navigateWeek = (offset: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offset * 7);
    setWeekStart(d);
  };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 5);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Week selector */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigateWeek(-1)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-900">{formatMonth(weekStart)} — {formatMonth(weekEnd)}</h1>
          <p className="text-sm text-slate-500">Расписание на неделю</p>
        </div>
        <button onClick={() => navigateWeek(1)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Card key={i}><Skeleton className="h-20" /></Card>)}
        </div>
      ) : (
        <div className="space-y-6">
          {schedule.map((day) => (
            <div key={day.date}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-bold text-slate-900">{day.dayName}</h2>
                <span className="text-sm text-slate-400">{formatDateShort(day.date)}</span>
                {day.lessons.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{day.lessons.length} пар</span>
                )}
              </div>
              {day.lessons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-400">Нет пар</div>
              ) : (
                <div className="space-y-2">
                  {day.lessons.map((lesson) => (
                    <Link key={lesson.id} href={`/pair-space/${lesson.id}`}>
                      <Card hover padding="sm" className={`mb-2 ${lesson.isChanged ? 'border-amber-300 bg-amber-50/50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 text-center w-14">
                            <p className="text-sm font-bold text-slate-900">{lesson.startTime?.slice(11, 16)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 truncate">{lesson.subject}</span>
                              <Badge variant={typeBadgeVariant[lesson.subjectType] || 'slate'} size="sm">
                                {typeLabels[lesson.subjectType] || lesson.subjectType}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                              {lesson.teacherName && <span>{lesson.teacherName}</span>}
                              {lesson.room && <span>а. {lesson.room}</span>}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
