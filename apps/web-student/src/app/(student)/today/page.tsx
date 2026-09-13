'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, getUser } from '@/lib/api';
import { Card, Badge, Skeleton, EmptyState } from '@/components/ui';

interface Lesson { id: string; subject: string; subjectType: string; teacherName: string; room: string; startTime: string; endTime: string; isChanged: boolean; changeDescription: string; }
interface Absence { status: string; }
type LessonState = 'past' | 'current' | 'next' | 'normal';

const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };
const time = (value: string) => value.includes('T') ? value.slice(11, 16) : value;

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? date.getTime() : NaN;
}
function minutesLeft(endTime: string, now: number): number {
  return Math.max(0, Math.ceil((timestamp(endTime) - now) / 60000));
}

export default function TodayPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [name, setName] = useState('студент');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const date = new Date();
  const dateKey = date.toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([apiFetch<Lesson[]>(`/schedule?date=${dateKey}`), apiFetch<Absence[]>('/absences/my'), getUser()])
      .then(([todayLessons, myAbsences, user]) => { setLessons(todayLessons); setAbsences(myAbsences); setName(user.firstName || 'студент'); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [dateKey]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const ranges = lessons.map(lesson => ({ lesson, start: timestamp(lesson.startTime), end: timestamp(lesson.endTime) }));
  const current = ranges.find(item => item.start <= now && now < item.end);
  const next = ranges.filter(item => item.start > now).sort((a, b) => a.start - b.start)[0];
  const primary = current || next;
  const stateFor = (lesson: Lesson): LessonState => {
    const item = ranges.find(range => range.lesson.id === lesson.id);
    if (!item || Number.isNaN(item.start) || Number.isNaN(item.end)) return 'normal';
    if (current?.lesson.id === lesson.id) return 'current';
    if (item.end <= now) return 'past';
    if (next?.lesson.id === lesson.id) return 'next';
    return 'normal';
  };
  const changedCount = lessons.filter(lesson => lesson.isChanged).length;
  const attendance = absences.length === 0 ? 100 : Math.round((absences.filter(a => a.status === 'confirmed' || a.status === 'excused').length / absences.length) * 100);
  const dateLabel = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section><p className="ds-meta font-medium text-indigo-600">{dateLabel}</p><h1 className="ds-page-title mt-1 text-slate-900">Добрый день, {name}</h1><p className="ds-body mt-2 text-slate-500">Вот как выглядит твой учебный день.</p></section>
      <section className="grid gap-x-8 gap-y-3 border-y border-slate-200 py-4 sm:grid-cols-3">
        <div><p className="text-2xl font-bold text-slate-900">{loading ? '—' : lessons.length}</p><p className="ds-meta mt-1 text-slate-500">Пар сегодня</p></div>
        <div><p className="text-2xl font-bold text-slate-900">{loading ? '—' : changedCount}</p><p className="ds-meta mt-1 text-slate-500">Изменений</p></div>
        <div><p className="text-2xl font-bold text-slate-900">{loading ? '—' : `${attendance}%`}</p><p className="ds-meta mt-1 text-slate-500">Посещаемость</p></div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="ds-section-title text-slate-900">{current ? 'Сейчас' : 'Ближайшая пара'}</h2><Link href="/week" className="ds-meta font-semibold text-indigo-600 hover:text-indigo-700">Всё расписание</Link></div>
        {loading ? <Card><Skeleton className="h-24" /></Card> : primary ? <Link href={`/pair-space/${primary.lesson.id}`}><Card hover className={current ? 'border-emerald-200 bg-emerald-50/40' : 'border-indigo-200 bg-indigo-50/40'}><div className="flex items-start justify-between gap-4"><div>{current && <Badge variant="success" dot>ИДЁТ СЕЙЧАС</Badge>}<p className={`text-sm font-semibold ${current ? 'mt-3 text-emerald-700' : 'text-indigo-700'}`}>{time(primary.lesson.startTime)} — {time(primary.lesson.endTime)}</p><h3 className="mt-2 text-xl font-bold text-slate-900">{primary.lesson.subject}</h3><p className="mt-1 text-sm text-slate-500">{typeLabels[primary.lesson.subjectType] || primary.lesson.subjectType}{primary.lesson.room ? ` · ауд. ${primary.lesson.room}` : ''}</p>{current && <p className="mt-4 text-sm font-semibold text-emerald-700">Осталось {minutesLeft(current.lesson.endTime, now)} мин.</p>}</div><span className="hidden rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 sm:inline-flex">Открыть</span></div></Card></Link> : <EmptyState title="На сегодня пар нет" description="Можно спокойно заняться своими делами." />}
        {current && next && <div className="mt-6"><div className="mb-2 flex items-center justify-between"><h3 className="ds-meta font-semibold uppercase tracking-wide text-slate-400">Следующая</h3><span className="ds-meta text-slate-400">{time(next.lesson.startTime)}</span></div><Link href={`/pair-space/${next.lesson.id}`} className="group flex items-center justify-between border-b border-slate-200 py-3 hover:border-indigo-300"><div><p className="font-semibold text-slate-900">{next.lesson.subject}</p><p className="ds-meta mt-1 text-slate-500">{typeLabels[next.lesson.subjectType] || next.lesson.subjectType}{next.lesson.room ? ` · ауд. ${next.lesson.room}` : ''}</p></div><span className="text-lg text-indigo-600 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></Link></div>}
      </section>
      {!loading && lessons.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Сегодня</h2><span className="text-sm text-slate-400">{lessons.length} пар</span></div><div className="divide-y divide-slate-200 border-y border-slate-200">{lessons.map(lesson => { const state = stateFor(lesson); const isCurrent = state === 'current'; return <Link key={lesson.id} href={`/pair-space/${lesson.id}`} className={`group grid grid-cols-[72px_1fr_auto] gap-4 px-2 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[88px_1fr_auto] sm:gap-6 ${state === 'past' ? 'opacity-55' : state === 'current' ? 'bg-emerald-50/60' : state === 'next' ? 'bg-indigo-50/45' : ''}`}><div className={`border-r pr-4 ${isCurrent ? 'border-emerald-300' : 'border-slate-200'}`}><p className={`font-mono text-sm font-semibold ${state === 'past' ? 'text-slate-400' : 'text-slate-900'}`}>{time(lesson.startTime)}</p><div className="my-2 h-px bg-slate-200" /><p className="font-mono text-xs text-slate-400">{time(lesson.endTime)}</p></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{isCurrent && <Badge variant="success" dot>ИДЁТ СЕЙЧАС</Badge>}<h3 className={`truncate font-semibold ${state === 'past' ? 'text-slate-500' : 'text-slate-900'}`}>{lesson.subject}</h3>{!isCurrent && <Badge variant="subject">{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge>}</div><p className={`mt-1 text-sm ${state === 'past' ? 'text-slate-400' : 'text-slate-500'}`}>{lesson.teacherName || 'Преподаватель не указан'}{lesson.room ? ` · ${lesson.room}` : ''}</p>{isCurrent && <p className="mt-2 text-xs font-semibold text-emerald-700">Осталось {minutesLeft(lesson.endTime, now)} мин.</p>}{lesson.isChanged && <div className="mt-2"><Badge variant="warning">Изменено{lesson.changeDescription ? ` · ${lesson.changeDescription}` : ''}</Badge></div>}</div><span className="self-center text-lg font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">→</span></Link>; })}</div></section>}
    </div>
  );
}
