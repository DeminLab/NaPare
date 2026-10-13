'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { apiFetchList } from '@/lib/api';
import { Badge, Button, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Lesson { id: string; subject: string; subjectType?: string; room?: string; startTime: string; endTime: string; startDate?: string; date?: string; groupName?: string; groupId?: string; teacherName?: string; subgroup?: string; weekType?: 'odd' | 'even' | 'both'; isChanged?: boolean; changeDescription?: string; status?: string; }
interface DaySchedule { date: string; dayName: string; lessons: Lesson[]; }

const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };
const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getWeekStart(date: Date) { const start = new Date(date); const day = start.getDay(); start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); start.setHours(0, 0, 0, 0); return start; }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function dateFromParam(value: string | null) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date; }
function formatRange(start: Date, end: Date) { return `${start.toLocaleDateString('ru-RU', {day:'numeric',month:'long'})} — ${end.toLocaleDateString('ru-RU', {day:'numeric',month:'long'})}`; }
function time(value?: string) { return value?.includes('T') ? value.slice(11, 16) : value || '—'; }
function minutes(value?: string) { const [hour, minute] = time(value).split(':').map(Number); return Number.isFinite(hour) ? hour * 60 + minute : -1; }
const lessonDay = (lesson:Lesson) => lesson.startDate?.slice(0,10) || lesson.date || (lesson.startTime?.includes('T') ? lesson.startTime.slice(0,10) : '');
function statusOf(lesson: Lesson, now: Date) { const status = (lesson.status || '').toLowerCase(); if (status.includes('cancel')) return { label: 'Отменено', variant: 'red' as const }; if (lesson.isChanged || status.includes('replace')) return { label: 'Замена', variant: 'amber' as const }; const lessonDate = lessonDay(lesson); if (lessonDate && lessonDate < dateKey(now)) return { label: 'Завершено', variant: 'slate' as const }; if (lessonDate && lessonDate > dateKey(now)) return { label: 'Предстоит', variant: 'indigo' as const }; const current = now.getHours() * 60 + now.getMinutes(); if (current >= minutes(lesson.startTime) && current < minutes(lesson.endTime)) return { label: 'Сейчас', variant: 'sky' as const }; if (current < minutes(lesson.startTime)) return { label: 'Предстоит', variant: 'indigo' as const }; return { label: 'Завершено', variant: 'slate' as const }; }

export default function WeekPage() {
  const requestedDate = null;
  const [weekStart, setWeekStart] = useState(() => getWeekStart(dateFromParam(requestedDate) || new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => dateKey(dateFromParam(requestedDate) || new Date()));
  const [view,setView]=useState('week');
  const queryReady=useWorkspaceQuery({date:selectedDate,group:groupFilter,subject:subjectFilter,type:typeFilter,view},query=>{const date=dateFromParam(query.get('date'))||new Date(); setWeekStart(getWeekStart(date)); setSelectedDate(dateKey(date)); setGroupFilter(query.get('group')||'all'); setSubjectFilter(query.get('subject')||'all'); setTypeFilter(query.get('type')||'all'); setView(query.get('view')==='day'?'day':'week');});
  const [now, setNow] = useState(() => new Date());

  const loadWeek = () => { const end = new Date(weekStart); end.setDate(end.getDate() + 6); setLoading(true); setError(''); apiFetchList<Lesson>(`/schedule/range?startDate=${dateKey(weekStart)}&endDate=${dateKey(end)}&limit=100`).then(setLessons).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить расписание.')).finally(() => setLoading(false)); };
  useEffect(() => { if(queryReady) loadWeek(); }, [weekStart,queryReady]);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);

  const groups = [...new Map(lessons.filter(lesson=>lesson.groupName).map(lesson=>[lesson.groupId || lesson.groupName!,{id:lesson.groupId || lesson.groupName!,name:lesson.groupName!}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'ru-RU'));
  const subjects = [...new Set(lessons.map((lesson) => lesson.subject).filter(Boolean))].sort();
  const filtered = lessons.filter((lesson) => (groupFilter === 'all' || lesson.groupId === groupFilter || lesson.groupName === groupFilter) && (subjectFilter === 'all' || lesson.subject === subjectFilter) && (typeFilter === 'all' || lesson.subjectType === typeFilter));
  const schedule = useMemo<DaySchedule[]>(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); const key = dateKey(date); return { date: key, dayName: weekDays[index], lessons: filtered.filter((lesson) => lessonDay(lesson)===key).sort((a, b) => a.startTime.localeCompare(b.startTime)) }; }), [filtered, weekStart]);
  const selectedDay = schedule.find((day) => day.date === selectedDate) || schedule[0];
  const todayKey = dateKey(now);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const currentLesson = lessons.find((lesson) => lessonDay(lesson)===todayKey && statusOf(lesson, now).label === 'Сейчас');

  const shiftWeek = (amount: number) => { const next = new Date(weekStart); next.setDate(next.getDate() + amount * 7); setWeekStart(next); setSelectedDate(dateKey(next)); };
  const goToday = () => { const today = new Date(); setWeekStart(getWeekStart(today)); setSelectedDate(dateKey(today)); };
  const filtersActive = groupFilter !== 'all' || subjectFilter !== 'all' || typeFilter !== 'all';
  const resetFilters = () => { setGroupFilter('all'); setSubjectFilter('all'); setTypeFilter('all'); };
  const lessonCard = (lesson: Lesson) => {
    const state = statusOf(lesson, now);
    return <article key={lesson.id} className="border-t border-[var(--color-border)] py-3 first:border-t-0">
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]"><time>{time(lesson.startTime)}</time><span className="mt-1 block text-xs font-normal text-[var(--color-text-secondary)]">{time(lesson.endTime)}</span></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link href={`/pair-space/${lesson.id}`} className="text-sm font-bold leading-5 text-[var(--color-text)] hover:text-[var(--color-brand)]">{lesson.subject || 'Без названия'}</Link>{state.label !== 'Предстоит' && <Badge size="sm" variant={state.variant}>{state.label}</Badge>}</div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{lesson.groupName || 'Группа не указана'} · {lesson.room ? `ауд. ${lesson.room}` : 'Аудитория не назначена'} · {typeLabels[lesson.subjectType || ''] || lesson.subjectType || 'Занятие'}</p>
          {lesson.teacherName && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{lesson.teacherName}</p>}
          {(lesson.subgroup || (lesson.weekType && lesson.weekType !== 'both')) && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{lesson.subgroup && `Подгруппа ${lesson.subgroup}`}{lesson.weekType && lesson.weekType !== 'both' && ` · ${lesson.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}`}</p>}
          {lesson.changeDescription && <p className="mt-2 text-xs font-medium text-[var(--color-warning)]">{lesson.changeDescription}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><Link href={`/attendance?lesson=${lesson.id}`} className="inline-flex min-h-9 items-center text-xs font-semibold text-[var(--color-brand)]">Посещаемость →</Link><Link href={`/pair-space/${lesson.id}`} className="inline-flex min-h-9 items-center text-xs font-semibold text-[var(--color-text-secondary)]">Материалы и обсуждение →</Link></div>
        </div>
      </div>
    </article>;
  };
  const dayCard = (day: DaySchedule) => <section key={day.date} className={`min-w-0 self-start rounded-xl border bg-[var(--color-surface)] px-4 ${day.date === todayKey ? 'border-[var(--color-brand)]' : 'border-[var(--color-border)]'}`}>
    <div className="flex items-center justify-between gap-3 py-3"><div><h2 className="text-sm font-bold text-[var(--color-text)]">{new Date(`${day.date}T12:00:00`).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</h2>{day.date === todayKey && <p className="mt-1 text-xs font-semibold text-[var(--color-brand)]">Сегодня</p>}</div><span className="shrink-0 text-xs text-[var(--color-text-secondary)]">{day.lessons.length ? `Занятия: ${day.lessons.length}` : 'Свободно'}</span></div>
    {day.lessons.length ? day.lessons.map(lessonCard) : <p className="border-t py-3 text-sm text-[var(--color-text-secondary)]">Занятий нет</p>}
  </section>;

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Расписание</h1><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatRange(weekStart, weekEnd)}{!loading && !error && ` · занятий: ${filtered.length}`}</p></div><div className="flex items-center gap-1"><Button variant="secondary" size="sm" onClick={() => shiftWeek(-1)} aria-label="Предыдущая неделя">←</Button><Button variant="secondary" size="sm" onClick={goToday}>Сегодня</Button><Button variant="secondary" size="sm" onClick={() => shiftWeek(1)} aria-label="Следующая неделя">→</Button></div></header>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3"><div className="flex gap-1" aria-label="Вид расписания">{[{id:'week',label:'Неделя'},{id:'day',label:'День'}].map(item=><button key={item.id} type="button" aria-pressed={view===item.id} onClick={()=>setView(item.id)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${view===item.id?'bg-[var(--color-brand)] text-white':'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'}`}>{item.label}</button>)}</div>{currentLesson && <Badge variant="sky" dot>Сейчас: {currentLesson.subject}</Badge>}{filtersActive && <Button variant="ghost" size="sm" onClick={resetFilters}>Сбросить фильтры</Button>}</div>
    <details className="group"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">Фильтры{filtersActive ? ' · применены' : ''}<span aria-hidden="true" className="text-xs group-open:rotate-180">⌄</span></summary><div className="grid gap-3 rounded-xl border bg-[var(--color-surface)] p-4 sm:grid-cols-3">{[{label:'Группа',value:groupFilter,set:setGroupFilter,options:groups.map(group=>({value:group.id,label:group.name}))},{label:'Предмет',value:subjectFilter,set:setSubjectFilter,options:subjects.map(subject=>({value:subject,label:subject}))},{label:'Тип занятия',value:typeFilter,set:setTypeFilter,options:Object.entries(typeLabels).map(([value,label])=>({value,label}))}].map(filter=><label key={filter.label} className="text-xs font-semibold text-[var(--color-text-secondary)]">{filter.label}<select value={filter.value} onChange={event=>filter.set(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]"><option value="all">Все</option>{filter.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div></details>
    {loading ? <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Загрузка расписания">{[1,2,3,4].map(index=><Skeleton key={index} className="h-44"/>)}</div> : error ? <RequestState title="Не удалось загрузить расписание" description={error} onRetry={loadWeek}/> : !filtered.length ? <EmptyState title={filtersActive ? 'Занятий по этим фильтрам нет' : 'На этой неделе занятий нет'} description={filtersActive ? 'Сбросьте фильтры или выберите другую неделю.' : 'Выберите соседнюю неделю или вернитесь к текущей.'}/> : view === 'week' ? <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{schedule.map(dayCard)}</div> : <>
      <div className="grid grid-cols-7 gap-1" aria-label="Выбор дня">{schedule.map(day=><button key={day.date} type="button" aria-pressed={day.date===selectedDate} onClick={()=>setSelectedDate(day.date)} className={`min-h-16 min-w-0 rounded-lg border px-1 py-2 text-center ${day.date===selectedDate?'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]':'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}><span className="block text-xs">{day.dayName}</span><span className="mt-1 block text-sm font-bold">{Number(day.date.slice(-2))}</span><span className="mt-1 block text-[10px]">{day.lessons.length ? `${day.lessons.length} зан.` : '—'}</span></button>)}</div>
      {selectedDay && dayCard(selectedDay)}
    </>}
  </div>;
}
