'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetchList } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Lesson { id: string; subject: string; subjectType: string; room: string; startTime: string; endTime: string; groupName: string; isChanged: boolean; }
interface DaySchedule { date: string; dayName: string; lessons: Lesson[]; }

const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };
const typeVariants: Record<string, 'sky' | 'green' | 'amber' | 'pink' | 'purple' | 'indigo' | 'teal'> = { lecture: 'sky', practice: 'green', lab: 'amber', exam: 'pink', consultation: 'purple', coursework: 'indigo', test: 'teal' };
const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getWeekStart(date: Date) {
  const start = new Date(date); const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); start.setHours(0, 0, 0, 0); return start;
}

function dateKey(date: Date) { return date.toISOString().split('T')[0]; }
function formatRange(start: Date, end: Date) { return `${start.getDate()} ${start.toLocaleDateString('ru-RU', { month: 'long' })} — ${end.getDate()} ${end.toLocaleDateString('ru-RU', { month: 'long' })}`; }

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadWeek = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 5);
    setLoading(true); setError('');
    apiFetchList<Lesson>(`/schedule/range?startDate=${dateKey(weekStart)}&endDate=${dateKey(end)}`)
      .then(setLessons).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить расписание.')).finally(() => setLoading(false));
  };
  useEffect(() => { loadWeek(); }, [weekStart]);

  const groups = [...new Set(lessons.map((lesson) => lesson.groupName).filter(Boolean))].sort();
  const subjects = [...new Set(lessons.map((lesson) => lesson.subject).filter(Boolean))].sort();
  const filtered = lessons.filter((lesson) => (groupFilter === 'all' || lesson.groupName === groupFilter) && (subjectFilter === 'all' || lesson.subject === subjectFilter) && (typeFilter === 'all' || lesson.subjectType === typeFilter));
  const schedule = useMemo<DaySchedule[]>(() => Array.from({ length: 6 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); const key = dateKey(date); return { date: key, dayName: weekDays[index], lessons: filtered.filter((lesson) => lesson.startTime?.startsWith(key)).sort((a, b) => a.startTime.localeCompare(b.startTime)) }; }), [filtered, weekStart]);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 5);
  const todayKey = dateKey(new Date());

  return <div className="mx-auto max-w-[1400px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><Link href="/today" className="hover:text-sky-600">НаПаре</Link><span>/</span><span className="text-slate-900">Расписание</span></div><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Неделя:</p><div className="mt-1 flex items-center gap-3"><button type="button" onClick={() => { const date = new Date(weekStart); date.setDate(date.getDate() - 7); setWeekStart(date); }} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-sky-300 hover:text-sky-600" aria-label="Предыдущая неделя">‹</button><h1 className="min-w-[205px] text-xl font-bold text-slate-900 sm:text-2xl">{formatRange(weekStart, weekEnd)}</h1><button type="button" onClick={() => { const date = new Date(weekStart); date.setDate(date.getDate() + 7); setWeekStart(date); }} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-sky-300 hover:text-sky-600" aria-label="Следующая неделя">›</button></div></div><Button variant="secondary" onClick={() => setWeekStart(getWeekStart(new Date()))}>Сегодня</Button></div><Card padding="sm"><div className="grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-slate-500">Группа<select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="all">Все группы</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Предмет<select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="all">Все предметы</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Тип занятия<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="all">Все типы</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></Card>{loading ? <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <Card key={index}><Skeleton className="h-48" /></Card>)}</div> : error ? <RequestState title="Не удалось загрузить расписание" description={error} onRetry={loadWeek} /> : <div className="overflow-x-auto pb-2"><div className="grid min-w-[1060px] grid-cols-6 gap-3">{schedule.map((day) => <section key={day.date} className="min-w-0"><div className={`mb-3 rounded-xl border px-3 py-3 ${day.date === todayKey ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white'}`}><p className={`text-sm font-bold ${day.date === todayKey ? 'text-sky-700' : 'text-slate-800'}`}>{day.dayName}</p><p className="mt-1 text-xs text-slate-500">{new Date(`${day.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</p></div><div className="space-y-3">{day.lessons.length ? day.lessons.map((lesson) => <Card key={lesson.id} className={`border-l-4 px-3 py-3 ${lesson.isChanged ? 'border-amber-300 bg-amber-50/40' : 'border-l-sky-400'}`}><div className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-slate-500">{lesson.startTime.slice(11, 16)}–{lesson.endTime.slice(11, 16)}</span>{lesson.isChanged && <Badge size="sm" variant="amber">Изменено</Badge>}</div><h3 className="mt-2 text-sm font-bold leading-5 text-slate-900">{lesson.subject}</h3><p className="mt-1 text-xs font-medium text-sky-700">{lesson.groupName || 'Группа не указана'}</p><p className="mt-1 text-xs text-slate-500">Кабинет {lesson.room || '—'}</p><Badge size="sm" variant={typeVariants[lesson.subjectType] || 'slate'}>{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge><div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3"><Link href={`/pair-space/${lesson.id}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50">Открыть</Link><Link href={`/attendance?lesson=${lesson.id}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">Посещаемость</Link><Link href={`/pair-space/${lesson.id}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">Пространство</Link></div></Card>) : <div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">Нет занятий</div>}</div></section>)}</div></div>}</div>;
}
