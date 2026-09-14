'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetchList } from '@/lib/api';
import { Card, Badge, RequestState, Skeleton } from '@/components/ui';

interface Lesson { id: string; subject: string; subjectType: string; teacherName: string; room: string; startTime: string; endTime: string; pairNumber: number; isChanged: boolean; groupName: string; }
interface DaySchedule { date: string; dayName: string; lessons: Lesson[]; }

const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };
const time = (value: string) => value?.includes('T') ? value.slice(11, 16) : value || '—';

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
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekDates(new Date()).start);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [error, setError] = useState('');

  useEffect(() => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 5);
    const startDate = weekStart.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];
    setLoading(true); setError('');
    apiFetchList<Lesson>(`/schedule/range?startDate=${startDate}&endDate=${endDate}`)
      .then(lessons => {
        const days: DaySchedule[] = [];
        for (let i = 0; i < 6; i++) {
          const d = new Date(weekStart); d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
          days.push({ date: dateStr, dayName: dayNames[d.getDay()], lessons: lessons.filter(l => l.startTime?.startsWith(dateStr)) });
        }
        setSchedule(days);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Не удалось загрузить расписание.'))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 5);
  const timeSlots = useMemo(() => Array.from(new Set(schedule.flatMap(day => day.lessons.map(lesson => time(lesson.startTime))))).sort(), [schedule]);

  const lessonCard = (lesson: Lesson, compact = false) => (
    <Link key={lesson.id} href={`/pair-space/${lesson.id}`}>
      <Card hover padding="sm" className={`h-full ${lesson.isChanged ? 'border-amber-300 bg-amber-50/50' : ''}`}>
        <div className={compact ? 'space-y-1' : 'flex items-center gap-3'}>
          <p className={`font-semibold text-slate-900 ${compact ? 'text-xs' : 'w-14 shrink-0 text-sm'}`}>{time(lesson.startTime)}</p>
          <div className="min-w-0 flex-1">
            <div className={`flex ${compact ? 'flex-col gap-1' : 'items-center gap-2'}`}>
              <span className={`truncate font-medium text-slate-900 ${compact ? 'text-xs' : ''}`}>{lesson.subject}</span>
              <Badge variant="subject" size="sm">{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge>
            </div>
            {!compact && <div className="mt-0.5 flex gap-3 text-xs text-slate-500">{lesson.teacherName && <span>{lesson.teacherName}</span>}{lesson.room && <span>а. {lesson.room}</span>}</div>}
          </div>
        </div>
      </Card>
    </Link>
  );

  const lessonRow = (lesson: Lesson) => (
    <Link key={lesson.id} href={`/pair-space/${lesson.id}`} className="group grid grid-cols-[64px_1fr_auto] items-center gap-4 border-b border-slate-200 px-2 py-3.5 last:border-0 hover:bg-slate-50 sm:grid-cols-[76px_1fr_auto] sm:gap-6">
      <span className="font-mono text-sm font-semibold text-slate-600">{time(lesson.startTime)}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{lesson.subject}</span>
          <Badge variant="subject" size="sm">{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{lesson.teacherName || 'Преподаватель не указан'}{lesson.room ? ` · ${lesson.room}` : ''}</p>
      </div>
      <span className="text-lg font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">→</span>
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Предыдущая неделя">←</button>
        <div className="text-center"><h1 className="ds-section-title text-slate-900">{formatMonth(weekStart)} — {formatMonth(weekEnd)}</h1><p className="ds-meta mt-1 text-slate-500">Расписание на неделю</p></div>
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Следующая неделя">→</button>
      </div>

      <div className="flex justify-end"><div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Вид расписания">
        <button onClick={() => setView('list')} className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Список</button>
        <button onClick={() => setView('grid')} className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${view === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Расписание</button>
      </div></div>

      {loading ? <div className="space-y-4">{[1, 2, 3].map(i => <Card key={i}><Skeleton className="h-20" /></Card>)}</div> : error ? <RequestState title="Не удалось загрузить расписание" description={error} onRetry={() => setWeekStart(new Date(weekStart))} /> : view === 'list' ? (
        <div className="space-y-8">{schedule.map(day => <section key={day.date}><div className="mb-1 flex items-baseline gap-3 border-b border-slate-300 pb-3"><h2 className="text-sm font-bold text-slate-900">{day.dayName}</h2><span className="text-sm text-slate-400">{formatDateShort(day.date)}</span>{day.lessons.length > 0 && <span className="text-xs text-slate-400">{day.lessons.length} пар</span>}</div>{day.lessons.length === 0 ? <div className="border-b border-dashed border-slate-200 px-2 py-5 text-sm text-slate-400">Нет пар</div> : <div>{day.lessons.map(lesson => lessonRow(lesson))}</div>}</section>)}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="min-w-[920px]"><div className="grid grid-cols-[72px_repeat(6,minmax(0,1fr))] border-b border-slate-200 bg-slate-50"><div className="p-3" />{schedule.map(day => <div key={day.date} className="border-l border-slate-200 p-3 text-center"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">{day.dayName.slice(0, 2)}</p><p className="mt-1 text-xs text-slate-400">{new Date(day.date).getDate()}</p></div>)}</div>{timeSlots.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">На этой неделе пар нет</div> : timeSlots.map(slot => <div key={slot} className="grid grid-cols-[72px_repeat(6,minmax(0,1fr))] border-b border-slate-100 last:border-0"><div className="p-3 text-right text-xs font-semibold text-slate-400">{slot}</div>{schedule.map(day => <div key={day.date} className="min-h-24 border-l border-slate-100 p-2">{day.lessons.filter(lesson => time(lesson.startTime) === slot).map(lesson => lessonCard(lesson, true))}</div>)}</div>)}</div></div>
      )}
    </div>
  );
}
