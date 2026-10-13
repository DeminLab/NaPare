'use client';

import Link from 'next/link';
import { useWorkspaceQuery, parseCalendarDate } from '@napare/ui/workspace-shell';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api';
import { MonthCalendar, type MonthDayCell } from './MonthCalendar';
import { getLessonLocation } from '../schedule-location';

interface Lesson {
  id: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  subject: string;
  subjectType?: string;
  teacherName?: string;
  room?: string;
  building?: string;
  subgroup?: string;
  weekType?: 'odd' | 'even' | 'both';
  startTime: string;
  endTime: string;
  isChanged?: boolean;
  changeDescription?: string;
}

const typeLabels: Record<string, string> = {
  lecture: 'Лекции',
  practice: 'Практика',
  lab: 'Лабораторные',
  exam: 'Экзамены',
  consultation: 'Консультации',
  coursework: 'Курсовые',
  test: 'Зачёты',
};

const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const lessonDate = (lesson: Lesson) => lesson.date || lesson.startDate?.slice(0, 10) || '';
const isCancelled = (lesson: Lesson) => /отмен/i.test(lesson.changeDescription || '');
const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const lessonDateTime = (date: string, time: string) => time.includes('T') ? time : `${date}T${time.length === 5 ? `${time}:00` : time}`;

function downloadCalendar(lessons: Lesson[], monthKey: string) {
  const events = lessons.filter(lesson => !isCancelled(lesson)).map(lesson => {
    const date = lessonDate(lesson);
    const details = [lesson.teacherName, lesson.changeDescription].filter(Boolean).join(' · ');
    return [
      'BEGIN:VEVENT',
      `UID:lesson-${escapeIcs(lesson.id)}@napare.sano.ru`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(lessonDateTime(date, lesson.startTime))}`,
      `DTEND:${icsDate(lessonDateTime(lesson.endDate?.slice(0, 10) || date, lesson.endTime))}`,
      `SUMMARY:${escapeIcs(lesson.subject)}`,
      ...((lesson.building || lesson.room) ? [`LOCATION:${escapeIcs(getLessonLocation(lesson.building, lesson.room) || '')}`] : []),
      ...(details ? [`DESCRIPTION:${escapeIcs(details)}`] : []),
      'END:VEVENT',
    ].join('\r\n');
  });
  const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NaPare//Schedule//RU', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `napare-${monthKey}.ics`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function monthGridStart(month: Date): Date {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function monthGridEnd(month: Date): Date {
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const daysUntilSunday = (7 - end.getDay()) % 7;
  end.setDate(end.getDate() + daysUntilSunday);
  return end;
}

function getMonthDays(month: Date, lessons: Lesson[]): MonthDayCell[] {
  const start = monthGridStart(month);
  const end = monthGridEnd(month);
  const cells: MonthDayCell[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const current = new Date(date);
    const key = dateKey(current);
    cells.push({
      date: current,
      key,
      inCurrentMonth: current.getMonth() === month.getMonth(),
      lessons: lessons.filter(lesson => lessonDate(lesson) === key).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    });
  }
  return cells;
}

function getCacheKey(monthKey: string): string | null {
  try {
    const token = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!token) return null;
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `napare:student-month:${claims.universityId}:${claims.sub}:${monthKey}`;
  } catch {
    return null;
  }
}

async function fetchMonthSchedule(start: Date, end: Date): Promise<Lesson[]> {
  const startDate = dateKey(start);
  const endDate = dateKey(end);
  const lessons: Lesson[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ startDate, endDate, page: String(page), limit: '100' });
    const result = await apiFetch<PaginatedResponse<Lesson>>(`/schedule/range?${query}`);
    lessons.push(...result.data);
    totalPages = result.meta.totalPages;
    page += 1;
  } while (page <= totalPages);
  return lessons;
}

export default function MonthSchedulePage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const today = dateKey(new Date());
  const queryReady = useWorkspaceQuery({ date: selectedDate, filter, q: search }, query => {
    const date = parseCalendarDate(query.get("date")) || new Date();
    setSelectedDate(dateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    const type = query.get("filter") || "all";
    setFilter(type === "all" || type in typeLabels ? type : "all");
    setSearch((query.get("q") || "").slice(0, 80));
  });

  useEffect(() => {
    if (!queryReady) return;
    const key = getCacheKey(monthKey);
    let cached: { savedAt: string; lessons: Lesson[] } | null = null;
    if (key) {
      try {
        const value = window.localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value) as { savedAt?: unknown; lessons?: unknown };
          if (typeof parsed.savedAt === 'string' && Array.isArray(parsed.lessons) && parsed.lessons.every(isLesson)) {
            cached = { savedAt: parsed.savedAt, lessons: parsed.lessons };
          }
        }
      } catch {
        cached = null;
      }
    }

    let active = true;
    if (cached) {
      setLessons(cached.lessons);
      setOfflineSavedAt(cached.savedAt);
    } else {
      setLessons([]);
      setOfflineSavedAt(null);
    }
    setCacheRefreshing(Boolean(cached));
    setLoading(!cached);
    setError('');
    const requestedMonth = new Date(`${monthKey}-01T12:00:00`);
    void fetchMonthSchedule(monthGridStart(requestedMonth), monthGridEnd(requestedMonth))
      .then(result => {
        if (!active) return;
        setLessons(result);
        setOfflineSavedAt(null);
        setCacheRefreshing(false);
        if (key) {
          try {
            window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), lessons: result }));
          } catch {
            // Network-backed schedule works when browser storage is unavailable.
          }
        }
      })
      .catch(reason => {
        if (!active) return;
        if (cached) {
          setLessons(cached.lessons);
          setOfflineSavedAt(cached.savedAt);
          setCacheRefreshing(false);
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить расписание.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryReady, monthKey, retryCount]);

  const visibleLessons = useMemo(() => lessons.filter(lesson =>
    (filter === 'all' || lesson.subjectType === filter)
    && (!search || `${lesson.subject} ${lesson.teacherName || ''} ${lesson.building || ''} ${lesson.room || ''}`.toLowerCase().includes(search.trim().toLowerCase())),
  ), [lessons, filter, search]);
  const cells = useMemo(() => getMonthDays(month, visibleLessons), [month, visibleLessons]);
  const currentMonthCells = cells.filter(cell => cell.inCurrentMonth);
  const currentMonthLessons = currentMonthCells.flatMap(cell => cell.lessons);
  const monthLessons = lessons.filter(lesson => lessonDate(lesson).startsWith(monthKey));
  const changedCount = currentMonthLessons.filter(lesson => lesson.isChanged).length;
  const hasFilters = Boolean(search.trim()) || filter !== 'all';

  const selectMonth = (date: Date) => { setMonth(date); setSelectedDate(dateKey(date)); };
  const changeMonth = (amount: number) => selectMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1, 12));
  const chooseMonth = (value: string) => {
    const [year, monthNumber] = value.split('-').map(Number);
    if (year && monthNumber >= 1 && monthNumber <= 12) selectMonth(new Date(year, monthNumber - 1, 1, 12));
  };

  return <div className="mx-auto max-w-[1400px] space-y-6">
    <header className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-400">НаПаре / Расписание</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Расписание на месяц</h1>
        <p className="mt-2 text-sm text-slate-500">Пары, изменения и типы занятий в календаре месяца.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={"/week?" + new URLSearchParams({ date: selectedDate, filter, q: search }).toString()} className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Неделя</Link>
        <button type="button" onClick={() => downloadCalendar(monthLessons, monthKey)} disabled={loading || !monthLessons.some(lesson => !isCancelled(lesson))} className="h-11 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50">Скачать месяц (.ics)</button>
        <button type="button" onClick={() => selectMonth(new Date())} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Этот месяц</button>
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Предыдущий месяц" className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-lg text-slate-600 hover:bg-slate-50">‹</button>
        <label className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600">
          <span className="sr-only">Выбрать месяц</span>
          <input type="month" value={monthKey} onChange={event => chooseMonth(event.target.value)} className="bg-transparent text-sm outline-none" aria-label="Выбрать месяц" />
        </label>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Следующий месяц" className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-lg text-slate-600 hover:bg-slate-50">›</button>
      </div>
      {offlineSavedAt && <p role="status" className="text-xs font-medium text-amber-700">{cacheRefreshing ? 'Сохраненная копия · проверяем актуальность' : 'Офлайн · сохранено'} {new Date(offlineSavedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</p>}
    </header>

    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4" aria-label="Фильтры расписания">
      <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <span className="font-semibold capitalize text-slate-900">{firstDay.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
        <span className="text-slate-400">·</span><span className="text-slate-600">{currentMonthLessons.length} пар</span>
        {changedCount > 0 && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{changedCount} изменено</span>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1 sm:max-w-xs">
          <span className="sr-only">Поиск по предмету, преподавателю или аудитории</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Предмет, преподаватель, аудитория" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
        </label>
        <label>
          <span className="sr-only">Фильтр по типу занятия</span>
          <select value={filter} onChange={event => setFilter(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 sm:w-auto" aria-label="Фильтр по типу занятия">
            <option value="all">Все типы</option>
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
    </section>

    <MonthCalendar
      cells={cells}
      currentMonthCells={currentMonthCells}
      today={today}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      hasFilters={hasFilters}
      loading={loading}
      error={error}
      onRetry={() => setRetryCount(count => count + 1)}
    />
  </div>;
}

function isLesson(value: unknown): value is Lesson {
  if (!value || typeof value !== 'object') return false;
  const lesson = value as Partial<Lesson>;
  return typeof lesson.id === 'string'
    && typeof lesson.subject === 'string'
    && typeof lesson.startTime === 'string'
    && typeof lesson.endTime === 'string';
}
