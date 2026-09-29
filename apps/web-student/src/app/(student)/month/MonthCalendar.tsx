import Link from 'next/link';

import { RequestState, Skeleton } from '@/components/ui';
import { getLessonLocation } from '../schedule-location';

interface Lesson {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  building?: string;
  room?: string;
  subgroup?: string;
  weekType?: 'odd' | 'even' | 'both';
  isChanged?: boolean;
  changeDescription?: string;
}

export interface MonthDayCell {
  date: Date;
  key: string;
  lessons: Lesson[];
  inCurrentMonth: boolean;
}

interface MonthCalendarProps {
  cells: MonthDayCell[];
  currentMonthCells: MonthDayCell[];
  today: string;
  hasFilters: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const time = (value: string) => value.includes('T') ? value.slice(11, 16) : value;
const isCancelled = (lesson: Lesson) => /отмен/i.test(lesson.changeDescription || '');
const hasPairSpace = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function LessonChip({ lesson }: { lesson: Lesson }) {
  const cancelled = isCancelled(lesson);
  const content = <>
    <span className="block truncate font-semibold">{lesson.subject}</span>
    {lesson.subgroup?.trim() && <span className="block truncate text-[9px] opacity-75">Подгруппа {lesson.subgroup}</span>}
    {lesson.weekType && lesson.weekType !== 'both' && <span className="block truncate text-[9px] opacity-75">{lesson.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}</span>}
    <span className="mt-0.5 block font-mono text-[10px] opacity-75">{time(lesson.startTime)}–{time(lesson.endTime)}</span>
    {getLessonLocation(lesson.building, lesson.room) && <span className="mt-0.5 block truncate text-[9px] opacity-75">{getLessonLocation(lesson.building, lesson.room)}</span>}
    {lesson.isChanged && <span className="mt-1 inline-flex rounded px-1 py-0.5 text-[9px] font-bold">{cancelled ? 'Отменено' : 'Изменено'}</span>}
  </>;
  const className = `block rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight ${cancelled ? 'border-rose-200 bg-rose-50 text-rose-800' : lesson.isChanged ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'}`;
  return hasPairSpace(lesson.id)
    ? <Link href={`/pair-space/${lesson.id}`} className={className}>{content}</Link>
    : <div className={className} aria-label={`${lesson.subject}, ${time(lesson.startTime)}. Пространство пары пока недоступно`} title="Занятие из внешнего расписания; пространство пары пока недоступно">{content}</div>;
}

export function MonthCalendar({
  cells,
  currentMonthCells,
  today,
  hasFilters,
  loading,
  error,
  onRetry,
}: MonthCalendarProps) {
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const hasCurrentMonthLessons = currentMonthCells.some(cell => cell.lessons.length > 0);
  const mobileCells = hasFilters
    ? currentMonthCells.filter(cell => cell.lessons.length > 0)
    : currentMonthCells;
  if (loading) {
    return <div aria-busy="true" aria-label="Загрузка месячного расписания" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">{Array.from({ length: 14 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>;
  }

  if (error) return <RequestState title="Не удалось загрузить расписание" description={error} onRetry={onRetry} />;

  return <>
    {!hasCurrentMonthLessons && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{hasFilters ? 'По этим фильтрам занятий не найдено.' : 'В этом месяце занятий нет.'}</p>}
    <section aria-label="Календарь занятий на месяц" className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
      <div role="table" aria-label="Месячное расписание">
        <div className="grid grid-cols-7 bg-slate-50" role="row">{weekDayNames.map(name => <div key={name} role="columnheader" className="border-b border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{name}</div>)}</div>
        <div role="rowgroup">
          {weeks.map((week, weekIndex) => <div key={weekIndex} className="grid grid-cols-7" role="row">
            {week.map(cell => <div key={cell.key} role="cell" aria-label={`${cell.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}, ${cell.lessons.length} пар`} className={`min-h-32 border-b border-r border-slate-100 p-2 ${!cell.inCurrentMonth ? 'bg-slate-50/70 text-slate-400' : ''} ${cell.key === today ? 'bg-indigo-50/60' : ''}`}>
              <div className="mb-2 flex items-center justify-between"><time dateTime={cell.key} aria-current={cell.key === today ? 'date' : undefined} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${cell.key === today ? 'bg-indigo-600 text-white' : ''}`}>{cell.date.getDate()}</time>{cell.lessons.length > 0 && <span className="text-[10px] text-slate-400">{cell.lessons.length}</span>}</div>
              <div className="space-y-1">{cell.lessons.slice(0, 3).map(lesson => <LessonChip key={lesson.id} lesson={lesson} />)}{cell.lessons.length > 3 && <p className="px-1 text-[10px] font-medium text-slate-500">ещё {cell.lessons.length - 3}</p>}</div>
            </div>)}
          </div>)}
        </div>
      </div>
    </section>
    <section aria-label="Расписание по дням месяца" className="space-y-3 lg:hidden">
      {mobileCells.map(cell => <article key={cell.key} className={`rounded-xl border bg-white ${cell.key === today ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200'}`}>
        <div className={`flex items-center justify-between px-4 py-3 ${cell.key === today ? 'bg-indigo-50' : 'bg-slate-50'}`}>
          <h2 className="font-semibold capitalize text-slate-900">{cell.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <span className="text-xs text-slate-500">{cell.lessons.length} пар</span>
        </div>
        <div className="space-y-2 p-3">
          {cell.lessons.map(lesson => <LessonChip key={lesson.id} lesson={lesson} />)}
        </div>
      </article>)}
    </section>
  </>;
}
