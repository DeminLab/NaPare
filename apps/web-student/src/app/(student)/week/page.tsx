'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceQuery, parseCalendarDate } from '@napare/ui/workspace-shell';
import { apiFetchList } from '@/lib/api';
import { flushStudentFavoriteQueue, getStudentFavorites, syncStudentFavorite } from '../favorite-api';
import { RequestState, Skeleton } from '@/components/ui';
import { EmptyState, LessonTypeBadge, lessonTypeKey } from '@napare/ui';
import { getLessonLocation } from '../schedule-location';

interface Lesson { id: string; date?: string; startDate?: string; endDate?: string; subject: string; subjectType?: string; teacherName?: string; room?: string; building?: string; subgroup?: string; weekType?: 'odd' | 'even' | 'both'; startTime: string; endTime: string; pairNumber?: number; isChanged: boolean; changeDescription?: string; }
interface DaySchedule { date: string; dayName: string; lessons: Lesson[]; }
const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };
const hasPairSpace = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function isLesson(value: unknown): value is Lesson {
  if (!value || typeof value !== 'object') return false;
  const lesson = value as Partial<Lesson>;
  return typeof lesson.id === 'string' && typeof lesson.subject === 'string' && typeof lesson.startTime === 'string' && typeof lesson.endTime === 'string';
}
const time = (value?: string) => value?.includes('T') ? value.slice(11, 16) : value || '—';
const dateIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const weekStart = (base: Date) => { const date = new Date(base); const day = date.getDay(); date.setDate(date.getDate() - day + (day === 0 ? -6 : 1)); return date; };
const rangeLabel = (start: Date, end: Date) => `${start.toLocaleDateString('ru-RU', { day: 'numeric' })}–${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
const isCancelled = (lesson: Lesson) => lesson.changeDescription?.toLowerCase().includes('отмен') || false;
const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const lessonDate = (lesson: Lesson) => lesson.date || lesson.startDate?.slice(0, 10) || lesson.startTime.slice(0, 10);
const lessonDateTime = (date: string | undefined, timeValue: string) => timeValue.includes('T') ? timeValue : `${date || new Date().toISOString().slice(0, 10)}T${timeValue.length === 5 ? `${timeValue}:00` : timeValue}`;
const weekCachePrefix = 'napare:student-week:';

function googleCalendarUrl(lesson: Lesson, timeZone: string): string | null {
  const date = lessonDate(lesson);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeZone) return null;

  const toCalendarDateTime = (dateValue: string, timeValue: string) => {
    const localDate = timeValue.includes('T') ? timeValue.slice(0, 10) : dateValue;
    const localTime = timeValue.includes('T') ? timeValue.slice(11, 19) : timeValue;
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localTime);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !match) return null;
    return `${localDate.replace(/-/g, '')}T${match[1]}${match[2]}${match[3] || '00'}`;
  };

  const start = toCalendarDateTime(date, lesson.startTime);
  const end = toCalendarDateTime(date, lesson.endTime);
  if (!start || !end) return null;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: lesson.subject,
    dates: `${start}/${end}`,
    stz: timeZone,
    etz: timeZone,
  });
  const location = getLessonLocation(lesson.building, lesson.room);
  const details = [lesson.teacherName, lesson.changeDescription].filter(Boolean).join('\n');
  if (location) params.set('location', location);
  if (details) params.set('details', details);
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

function openGoogleCalendar(lesson: Lesson) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const url = googleCalendarUrl(lesson, timeZone);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function cacheKeyForWeek(week: string): string | null {
  try {
    const payload = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `${weekCachePrefix}${claims.universityId}:${claims.sub}:${week}`;
  } catch {
    return null;
  }
}

function favoriteTeachersStorageKey(): string | null {
  try {
    const payload = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `napare:student-favorite-teachers:${encodeURIComponent(claims.universityId)}:${encodeURIComponent(claims.sub)}`;
  } catch {
    return null;
  }
}

function groupLessonsByWeek(lessons: Lesson[], start: Date): DaySchedule[] {
  const names = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    const iso = dateIso(day);
    return {
      date: iso,
      dayName: names[day.getDay()],
      lessons: lessons.filter(lesson => lessonDate(lesson) === iso).sort((a, b) => time(a.startTime).localeCompare(time(b.startTime))),
    };
  });
}

function downloadCalendar(schedule: DaySchedule[]) {
  const events = schedule.flatMap(day => day.lessons).filter(lesson => !isCancelled(lesson)).map(lesson => {
    const details = [lesson.teacherName, lesson.changeDescription].filter(Boolean).join(' · ');
    return [
      'BEGIN:VEVENT',
      `UID:lesson-${escapeIcs(lesson.id)}@napare.sano.ru`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(lessonDateTime(lessonDate(lesson), lesson.startTime))}`,
      `DTEND:${icsDate(lessonDateTime(lesson.endDate?.slice(0, 10) || lessonDate(lesson), lesson.endTime))}`,
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
  link.download = `napare-${schedule[0]?.date || dateIso(new Date())}.ics`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareWeekSchedule(schedule: DaySchedule[], weekLabel: string, weekDate: string): Promise<'max' | 'system' | 'clipboard'> {
  const lines = schedule.flatMap(day => day.lessons.length ? [
    `${day.dayName}, ${new Date(`${day.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`,
    ...day.lessons.map(lesson => {
      const location = getLessonLocation(lesson.building, lesson.room);
      return `${time(lesson.startTime)}–${time(lesson.endTime)} · ${lesson.subject}${location ? ` · ${location}` : ''}${isCancelled(lesson) ? ' · отменено' : ''}`;
    }),
  ] : []);
  const text = `Расписание NaPare · ${weekLabel}\n${lines.join('\n')}`;
  const link = `${window.location.origin}/student/week?date=${weekDate}`;
  const maxBridge = (window as Window & {
    WebApp?: { shareMaxContent?: (params: { text?: string; link?: string }) => void };
  }).WebApp;

  if (maxBridge?.shareMaxContent) {
    maxBridge.shareMaxContent({ text, link });
    return 'max';
  }
  if (navigator.share) {
    await navigator.share({ title: `Расписание NaPare · ${weekLabel}`, text, url: link });
    return 'system';
  }
  await navigator.clipboard.writeText(`${text}\n${link}`);
  return 'clipboard';
}

function LessonCard({ lesson, compact = false, favorite = false, onToggleFavorite }: { lesson: Lesson; compact?: boolean; favorite?: boolean; onToggleFavorite?: (teacher: string) => void }) {
  const cancelled = isCancelled(lesson);
  const teacher = lesson.teacherName?.trim();
  const hasPairSpaceDetails = hasPairSpace(lesson.id);
  const lessonContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-slate-700">{time(lesson.startTime)}–{time(lesson.endTime)}</span>
        {hasPairSpaceDetails && <span className="text-slate-300 transition group-hover:text-indigo-500">↗</span>}
      </div>
      <p className="mt-2 break-words text-base font-semibold leading-6 text-slate-900">{lesson.subject}</p>
      <div className="mt-2 space-y-1 text-sm leading-5 text-slate-600">
        <p className="break-words">{teacher || 'Преподаватель не указан'}</p>
        <p className="break-words">{getLessonLocation(lesson.building, lesson.room) || 'Место не указано'}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {lesson.subjectType && <LessonTypeBadge subjectType={lesson.subjectType} />}
        {lesson.subgroup?.trim() && <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">Подгруппа {lesson.subgroup}</span>}
        {lesson.weekType && lesson.weekType !== 'both' && <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{lesson.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}</span>}
        {lesson.isChanged && <span className={`rounded-md px-2 py-1 text-xs font-semibold ${cancelled ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{cancelled ? 'Отменено' : 'Изменено'}</span>}
      </div>
    </>
  );
  const lessonContentClass = `group block ${compact ? 'p-2.5' : 'p-4'}`;
  const cardClass = `overflow-hidden rounded-xl border bg-white ${hasPairSpaceDetails ? 'transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md' : ''} ${cancelled ? 'border-rose-200 opacity-70' : lesson.isChanged ? 'border-amber-200' : 'border-slate-200'}`;
  return (
    <div className={cardClass}>
      {hasPairSpaceDetails ? (
        <Link href={`/pair-space/${lesson.id}`} className={lessonContentClass}>{lessonContent}</Link>
      ) : (
        <div title="Занятие из внешнего расписания; пространство пары пока недоступно" className={`${lessonContentClass} cursor-default`}>
          {lessonContent}
        </div>
      )}
      {!cancelled && (
        <button
          type="button"
          onClick={() => openGoogleCalendar(lesson)}
          aria-label={`Добавить ${lesson.subject} в Google Calendar`}
          className={`flex min-h-11 w-full items-center border-t border-slate-100 px-3 text-left text-sm font-medium text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${compact ? 'py-1' : 'py-2'}`}
        >
          Добавить в Google Calendar ↗
        </button>
      )}
      {teacher && onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(teacher)}
          aria-pressed={favorite}
          className={`flex min-h-11 w-full items-center gap-1.5 border-t border-slate-100 px-3 text-left text-sm font-medium ${compact ? 'py-1' : 'py-2'} ${favorite ? 'text-amber-700' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-700'}`}
        >
          <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
          {favorite ? 'Преподаватель в избранном' : 'Добавить преподавателя в избранное'}
        </button>
      )}
    </div>
  );
}

export default function WeekPage() {
  const [start, setStart] = useState(() => weekStart(new Date())); const [selectedDate, setSelectedDate] = useState(() => dateIso(new Date())); const [schedule, setSchedule] = useState<DaySchedule[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null); const [cacheRefreshing, setCacheRefreshing] = useState(false); const [view, setView] = useState<'week' | 'agenda' | 'day' | 'table'>('week'); const [filter, setFilter] = useState('all'); const [search, setSearch] = useState('');
  const [favoriteTeachers, setFavoriteTeachers] = useState<string[]>([]); const favoriteTeachersRef = useRef(favoriteTeachers); const [favoritesReady, setFavoritesReady] = useState(false); const [favoriteOnly, setFavoriteOnly] = useState(false); const [shareStatus, setShareStatus] = useState(''); const favoritesKey = useMemo(favoriteTeachersStorageKey, []);
  const end = new Date(start); end.setDate(end.getDate() + 6); const today = dateIso(new Date());
  useEffect(() => { favoriteTeachersRef.current = favoriteTeachers; }, [favoriteTeachers]);
  useEffect(() => {
    let localNames: string[] = [];
    if (favoritesKey) {
      try {
        const value: unknown = JSON.parse(window.localStorage.getItem(favoritesKey) || '[]');
        if (Array.isArray(value)) localNames = [...new Set(value.filter((name): name is string => typeof name === 'string' && Boolean(name.trim())).map(name => name.trim()))];
      } catch {
        localNames = [];
      }
    }
    setFavoriteTeachers(localNames);
    setFavoritesReady(true);
    let active = true;
    void (async () => {
      if (favoritesKey) await flushStudentFavoriteQueue(favoritesKey);
      const remote = await getStudentFavorites();
      if (!active) return;
      const remoteTeachers = remote.filter(item => item.kind === 'teacher');
      const remoteIds = new Set(remoteTeachers.map(item => item.externalId));
      const currentNames = favoriteTeachersRef.current;
      const merged = [...new Map([...remoteTeachers.map(item => [item.externalId, item.label] as const), ...currentNames.map(name => [name.toLocaleLowerCase('ru-RU'), name] as const)]).values()];
      setFavoriteTeachers(merged);
      if (favoritesKey) await Promise.all(currentNames.filter(name => !remoteIds.has(name.toLocaleLowerCase('ru-RU'))).map(name => syncStudentFavorite(favoritesKey, { kind: 'teacher', externalId: name, label: name }, true).catch(() => undefined)));
    })().catch(() => {
      // The account-scoped local copy stays available offline.
    });
    return () => { active = false; };
  }, [favoritesKey]);
  useEffect(() => {
    if (!favoritesReady || !favoritesKey) return;
    try { window.localStorage.setItem(favoritesKey, JSON.stringify(favoriteTeachers)); } catch { /* Favorites remain available for this page session. */ }
  }, [favoriteTeachers, favoritesKey, favoritesReady]);

  const dateQueryReady = useWorkspaceQuery({ date: selectedDate, view, filter, q: search, favorites: favoriteOnly ? '1' : '' }, query => {
    const date = parseCalendarDate(query.get('date')) || new Date();
    setStart(weekStart(date)); setSelectedDate(dateIso(date));
    const mode = query.get('view');
    setView(mode === 'day' || mode === 'agenda' || mode === 'table' ? mode : 'week');
    const type = query.get('filter') || 'all';
    setFilter(type === 'all' || type in typeLabels ? type : 'all');
    setSearch((query.get('q') || '').slice(0, 80)); setFavoriteOnly(query.get('favorites') === '1');
  });
  useEffect(() => {
    if (!dateQueryReady) return;
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + 6);
    const startIso = dateIso(start);
    const key = cacheKeyForWeek(startIso);
    let cached: { savedAt: string; lessons: Lesson[] } | null = null;
    if (key) {
      try {
        const value = window.localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value) as { savedAt?: unknown; lessons?: unknown };
          if (typeof parsed.savedAt === 'string' && Array.isArray(parsed.lessons) && parsed.lessons.every(isLesson)) {
            cached = { savedAt: parsed.savedAt, lessons: parsed.lessons as Lesson[] };
          }
        }
      } catch {
        cached = null;
      }
    }

    let active = true;
    if (cached) {
      setSchedule(groupLessonsByWeek(cached.lessons, start));
      setOfflineSavedAt(cached.savedAt);
    } else {
      setSchedule([]);
      setOfflineSavedAt(null);
    }
    setCacheRefreshing(Boolean(cached));
    setLoading(!cached);
    setError('');
    apiFetchList<Lesson>(`/schedule/range?startDate=${startIso}&endDate=${dateIso(endDate)}`)
      .then(lessons => {
        if (!active) return;
        setSchedule(groupLessonsByWeek(lessons, start));
        setOfflineSavedAt(null);
        setCacheRefreshing(false);
        if (key) {
          try {
            window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), lessons }));
          } catch {
            // The live schedule remains usable when browser storage is unavailable.
          }
        }
      })
      .catch(err => {
        if (!active) return;
        if (cached) {
          setSchedule(groupLessonsByWeek(cached.lessons, start));
          setOfflineSavedAt(cached.savedAt);
          setCacheRefreshing(false);
          return;
        }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить расписание.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [start, dateQueryReady]);
  const favoriteNames = useMemo(() => new Set(favoriteTeachers.map(name => name.toLocaleLowerCase('ru-RU'))), [favoriteTeachers]);
  const toggleFavoriteTeacher = (teacher: string) => {
    const normalized = teacher.trim().toLocaleLowerCase('ru-RU');
    const wasFavorite = favoriteTeachers.some(name => name.toLocaleLowerCase('ru-RU') === normalized);
    setFavoriteTeachers(current => wasFavorite ? current.filter(name => name.toLocaleLowerCase('ru-RU') !== normalized) : [...current, teacher.trim()]);
    if (favoritesKey) void syncStudentFavorite(favoritesKey, { kind: 'teacher', externalId: teacher, label: teacher.trim() }, !wasFavorite).catch(() => undefined);
  };
  const filtered = useMemo(() => schedule.map(day => ({ ...day, lessons: day.lessons.filter(lesson => (filter === 'all' || lessonTypeKey(lesson.subjectType) === filter) && (!favoriteOnly || Boolean(lesson.teacherName && favoriteNames.has(lesson.teacherName.trim().toLocaleLowerCase('ru-RU')))) && (!search || `${lesson.subject} ${lesson.teacherName || ''} ${lesson.building || ''} ${lesson.room || ''} ${lesson.subgroup || ''}`.toLowerCase().includes(search.toLowerCase()))) })), [schedule, filter, favoriteOnly, favoriteNames, search]);
  const resetToday = () => { setStart(weekStart(new Date())); setSelectedDate(today); };
  const moveDate = (direction: number) => { const date = parseCalendarDate(selectedDate) || start; date.setDate(date.getDate() + direction * (view === "day" ? 1 : 7)); setStart(weekStart(date)); setSelectedDate(dateIso(date)); };
  const displayed = view === "day" ? filtered.filter(day => day.date === selectedDate) : filtered;
  return <div className="mx-auto max-w-[1400px] space-y-6"><header><div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">Расписание</h1><p className="mt-2 text-sm capitalize text-slate-500">{rangeLabel(start, end)}</p>{offlineSavedAt && <p className="mt-2 text-xs font-medium text-amber-700" role="status">{cacheRefreshing ? 'Сохраненная копия · проверяем актуальность' : 'Офлайн · сохранено'} {new Date(offlineSavedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })} · <button type="button" onClick={() => setStart(new Date(start))} className="underline">Повторить загрузку</button></p>}</div><div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 sm:flex sm:flex-wrap"><details className="relative col-span-3"><summary className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">Экспорт и отправка</summary><div className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border bg-white p-3 shadow-lg"><button onClick={() => downloadCalendar(schedule)} disabled={loading || !schedule.some(day => day.lessons.some(lesson => !isCancelled(lesson)))} className="h-11 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50">Скачать неделю (.ics)</button><button type="button" onClick={() => { setShareStatus(''); void shareWeekSchedule(filtered, rangeLabel(start, end), dateIso(start)).then(channel => setShareStatus(channel === 'max' ? 'Выберите чат или группу MAX, чтобы отправить расписание.' : channel === 'system' ? 'Окно отправки закрыто.' : 'Расписание скопировано в буфер обмена.')).catch(reason => setShareStatus(reason instanceof DOMException && reason.name === 'AbortError' ? 'Отправку отменили.' : 'Не удалось поделиться расписанием.')); }} disabled={loading || !filtered.some(day => day.lessons.length)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Поделиться неделей</button></div></details><button onClick={() => { moveDate(-1); }} className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-lg text-slate-600 hover:bg-slate-50" aria-label={view === "day" ? "Предыдущий день" : "Предыдущая неделя"}>‹</button><button onClick={resetToday} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Сегодня</button><button onClick={() => { moveDate(1); }} className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-lg text-slate-600 hover:bg-slate-50" aria-label={view === "day" ? "Следующий день" : "Следующая неделя"}>›</button></div></div>{shareStatus && <p className="mt-2 text-xs text-slate-600" role="status">{shareStatus}</p>}</header><section className="schedule-tools flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 lg:flex-row lg:items-center"><div className="schedule-views flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="group" aria-label="Вид расписания"><button aria-pressed={view === "day"} onClick={() => setView("day")} className={"min-h-11 rounded-lg px-4 py-2 text-sm font-semibold " + (view === "day" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>День</button><button aria-pressed={view === "week"} onClick={() => setView('week')} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${view === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Неделя</button><button aria-pressed={view === 'table'} onClick={() => setView('table')} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${view === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Таблица</button><button aria-pressed={view === 'agenda'} onClick={() => setView('agenda')} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${view === 'agenda' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Список</button><Link href={"/month?" + new URLSearchParams({ date: selectedDate, filter, q: search }).toString()} className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Месяц</Link><Link href="/groups" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Избранное</Link></div><details className="schedule-filters" open={Boolean(search || filter !== "all")}><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-slate-600">Поиск и фильтры</summary><div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"><label className="relative flex-1 sm:max-w-xs"><span className="sr-only">Поиск</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по предметам…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-indigo-400 focus:bg-white focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"/></label><select value={filter} onChange={event => setFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400" aria-label="Фильтр по типу занятия"><option value="all">Все</option><option value="lecture">Лекции</option><option value="practice">Практика</option><option value="lab">Лабораторные</option><option value="exam">Экзамены</option><option value="consultation">Консультации</option><option value="coursework">Курсовые</option><option value="test">Зачёты</option></select><label className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"><span className="mr-2 text-xs text-slate-400">Дата</span><input type="date" value={selectedDate} onChange={event => { const date = parseCalendarDate(event.target.value); if (date) { setStart(weekStart(date)); setSelectedDate(event.target.value); } }} className="bg-transparent text-sm outline-none" aria-label="Выбрать дату"/></label></div></details></section>{(favoriteTeachers.length > 0 || favoriteOnly) && <button type="button" aria-pressed={favoriteOnly} disabled={!favoriteTeachers.length && !favoriteOnly} onClick={() => setFavoriteOnly(value => !value)} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${favoriteOnly ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:text-amber-700'}`}>☆ Избранные преподаватели ({favoriteTeachers.length})</button>}{loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4"><Skeleton className="h-5 w-24"/><Skeleton className="mt-5 h-28"/><Skeleton className="mt-3 h-24"/></div>)}</div> : error ? <RequestState title="Не удалось загрузить расписание" description={error} onRetry={() => setStart(new Date(start))}/> : !displayed.some(day => day.lessons.length) ? <section className="rounded-2xl border border-slate-200 bg-white px-5 py-6"><h2 className="text-base font-semibold text-slate-900">{search || filter !== 'all' || favoriteOnly ? 'Занятий не найдено' : view === 'day' ? 'В этот день нет занятий' : 'На этой неделе нет занятий'}</h2>{search || filter !== 'all' || favoriteOnly ? <button type="button" onClick={() => { setSearch(''); setFilter('all'); setFavoriteOnly(false); }} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700">Сбросить фильтры</button> : <Link href="/groups" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700">Расписания групп</Link>}</section> : view !== 'table' ? <div className={view === 'week' ? 'grid gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'space-y-6'}>{displayed.map(day => !day.lessons.length ? <section key={day.date} className="schedule-empty-day"><div><h2>{day.dayName}</h2><p>{new Date(`${day.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p></div><span>{search || filter !== 'all' || favoriteOnly ? 'Нет совпадений' : 'Нет занятий'}</span></section> : <section key={day.date} className={`min-w-0 self-start rounded-2xl border bg-white ${day.date === today ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200'}`}><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="font-bold text-slate-900">{day.dayName}</h2><p className="mt-1 text-xs text-slate-500">{new Date(`${day.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p></div><span className="text-xs text-slate-400">{day.lessons.length} пар</span></div><div className="p-4">{day.lessons.length ? <div className={view === 'week' ? 'space-y-3' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3'}>{day.lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} favorite={Boolean(lesson.teacherName && favoriteNames.has(lesson.teacherName.trim().toLocaleLowerCase('ru-RU')))} onToggleFavorite={toggleFavoriteTeacher}/>)}</div> : <p className="text-sm text-slate-500">Нет занятий</p>}</div></section>)}</div> : <><p className="text-sm text-slate-600">Прокрутите таблицу вправо, чтобы увидеть остальные дни.</p><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" tabIndex={0} role="region" aria-label="Недельная таблица с горизонтальной прокруткой"><div className="grid min-w-[1700px] grid-cols-[80px_repeat(7,minmax(230px,1fr))]"><div className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50 p-3"/>{filtered.map(day => <div key={day.date} className={`border-b border-l border-slate-200 p-3 text-center ${day.date === today ? 'bg-indigo-50' : 'bg-slate-50'}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-700">{day.dayName.slice(0, 2)}</p><p className={`mt-1 text-sm font-semibold ${day.date === today ? 'text-indigo-600' : 'text-slate-500'}`}>{new Date(`${day.date}T12:00:00`).getDate()}</p></div>)}{Array.from(new Set(filtered.flatMap(day => day.lessons.map(lesson => time(lesson.startTime))))).sort().map(slot => <div key={slot} className="contents"><div className="sticky left-0 z-10 border-b border-slate-100 bg-white p-3 text-right text-sm font-semibold tabular-nums text-slate-600">{slot}</div>{filtered.map(day => <div key={`${day.date}-${slot}`} className={`min-h-32 border-b border-l border-slate-100 p-2 ${day.date === today ? 'bg-indigo-50/30' : ''}`}>{day.lessons.filter(lesson => time(lesson.startTime) === slot).map(lesson => <LessonCard key={lesson.id} lesson={lesson} compact favorite={Boolean(lesson.teacherName && favoriteNames.has(lesson.teacherName.trim().toLocaleLowerCase('ru-RU')))} onToggleFavorite={toggleFavoriteTeacher}/>)}</div>)}</div>)}</div></div></>}</div>;
}
