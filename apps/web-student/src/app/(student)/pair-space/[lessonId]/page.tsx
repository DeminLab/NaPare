'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { lessonTabFromSearch } from '@napare/ui/workspace-shell';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Card, Badge, Button, Input, TabBar, EmptyState, Avatar, Skeleton, Icon, RequestState } from '@/components/ui';
import { getLessonLocation } from '../../schedule-location';
import { PreparationProgressControl, type PreparationProgress } from '../../PreparationProgressControl';
import { PreparationChecklist } from '../../PreparationChecklist';
import type { PreparationSubtask } from '../../preparation-progress-api';

const lessonTime = (value?: string) => value?.includes('T') ? value.slice(11, 16) : value?.slice(0, 5) || '—';

interface Announcement {
  id: string;
  text: string;
  isPinned: boolean;
  authorName: string;
  createdAt: string;
}

interface Homework {
  id: string;
  title: string;
  description: string;
  deadline: string;
  progress?: PreparationProgress;
  subtasks?: PreparationSubtask[];
}

interface Message {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}

interface PairSpace {
  id: string;
  lessonId: string;
  moodleUrl?: string | null;
  announcements: Announcement[];
  homeworks: Homework[];
  messages: Message[];
  files?: { id: string; name?: string; fileName?: string; fileUrl?: string; createdAt: string }[];
}

interface Lesson {
  id: string;
  subject: string;
  subjectType: string;
  teacherName: string;
  room: string;
  building?: string | null;
  startTime: string;
  endTime: string;
  startDate?: string;
  isChanged?: boolean;
  changeDescription?: string;
  groupName: string;
  date?: string;
}

interface LessonChange {
  id: string;
  changeType: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  reason?: string | null;
  changedAt?: string;
  createdAt: string;
}

interface PairSpaceSnapshot {
  savedAt: string;
  pairSpace: PairSpace;
  lesson: Lesson;
  nextLesson: Lesson | null;
  lessonChanges: LessonChange[];
}

interface SubjectTimelineEntry {
  lesson: Lesson;
  pairSpace: Pick<PairSpace, 'announcements' | 'homeworks' | 'files'> | null;
}

function currentAccountCacheScope(): string | null {
  try {
    const encodedClaims = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!encodedClaims) return null;
    const normalized = encodedClaims.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `${encodeURIComponent(claims.universityId)}:${encodeURIComponent(claims.sub)}`;
  } catch {
    return null;
  }
}

function pairSpaceCacheKey(lessonId: string): string | null {
  const accountScope = currentAccountCacheScope();
  return accountScope ? `napare:student-pair:${accountScope}:${encodeURIComponent(lessonId)}` : null;
}

function personalNoteCacheKey(lessonId: string): string | null {
  const accountScope = currentAccountCacheScope();
  return accountScope ? `napare:student-pair-note:${accountScope}:${encodeURIComponent(lessonId)}` : null;
}

function isPairSpaceSnapshot(value: unknown): value is PairSpaceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<PairSpaceSnapshot>;
  return typeof snapshot.savedAt === 'string'
    && !!snapshot.pairSpace && typeof snapshot.pairSpace.lessonId === 'string'
    && !!snapshot.lesson && typeof snapshot.lesson.id === 'string'
    && Array.isArray(snapshot.lessonChanges)
    && (snapshot.nextLesson === null || (!!snapshot.nextLesson && typeof snapshot.nextLesson.id === 'string'));
}

const typeLabels: Record<string, string> = {
  lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная',
  exam: 'Экзамен', consultation: 'Консультация',
};

const changeTypeLabels: Record<string, string> = {
  moved: 'Пара перенесена',
  cancelled: 'Пара отменена',
  room_changed: 'Изменилась аудитория',
  teacher_changed: 'Изменился преподаватель',
  added: 'Добавлена пара',
  updated: 'Обновлено занятие',
};

function valueText(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function lessonMoment(values: Record<string, unknown>, dateKey: string, timeKey: string): string | null {
  const clock = valueText(values[timeKey]);
  const dateValue = valueText(values[dateKey]);
  const timeValue = clock ? (clock.includes('T') ? clock.slice(11, 16) : clock.slice(0, 5)) : null;
  if (!dateValue) return timeValue;
  const date = new Date(`${dateValue.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return timeValue;
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${day}${timeValue ? ` · ${timeValue}` : ''}`;
}

function lessonLocation(values: Record<string, unknown>): string | null {
  const building = valueText(values.building);
  const room = valueText(values.room);
  if (!building && !room) return null;
  return [building && `корпус ${building}`, room && `ауд. ${room}`].filter(Boolean).join(', ');
}

function changeRows(change: LessonChange): Array<{ label: string; oldValue: string; newValue: string }> {
  const pairs: Array<[string, string | null, string | null]> = [
    ['Предмет', valueText(change.oldValues.subject), valueText(change.newValues.subject)],
    ['Начало', lessonMoment(change.oldValues, 'startDate', 'startTime'), lessonMoment(change.newValues, 'startDate', 'startTime')],
    ['Окончание', lessonMoment(change.oldValues, 'endDate', 'endTime'), lessonMoment(change.newValues, 'endDate', 'endTime')],
    ['Место', lessonLocation(change.oldValues), lessonLocation(change.newValues)],
    ['Преподаватель', valueText(change.oldValues.teacherName), valueText(change.newValues.teacherName)],
  ];
  return pairs.filter(([, oldValue, newValue]) => oldValue !== newValue && (oldValue !== null || newValue !== null))
    .map(([label, oldValue, newValue]) => ({ label, oldValue: oldValue || '—', newValue: newValue || '—' }));
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`;
  return `${Math.floor(diff / 86400)} дн`;
}

function displayLessonDate(value?: string): string {
  if (!value) return 'Дата не указана';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Дата не указана' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PairSpacePage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [pairSpace, setPairSpace] = useState<PairSpace | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState('');
  const notesRef = useRef('');
  const [notesStorageKey, setNotesStorageKey] = useState('');
  const [notesReady, setNotesReady] = useState(false);
  const [notesSync, setNotesSync] = useState('');
  const [error, setError] = useState('');
  const [messageSaving, setMessageSaving] = useState(false);
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null);
  const [lessonChanges, setLessonChanges] = useState<LessonChange[]>([]);
  const [subjectTimeline, setSubjectTimeline] = useState<SubjectTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [timelineRequested, setTimelineRequested] = useState(false);
  const [timelineRetry, setTimelineRetry] = useState(0);
  useEffect(() => {
    const syncTab = () => setActiveTab(lessonTabFromSearch(window.location.search, true));
    syncTab();
    window.addEventListener('popstate', syncTab);
    return () => window.removeEventListener('popstate', syncTab);
  }, [lessonId]);
  useEffect(() => {
    if (activeTab === 'timeline' && !timelineRequested) { setTimelineLoading(true); setTimelineRequested(true); }
  }, [activeTab, timelineRequested]);
  const selectTab = (tab: string) => {
    setActiveTab(tab);
    const query = new URLSearchParams(window.location.search);
    query.set('tab', tab);
    router.push('/pair-space/' + lessonId + '?' + query.toString(), { scroll: false });
  };


  useEffect(() => {
    let active = true;
    const cacheKey = pairSpaceCacheKey(lessonId);
    let cached: PairSpaceSnapshot | null = null;
    setError('');
    setLoadWarning('');
    if (cacheKey) {
      try {
        const raw = window.localStorage.getItem(cacheKey);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (isPairSpaceSnapshot(parsed) && parsed.pairSpace.lessonId === lessonId && parsed.lesson.id === lessonId) cached = parsed;
      } catch { cached = null; }
    }
    if (cached) {
      setPairSpace(cached.pairSpace);
      setLesson(cached.lesson);
      setNextLesson(cached.nextLesson);
      setLessonChanges(cached.lessonChanges);
      setOfflineSavedAt(cached.savedAt);
      setCacheRefreshing(true);
      setLoading(false);
    } else {
      setPairSpace(null);
      setLesson(null);
      setNextLesson(null);
      setLessonChanges([]);
      setOfflineSavedAt(null);
      setCacheRefreshing(false);
      setLoading(true);
    }
    const changesRequest = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lessonId)
      ? apiFetchList<LessonChange>(`/schedule/lessons/${lessonId}/changes`).catch(() => cached?.lessonChanges ?? [])
      : Promise.resolve(cached?.lessonChanges ?? []);
    Promise.all([
      apiFetch<PairSpace>(`/pair-spaces/${lessonId}`),
      apiFetch<Lesson>(`/schedule/lessons/${lessonId}`),
      apiFetchList<Lesson>(`/schedule/range?startDate=${new Date().toISOString().split('T')[0]}&endDate=${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}`).catch(() => []),
      changesRequest,
    ]).then(([ps, l, lessons, changes]) => {
      if (!active) return;
      const upcoming = lessons.filter(item => item.id !== l.id && new Date(item.startTime).getTime() > new Date(l.startTime).getTime()).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] || cached?.nextLesson || null;
      setPairSpace(ps);
      setLesson(l);
      setNextLesson(upcoming);
      setLessonChanges(changes);
      setOfflineSavedAt(null);
      setCacheRefreshing(false);
      if (cacheKey) {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt: new Date().toISOString(), pairSpace: ps, lesson: l, nextLesson: upcoming, lessonChanges: changes } satisfies PairSpaceSnapshot));
        } catch { /* Keep the network response usable if local storage is full or unavailable. */ }
      }
    }).catch((err) => {
      if (!active) return;
      setCacheRefreshing(false);
      if (cached) {
        setOfflineSavedAt(cached.savedAt);
        setLoadWarning(err instanceof Error ? err.message : 'Показана сохранённая копия: не удалось обновить пространство пары.');
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить пространство пары.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lessonId]);

  useEffect(() => {
    if (!lesson?.id || !timelineRequested) return;
    let active = true;
    setTimelineLoading(true);
    setTimelineError('');
    apiFetchList<SubjectTimelineEntry>(`/pair-spaces/${lesson.id}/timeline`)
      .then(entries => { if (active) setSubjectTimeline(entries); })
      .catch(err => { if (active) setTimelineError(err instanceof Error ? err.message : 'Не удалось загрузить историю предмета.'); })
      .finally(() => { if (active) setTimelineLoading(false); });
    return () => { active = false; };
  }, [lesson?.id, timelineRequested, timelineRetry]);

  useEffect(() => {
    let active = true;
    const storageKey = personalNoteCacheKey(lessonId) || '';
    setNotesStorageKey(storageKey);
    setNotesReady(Boolean(storageKey));
    setNotes('');
    notesRef.current = '';
    setNotesSync('');
    if (!storageKey) {
      setNotesSync('Нужна активная сессия, чтобы открыть личную заметку');
      return () => { active = false; };
    }
    const localNote = window.localStorage.getItem(storageKey) || '';
    setNotes(localNote);
    notesRef.current = localNote;
    setNotesSync(localNote ? 'Локальная копия загружена' : '');
    void apiFetch<{ content: string } | null>(`/pair-spaces/${lessonId}/personal-note`)
      .then((saved) => {
        if (!active) return;
        if (saved?.content) {
          setNotes(saved.content);
          notesRef.current = saved.content;
          try { window.localStorage.setItem(storageKey, saved.content); } catch { /* The account copy remains the source of truth. */ }
          setNotesSync('Синхронизировано');
        } else {
          if (localNote) {
            setNotesSync('Синхронизируем заметку…');
            return apiFetch(`/pair-spaces/${lessonId}/personal-note`, {
              method: 'PUT',
              body: JSON.stringify({ content: localNote }),
            }).then(() => { if (active) setNotesSync('Синхронизировано'); })
              .catch(() => { if (active) setNotesSync('Нет связи · сохранено на этом устройстве'); });
          }
          setNotesSync('Заметка будет доступна на ваших устройствах');
        }
      })
      .catch(() => {
        if (!active) return;
        setNotesSync(localNote ? 'Нет связи · сохранено на этом устройстве' : 'Нет связи · заметка будет сохранена локально');
      });
    return () => { active = false; };
  }, [lessonId]);

  useEffect(() => {
    if (!notesStorageKey || !notesSync || notesSync === 'Синхронизировано' || notesSync === 'Локальная копия загружена' || notesSync.startsWith('Заметка будет доступна')) return;
    const timeout = window.setTimeout(() => {
      const value = notes;
      void apiFetch(`/pair-spaces/${lessonId}/personal-note`, {
        method: 'PUT',
        body: JSON.stringify({ content: value }),
      }).then(() => { if (notesRef.current === value) setNotesSync('Синхронизировано'); })
        .catch(() => { if (notesRef.current === value) setNotesSync('Нет связи · сохранено на этом устройстве'); });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [lessonId, notes, notesStorageKey, notesSync]);

  const saveNotes = (value: string) => {
    setNotes(value);
    notesRef.current = value;
    let localSaved = false;
    if (notesStorageKey) {
      try {
        window.localStorage.setItem(notesStorageKey, value);
        localSaved = true;
      } catch { /* Continue with server sync even if local storage is unavailable. */ }
    }
    setNotesSync(localSaved ? 'Сохранение…' : 'Локальная копия недоступна · сохраняем в аккаунт');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setMessageSaving(true);
    setError('');
    try {
      const msg = await apiFetch<Message>(`/pair-spaces/${lessonId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: newMessage }),
      });
      if (pairSpace) {
        const updated = { ...pairSpace, messages: [...pairSpace.messages, msg] };
        setPairSpace(updated);
        const cacheKey = pairSpaceCacheKey(lessonId);
        if (cacheKey && lesson) {
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt: new Date().toISOString(), pairSpace: updated, lesson, nextLesson, lessonChanges } satisfies PairSpaceSnapshot));
          } catch { /* The posted message remains available in the live view. */ }
        }
      }
      setNewMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение.');
    } finally {
      setMessageSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error && !pairSpace) {
    return <div className="mx-auto max-w-3xl"><RequestState title="Не удалось открыть занятие" description={error} onRetry={() => window.location.reload()} /></div>;
  }

  const tabs = [
    { id: 'overview', label: 'Главное' },
    { id: 'homeworks', label: 'Подготовка', count: pairSpace?.homeworks.length },
    { id: 'materials', label: 'Материалы', count: pairSpace?.files?.length },
    { id: 'discussion', label: 'Обсуждение', count: pairSpace?.messages.length },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div>
        <div className="mb-4 text-xs font-medium text-slate-400">НаПаре <span aria-hidden="true">/</span> Расписание <span aria-hidden="true">/</span> <span className="text-slate-600">{lesson?.subject || 'Занятие'}</span></div><button onClick={() => router.push('/week?date=' + (lesson?.startDate || lesson?.date || lesson?.startTime || '').slice(0, 10))} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к расписанию
        </button>
        {lesson && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{lesson.subject}</h1><div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500"><span>{displayLessonDate(lesson.startDate || lesson.date || lesson.startTime.slice(0, 10))}</span><Badge variant="subject">{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge><span>{lessonTime(lesson.startTime)}–{lessonTime(lesson.endTime)}</span>{getLessonLocation(lesson.building, lesson.room) && <span>· {getLessonLocation(lesson.building, lesson.room)}</span>}</div><p className="mt-3 text-sm text-slate-600"><span className="font-medium">Преподаватель:</span> {lesson.teacherName || 'Не указан'}</p></div><button onClick={() => selectTab('discussion')} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Обсудить занятие</button></div>
        )}
      </div>

      {(lessonChanges.length > 0 || lesson?.isChanged) && (
        <Card className="border-amber-200 bg-amber-50/50">
          <h2 className="text-base font-bold text-slate-900">Изменения расписания</h2>
          {lessonChanges.length > 0 ? (
            <ol className="mt-4 space-y-4">
              {lessonChanges.slice(0, 5).map(change => {
                const rows = changeRows(change);
                return (
                  <li key={change.id} className="border-t border-amber-200 pt-3 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{changeTypeLabels[change.changeType] || 'Обновлено расписание'}</p>
                      <time className="text-xs text-slate-500" dateTime={change.changedAt || change.createdAt}>
                        {new Date(change.changedAt || change.createdAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}
                      </time>
                    </div>
                    {rows.length > 0 && <dl className="mt-3 space-y-2">{rows.map(row => <div key={row.label} className="grid gap-1 text-sm sm:grid-cols-[110px_1fr]"><dt className="text-slate-500">{row.label}</dt><dd className="font-medium text-slate-800"><span className="text-slate-500">{row.oldValue}</span><span className="mx-2 text-amber-700" aria-label="изменено на">→</span>{row.newValue}</dd></div>)}</dl>}
                    {change.reason && <p className="mt-2 text-xs leading-5 text-slate-600">{change.reason}</p>}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-700">{lesson?.changeDescription || 'Источник расписания сообщил об изменении этой пары.'}</p>
          )}
        </Card>
      )}

      {offlineSavedAt && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status"><span>{cacheRefreshing ? 'Сохранённая копия · проверяем актуальность' : `Офлайн · сохранено ${new Date(offlineSavedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`}{loadWarning ? ` · ${loadWarning}` : ''}</span><button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Обновить</button></div>}

      <div className="sticky top-16 z-20 -mx-2 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-2 py-2 backdrop-blur sm:mx-0"><TabBar tabs={tabs} activeTab={activeTab} onChange={selectTab} /></div>
      {error && <RequestState title="Не удалось выполнить действие" description={error} onRetry={() => setError('')} />}

      <div className="flex flex-wrap items-center gap-2" aria-label="Дополнительные действия">
        <Button variant={activeTab === 'notes' ? 'primary' : 'ghost'} onClick={() => selectTab('notes')}>Личные заметки</Button>
        <Button variant={activeTab === 'timeline' ? 'primary' : 'ghost'} onClick={() => selectTab('timeline')}>История предмета</Button>
        {pairSpace?.moodleUrl?.startsWith('https://') && <a href={pairSpace.moodleUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Сдача работ и оценки в Moodle ↗</a>}
      </div>
      {activeTab === 'overview' && <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="text-lg font-semibold text-slate-900">Подготовка к занятию</h2><p className="mt-2 text-sm text-slate-600">{pairSpace?.homeworks.length ? 'Тем подготовки: ' + pairSpace.homeworks.length + '. Откройте список, чтобы проверить сроки и отметить свой прогресс.' : 'Преподаватель пока не опубликовал подготовку.'}</p><Button className="mt-4" onClick={() => selectTab('homeworks')}>Открыть подготовку</Button></Card>
        <Card><h2 className="text-lg font-semibold text-slate-900">Материалы занятия</h2><p className="mt-2 text-sm text-slate-600">{pairSpace?.files?.length ? 'Материалов: ' + pairSpace.files.length : 'Материалов пока нет.'} Сдача работ и оценки находятся в Moodle.</p><Button variant="secondary" className="mt-4" onClick={() => selectTab('materials')}>Открыть материалы</Button></Card>
        {nextLesson && <Card className="md:col-span-2"><h2 className="text-lg font-semibold text-slate-900">Следующее занятие</h2><Link href={'/pair-space/' + nextLesson.id} className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-3 text-sm font-semibold text-indigo-600"><span>{nextLesson.subject} · {displayLessonDate(nextLesson.startDate || nextLesson.date)} · {lessonTime(nextLesson.startTime)}–{lessonTime(nextLesson.endTime)}</span><span>{getLessonLocation(nextLesson.building, nextLesson.room) || 'Место не указано'} →</span></Link></Card>}
      </div>}

      {/* Announcements */}
      {activeTab === 'overview' && (
        <div className="space-y-3"><h2 className="text-lg font-semibold text-slate-900">Объявления преподавателя</h2>
          {pairSpace?.announcements.length === 0 ? (
            <EmptyState title="Нет объявлений" description="Объявления от преподавателя появятся здесь" />
          ) : (
            pairSpace?.announcements.map(a => (
              <Card key={a.id} padding="sm" className={a.isPinned ? 'border-amber-200 bg-amber-50/50' : ''}>
                <div className="flex items-start gap-3">
                  <Icon name={a.isPinned ? 'Pin' : 'MessageCircle'} className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-900">{a.text}</p>
                    <p className="mt-1 text-xs text-slate-400">{a.authorName} · {timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {timelineLoading ? <div className="space-y-3"><Skeleton className="h-36"/><Skeleton className="h-36"/></div>
            : timelineError ? <RequestState title="Не удалось загрузить историю предмета" description={timelineError} onRetry={() => { setTimelineLoading(true); setTimelineRetry(value => value + 1); }}/>
              : subjectTimeline.length ? subjectTimeline.map(entry => (
                <article key={entry.lesson.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500">{displayLessonDate(entry.lesson.startDate || entry.lesson.date)} · {lessonTime(entry.lesson.startTime)}–{lessonTime(entry.lesson.endTime)}</p>
                      <h2 className="mt-1 text-base font-semibold text-slate-900">{entry.lesson.subject}</h2>
                      <p className="mt-1 text-sm text-slate-500">{typeLabels[entry.lesson.subjectType] || entry.lesson.subjectType} · {entry.lesson.teacherName || 'Преподаватель не указан'} · {getLessonLocation(entry.lesson.building, entry.lesson.room) || 'Аудитория не указана'}</p>
                    </div>
                    <Link href={`/pair-space/${entry.lesson.id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Открыть пару</Link>
                  </div>
                  {entry.pairSpace && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
                    <div><h3 className="text-xs font-semibold text-slate-500">Подготовка</h3>{entry.pairSpace.homeworks.length ? <ul className="mt-2 space-y-1.5">{entry.pairSpace.homeworks.slice(0, 3).map(homework => <li key={homework.id} className="text-sm text-slate-700">{homework.title}{homework.deadline && <span className="block text-xs text-slate-400">Срок: {new Date(homework.deadline).toLocaleDateString('ru-RU')}</span>}</li>)}</ul> : <p className="mt-1 text-sm text-slate-400">Нет заданий</p>}</div>
                    <div><h3 className="text-xs font-semibold text-slate-500">Объявления</h3>{entry.pairSpace.announcements.length ? <ul className="mt-2 space-y-1.5">{entry.pairSpace.announcements.slice(0, 2).map(announcement => <li key={announcement.id} className="line-clamp-2 text-sm text-slate-700">{announcement.text}</li>)}</ul> : <p className="mt-1 text-sm text-slate-400">Нет объявлений</p>}</div>
                    <div><h3 className="text-xs font-semibold text-slate-500">Материалы</h3>{entry.pairSpace.files?.length ? <ul className="mt-2 space-y-1.5">{entry.pairSpace.files.slice(0, 3).map(file => <li key={file.id} className="truncate text-sm">{file.fileUrl?.startsWith('https://') ? <a href={file.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">{file.name || file.fileName || 'Файл'}</a> : <span className="text-slate-600">{file.name || file.fileName || 'Файл'}</span>}</li>)}</ul> : <p className="mt-1 text-sm text-slate-400">Нет файлов</p>}</div>
                  </div>}
                </article>
              ))
                : <EmptyState title="Истории занятий пока нет" description="Для этого предмета ещё не найдено других занятий в вашем учебном пространстве."/>}
        </div>
      )}

      {activeTab === 'materials' && (
        <Card><div className="flex items-center gap-3"><Icon name="Paperclip" className="h-5 w-5 text-indigo-500" /><div><h3 className="font-semibold text-slate-900">Материалы</h3><p className="text-sm text-slate-500">Файлы и ссылки для подготовки к занятию.</p></div></div>{pairSpace?.files?.length ? <div className="mt-5 divide-y divide-slate-100">{pairSpace.files.map(file => <div key={file.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium text-slate-800">{file.name || file.fileName || 'Файл'}</p><p className="mt-1 text-xs text-slate-400">{timeAgo(file.createdAt)}</p></div>{file.fileUrl?.startsWith('https://') ? <a href={file.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Открыть</a> : <span className="text-xs text-slate-400">Файл недоступен</span>}</div>)}</div> : <EmptyState title="Материалов пока нет" description="Файлы от преподавателя появятся здесь." />}</Card>
      )}

      {activeTab === 'notes' && (
        <Card>
          <div className="flex items-center gap-3"><Icon name="FileText" className="h-5 w-5 text-indigo-500" /><div><h3 className="font-semibold text-slate-900">Личные заметки</h3><p className="text-sm text-slate-500" role="status">{notesSync || 'Заметки видны только вам и синхронизируются с аккаунтом.'}</p></div></div>
          <textarea value={notes} onChange={e => saveNotes(e.target.value)} disabled={!notesReady} placeholder={notesReady ? 'Запишите важные мысли по занятию...' : 'Загружаем заметку…'} className="mt-5 min-h-48 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-wait disabled:opacity-60" />
        </Card>
      )}

      {/* Homeworks */}
      {activeTab === 'homeworks' && (
        <div className="space-y-3">
          {pairSpace?.homeworks.length === 0 ? (
            <EmptyState title="Подготовки пока нет" description="Темы и материалы от преподавателя появятся здесь." />
          ) : (
            pairSpace?.homeworks.map(h => (
              <Card key={h.id} padding="sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{h.title}</h3>
                    {h.description && <p className="mt-1 text-sm text-slate-600">{h.description}</p>}
                    {h.deadline && (
                      <p className="mt-2 text-xs text-slate-400">
                        Срок: {new Date(h.deadline).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                  <PreparationProgressControl preparationId={h.id} initialState={h.progress} />
                </div>
                <PreparationChecklist preparationId={h.id} initialSubtasks={h.subtasks} />
              </Card>
            ))
          )}
        </div>
      )}

      {/* Chat */}
      {activeTab === 'discussion' && (
        <div className="space-y-3">
          {pairSpace?.messages.length === 0 ? (
            <EmptyState title="Нет сообщений" description="Начните обсуждение" />
          ) : (
            pairSpace?.messages.map(m => (
              <Card key={m.id} padding="sm">
                <div className="flex items-start gap-3">
                  <Avatar name={m.authorName} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{m.authorName}</span>
                      <span className="text-xs text-slate-400">{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{m.text}</p>
                  </div>
                </div>
              </Card>
            ))
          )}

          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Сообщение..."
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            />
            <Button loading={messageSaving} onClick={handleSendMessage} aria-label="Отправить сообщение"><Icon name="Send" className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
