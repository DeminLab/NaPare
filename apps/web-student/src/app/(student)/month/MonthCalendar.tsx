'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { LessonTypeBadge, lessonTypeDotClass, lessonTypeLabel } from '@napare/ui';
import { RequestState, Skeleton } from '@/components/ui';
import { getLessonLocation } from '../schedule-location';

interface Lesson {
  id: string;
  subject: string;
  subjectType?: string;
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
  selectedDate: string;
  onSelectDate: (key: string) => void;
  hasFilters: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const time = (value: string) => value.includes('T') ? value.slice(11, 16) : value;
const isCancelled = (lesson: Lesson) => /отмен/i.test(lesson.changeDescription || '');
const hasPairSpace = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function lessonCountLabel(count: number) {
  const lastTwo = count % 100;
  const ending = lastTwo >= 11 && lastTwo <= 14 ? 'занятий' : count % 10 === 1 ? 'занятие' : count % 10 >= 2 && count % 10 <= 4 ? 'занятия' : 'занятий';
  return `${count} ${ending}`;
}

function LessonChip({ lesson }: { lesson: Lesson }) {
  const cancelled = isCancelled(lesson);
  const content = <>
    <span className="block break-words font-semibold">{lesson.subject}</span>
    <span className="mt-1 block text-sm tabular-nums">{time(lesson.startTime)}–{time(lesson.endTime)}</span>
    {getLessonLocation(lesson.building, lesson.room) && <span className="mt-1 block break-words text-sm">{getLessonLocation(lesson.building, lesson.room)}</span>}
    {lesson.subgroup?.trim() && <span className="mt-1 block text-xs">Подгруппа {lesson.subgroup}</span>}
    {lesson.subjectType && <span className="mt-2 block"><LessonTypeBadge subjectType={lesson.subjectType} /></span>}
    {lesson.weekType && lesson.weekType !== 'both' && <span className="block text-xs">{lesson.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}</span>}
    {lesson.isChanged && <span className="mt-2 inline-flex rounded px-1 py-0.5 text-xs font-bold">{cancelled ? 'Отменено' : 'Изменено'}</span>}
    {lesson.changeDescription && <p className="mt-1 break-words text-sm">{lesson.changeDescription}</p>}
  </>;
  const className = `block rounded-xl border p-3 text-left text-sm leading-6 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${cancelled ? 'border-rose-200 bg-rose-50 text-rose-800' : lesson.isChanged ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'}`;
  return hasPairSpace(lesson.id)
    ? <Link href={`/pair-space/${lesson.id}`} className={className}>{content}</Link>
    : <div className={className} aria-label={`${lesson.subject}, ${time(lesson.startTime)}. Пространство пары пока недоступно`} title="Занятие из внешнего расписания; пространство пары пока недоступно">{content}</div>;
}

export function MonthCalendar({
  cells,
  currentMonthCells,
  today,
  selectedDate,
  onSelectDate,
  hasFilters,
  loading,
  error,
  onRetry,
}: MonthCalendarProps) {
  const dateButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedCell = currentMonthCells.find(cell => cell.key === selectedDate)
    || currentMonthCells.find(cell => cell.key === today)
    || currentMonthCells.find(cell => cell.lessons.length > 0)
    || currentMonthCells[0];
  const chooseDay = onSelectDate;
  const moveFocus = (nextIndex: number) => {
    const target = currentMonthCells[nextIndex];
    if (!target) return;
    chooseDay(target.key);
    requestAnimationFrame(() => dateButtons.current.get(target.key)?.focus());
  };
  if (loading) {
    return <div aria-busy="true" aria-label="Загрузка месячного расписания" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">{Array.from({ length: 14 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>;
  }

  if (error) return <RequestState title="Не удалось загрузить расписание" description={error} onRetry={onRetry} />;

  return <>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Выбор дня месяца" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{weekDayNames.map(name => <span key={name} className="py-3 text-center text-xs font-semibold text-slate-600">{name}</span>)}</div>
        <div className="grid grid-cols-7">{cells.map(cell => {
          const monthIndex = currentMonthCells.findIndex(day => day.key === cell.key);
          return <button
          key={cell.key}
          ref={element => {
            if (element) dateButtons.current.set(cell.key, element);
            else dateButtons.current.delete(cell.key);
          }}
          type="button"
          disabled={!cell.inCurrentMonth}
          tabIndex={selectedCell?.key === cell.key ? 0 : -1}
          onClick={() => chooseDay(cell.key)}
          onKeyDown={event => {
            const offsets: Record<string, number> = {
              ArrowLeft: -1,
              ArrowRight: 1,
              ArrowUp: -7,
              ArrowDown: 7,
              Home: -((cell.date.getDay() + 6) % 7),
              End: 6 - ((cell.date.getDay() + 6) % 7),
            };
            const offset = offsets[event.key];
            if (offset === undefined || monthIndex < 0) return;
            event.preventDefault();
            moveFocus(Math.max(0, Math.min(currentMonthCells.length - 1, monthIndex + offset)));
          }}
          aria-pressed={selectedCell?.key === cell.key}
          aria-label={`${cell.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}, ${lessonCountLabel(cell.lessons.length)}${cell.lessons.length ? `: ${[...new Set(cell.lessons.map(lesson => lesson.subjectType).filter(Boolean))].map(lessonTypeLabel).join(', ')}` : ''}${cell.key === today ? ', сегодня' : ''}`}
          className={`min-h-[64px] min-w-0 border-b border-r border-slate-100 p-1 text-left focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)] sm:min-h-28 sm:p-3 ${selectedCell?.key === cell.key ? 'bg-[var(--color-brand-soft)] ring-2 ring-inset ring-[var(--color-brand)]' : 'hover:bg-slate-50'} ${!cell.inCurrentMonth ? 'bg-slate-50 text-slate-400' : 'text-slate-800'}`}>
          <time dateTime={cell.key} aria-current={cell.key === today ? 'date' : undefined} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${cell.key === today ? 'bg-[var(--color-brand)] text-[var(--color-on-brand)]' : ''}`}>{cell.date.getDate()}</time>
          {cell.lessons.length > 0 && <><span className="mt-1 block text-center text-xs font-semibold text-[var(--color-brand)] sm:text-left"><span className="sm:hidden">{cell.lessons.length}</span><span className="hidden sm:inline">{lessonCountLabel(cell.lessons.length)}</span></span><span className="mt-2 flex flex-wrap gap-1" aria-hidden="true">{cell.lessons.slice(0,5).map(lesson=><span key={lesson.id} className={`h-1.5 w-1.5 rounded-full ${lesson.isChanged?'bg-amber-500':lessonTypeDotClass(lesson.subjectType)}`}/>)}</span></>}
        </button>;
        })}</div>
      </section>
      {selectedCell && <section aria-label="Занятия выбранного дня" className="rounded-2xl border border-slate-200 bg-white p-4 xl:sticky xl:top-24">
        <div aria-live="polite" aria-atomic="true">
          <h2 className="text-base font-semibold capitalize text-slate-900">{selectedCell.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p className="mt-1 text-sm text-slate-500">{lessonCountLabel(selectedCell.lessons.length)}{selectedCell.key === today ? ' · Сегодня' : ''}</p>
        </div>
        <div className="mt-4 space-y-3">{selectedCell.lessons.length ? selectedCell.lessons.map(lesson => <LessonChip key={lesson.id} lesson={lesson} />) : <p className="py-2 text-sm text-slate-600">{hasFilters ? 'Нет совпадений.' : 'Занятий нет.'}</p>}</div>
      </section>}
    </div>
  </>;
}
