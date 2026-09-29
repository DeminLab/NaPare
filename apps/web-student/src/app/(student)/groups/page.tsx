'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { flushStudentFavoriteQueue, getStudentFavorites, syncStudentFavorite } from '../favorite-api';
import { EmptyState, RequestState, Skeleton } from '@/components/ui';

interface AcademicYear { value: string; label: string; }
interface StudyGroup { groupId: string; name: string; faculty: string; course: number; academicYear: string; }
interface GroupLesson { lessonId: string; groupId: string; groupName: string; date: string; startTime: string; endTime: string; subject: string; subjectType?: string; teacher?: string; room?: string; subgroup?: string; weekType?: 'odd' | 'even' | 'both'; isReplacement: boolean; }
interface Day { date: string; lessons: GroupLesson[]; }
interface GroupScheduleCache { savedAt: string; lessons: GroupLesson[]; }
interface GroupCatalogCache { years: AcademicYear[]; groupsByYear: Record<string, StudyGroup[]>; selectedYear?: string; selectedGroupId?: string; }

const dateIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const startOfWeek = (value: Date) => { const date = new Date(value); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)); return date; };
const lessonTime = (value: string) => value.includes('T') ? value.slice(11, 16) : value.slice(0, 5);

function isGroupLesson(value: unknown): value is GroupLesson {
  if (!value || typeof value !== 'object') return false;
  const lesson = value as Partial<GroupLesson>;
  return typeof lesson.lessonId === 'string' && typeof lesson.groupId === 'string'
    && typeof lesson.date === 'string' && typeof lesson.startTime === 'string'
    && typeof lesson.endTime === 'string' && typeof lesson.subject === 'string';
}

function isStudyGroup(value: unknown): value is StudyGroup {
  if (!value || typeof value !== 'object') return false;
  const group = value as Partial<StudyGroup>;
  return typeof group.groupId === 'string' && typeof group.name === 'string' && typeof group.faculty === 'string';
}

function readCatalogCache(key: string | null): GroupCatalogCache | null {
  if (!key) return null;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<GroupCatalogCache>;
    if (!Array.isArray(parsed.years) || !parsed.years.every(item => item && typeof item.value === 'string' && typeof item.label === 'string')) return null;
    const groupsByYear = parsed.groupsByYear && typeof parsed.groupsByYear === 'object' ? parsed.groupsByYear : {};
    if (!Object.values(groupsByYear).every(items => Array.isArray(items) && items.every(isStudyGroup))) return null;
    return { years: parsed.years, groupsByYear, selectedYear: parsed.selectedYear, selectedGroupId: parsed.selectedGroupId };
  } catch {
    return null;
  }
}

function updateCatalogCache(key: string | null, update: (current: GroupCatalogCache) => GroupCatalogCache): void {
  if (!key) return;
  try {
    const current = readCatalogCache(key) || { years: [], groupsByYear: {} };
    window.localStorage.setItem(key, JSON.stringify(update(current)));
  } catch {
    // Public catalog remains usable when browser storage is unavailable.
  }
}

function favoriteGroupsKey(): string | null {
  try {
    const encodedClaims = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!encodedClaims) return null;
    const base64 = encodedClaims.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `napare:student-favorite-groups:${encodeURIComponent(claims.universityId)}:${encodeURIComponent(claims.sub)}`;
  } catch {
    return null;
  }
}

function daysForWeek(lessons: GroupLesson[], weekStart: Date): Day[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const key = dateIso(date);
    return { date: key, lessons: lessons.filter(lesson => lesson.date === key).sort((a, b) => a.startTime.localeCompare(b.startTime)) };
  });
}

export default function GroupSchedulePage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [year, setYear] = useState('');
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const favoriteIdsRef = useRef(favoriteIds);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [lessonSearch, setLessonSearch] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleRetry, setScheduleRetry] = useState(0);
  const [catalogError, setCatalogError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSavedAt, setScheduleSavedAt] = useState<string | null>(null);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);
  const favoritesKey = useMemo(favoriteGroupsKey, []);
  const catalogCacheKey = useMemo(() => favoritesKey ? `${favoritesKey}:catalog` : null, [favoritesKey]);

  useEffect(() => { favoriteIdsRef.current = favoriteIds; }, [favoriteIds]);

  const loadGroups = useCallback(async (academicYear: string) => {
    const cached = readCatalogCache(catalogCacheKey);
    const cachedGroups = cached?.groupsByYear[academicYear];
    if (cachedGroups) {
      setGroups(cachedGroups);
      setSelectedGroupId(current => cachedGroups.some(group => group.groupId === current) ? current : cachedGroups.some(group => group.groupId === cached?.selectedGroupId) ? cached?.selectedGroupId || '' : '');
      setCatalogLoading(false);
    } else {
      setCatalogLoading(true);
    }
    setCatalogError('');
    try {
      const result = await apiFetch<StudyGroup[]>(`/auth/rasp-groups?year=${encodeURIComponent(academicYear)}`);
      setGroups(result);
      setSelectedGroupId(current => result.some(group => group.groupId === current) ? current : '');
      updateCatalogCache(catalogCacheKey, current => ({ ...current, groupsByYear: { ...current.groupsByYear, [academicYear]: result }, selectedYear: academicYear }));
    } catch (reason) {
      setCatalogError(reason instanceof Error ? reason.message : 'Не удалось загрузить список групп.');
      if (!cachedGroups) { setGroups([]); setSelectedGroupId(''); }
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogCacheKey]);

  useEffect(() => {
    let active = true;
    const cached = readCatalogCache(catalogCacheKey);
    if (cached) {
      setYears(cached.years);
      const savedYear = cached.selectedYear && cached.years.some(item => item.value === cached.selectedYear) ? cached.selectedYear : cached.years.at(-1)?.value || '';
      setYear(savedYear);
      const savedGroups = cached.groupsByYear[savedYear] || [];
      setGroups(savedGroups);
      setSelectedGroupId(savedGroups.some(group => group.groupId === cached.selectedGroupId) ? cached.selectedGroupId || '' : '');
      setCatalogLoading(false);
    }
    void apiFetch<AcademicYear[]>('/auth/rasp-years').then(result => {
      if (!active) return;
      if (!result.length) {
        setCatalogError('Источник не вернул доступные учебные годы.');
        if (!cached) { setYears([]); setYear(''); setCatalogLoading(false); }
        return;
      }
      setYears(result);
      const params = new URLSearchParams(window.location.search);
      const requestedYear = params.get('year');
      const selectedYear = requestedYear && result.some(item => item.value === requestedYear)
        ? requestedYear
        : cached?.selectedYear && result.some(item => item.value === cached.selectedYear) ? cached.selectedYear : result.at(-1)?.value || '';
      setYear(selectedYear);
      const requestedGroup = params.get('groupId');
      if (requestedGroup && requestedYear === selectedYear) setSelectedGroupId(requestedGroup);
      updateCatalogCache(catalogCacheKey, current => ({ ...current, years: result, selectedYear, ...(requestedGroup && requestedYear === selectedYear ? { selectedGroupId: requestedGroup } : {}) }));
    }).catch(reason => {
      if (active) {
        setCatalogError(reason instanceof Error ? reason.message : 'Не удалось загрузить учебные годы.');
        if (!cached) setCatalogLoading(false);
      }
    });
    return () => { active = false; };
  }, [catalogCacheKey]);

  useEffect(() => { if (year) void loadGroups(year); }, [year, loadGroups]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get('date');
    const parsedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? new Date(`${requestedDate}T12:00:00`) : null;
    if (parsedDate && !Number.isNaN(parsedDate.getTime()) && dateIso(parsedDate) === requestedDate) setWeek(startOfWeek(parsedDate));
    const requestedSearch = params.get('q');
    if (requestedSearch) setLessonSearch(requestedSearch);
  }, []);

  useEffect(() => {
    if (!favoritesKey) { setFavoritesLoaded(true); return; }
    let active = true;
    let localIds: string[] = [];
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(favoritesKey) || '[]');
      if (Array.isArray(saved)) localIds = [...new Set(saved.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))];
    } catch {
      localIds = [];
    }
    setFavoriteIds(localIds);
    setFavoritesLoaded(true);
    void (async () => {
      await flushStudentFavoriteQueue(favoritesKey);
      const remote = await getStudentFavorites();
      if (!active) return;
      const remoteIds = remote.filter(item => item.kind === 'group').map(item => item.externalId);
      const remoteSet = new Set(remoteIds);
      const currentIds = favoriteIdsRef.current;
      const merged = [...new Set([...remoteIds, ...currentIds])];
      setFavoriteIds(merged);
      await Promise.all(currentIds.filter(id => !remoteSet.has(id)).map(id => syncStudentFavorite(favoritesKey, { kind: 'group', externalId: id, label: id }, true).catch(() => undefined)));
    })().catch(() => {
      // The account-scoped local copy stays available offline.
    });
    return () => { active = false; };
  }, [favoritesKey]);

  useEffect(() => {
    if (!favoritesLoaded || !favoritesKey) return;
    try { window.localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds)); } catch { /* Keep favorites for the current page session. */ }
  }, [favoriteIds, favoritesKey, favoritesLoaded]);

  useEffect(() => {
    if (!year || !selectedGroupId) { setLessons([]); setScheduleSavedAt(null); setScheduleRefreshing(false); setScheduleLoading(false); setScheduleError(''); return; }
    let active = true;
    const cacheKey = `napare:rasp-schedule:${year}:${selectedGroupId}`;
    let cached: GroupScheduleCache | null = null;
    try {
      const value = window.localStorage.getItem(cacheKey);
      if (value) {
        const parsed = JSON.parse(value) as { savedAt?: unknown; lessons?: unknown };
        if (typeof parsed.savedAt === 'string' && Array.isArray(parsed.lessons) && parsed.lessons.every(isGroupLesson)) {
          cached = { savedAt: parsed.savedAt, lessons: parsed.lessons };
        }
      }
    } catch {
      cached = null;
    }
    setLessons(cached?.lessons || []);
    setScheduleSavedAt(cached?.savedAt || null);
    setScheduleRefreshing(Boolean(cached));
    setScheduleLoading(!cached);
    setScheduleError('');
    void apiFetch<GroupLesson[]>(`/auth/rasp-schedule?groupId=${encodeURIComponent(selectedGroupId)}&year=${encodeURIComponent(year)}`)
      .then(result => {
        if (!active) return;
        const savedAt = new Date().toISOString();
        setLessons(result);
        setScheduleSavedAt(savedAt);
        setScheduleRefreshing(false);
        try { window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt, lessons: result })); } catch { /* Keep the loaded public schedule usable if storage is unavailable. */ }
      })
      .catch(reason => { if (active) { if (!cached) setLessons([]); setScheduleError(reason instanceof Error ? reason.message : 'Не удалось загрузить расписание группы.'); setScheduleRefreshing(false); } })
      .finally(() => { if (active) setScheduleLoading(false); });
    return () => { active = false; };
  }, [year, selectedGroupId, scheduleRetry]);

  const selectedGroup = groups.find(group => group.groupId === selectedGroupId);
  const visibleGroups = useMemo(() => groups.filter(group =>
    (!favoriteOnly || favoriteIds.includes(group.groupId))
    && (!search || `${group.name} ${group.faculty} ${group.course}`.toLocaleLowerCase('ru-RU').includes(search.trim().toLocaleLowerCase('ru-RU'))),
  ), [groups, favoriteOnly, favoriteIds, search]);
  const days = useMemo(() => daysForWeek(lessons, week), [lessons, week]);
  const normalizedLessonSearch = lessonSearch.trim().toLocaleLowerCase('ru-RU');
  const changeWeek = (offset: number) => setWeek(current => { const next = new Date(current); next.setDate(next.getDate() + offset * 7); return next; });
  const selectGroup = (groupId: string) => { setSelectedGroupId(groupId); setLessons([]); setScheduleSavedAt(null); setScheduleRefreshing(false); setScheduleError(''); setScheduleLoading(Boolean(groupId)); updateCatalogCache(catalogCacheKey, current => ({ ...current, selectedYear: year, selectedGroupId: groupId })); };
  const toggleFavorite = (groupId: string) => {
    const wasFavorite = favoriteIds.includes(groupId);
    setFavoriteIds(current => wasFavorite ? current.filter(id => id !== groupId) : [...current, groupId]);
    if (favoritesKey) void syncStudentFavorite(favoritesKey, { kind: 'group', externalId: groupId, label: groups.find(group => group.groupId === groupId)?.name || groupId }, !wasFavorite).catch(() => undefined);
  };

  return <main className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
    <section className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Каталог СИБИТ</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Расписания групп</h1></div><label className="sr-only" htmlFor="academic-year">Учебный год</label><select id="academic-year" value={year} onChange={event => { selectGroup(''); setYear(event.target.value); }} className="h-10 max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-xs" aria-label="Учебный год">{years.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      <p className="mt-2 text-sm text-slate-500">Официальное расписание групп из источника университета.</p>
      <label className="mt-4 block"><span className="sr-only">Поиск группы</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по группе или факультету" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" /></label>
      <button type="button" aria-pressed={favoriteOnly} disabled={!favoriteIds.length && !favoriteOnly} onClick={() => setFavoriteOnly(value => !value)} className={`mt-3 min-h-10 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${favoriteOnly ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:border-amber-200'}`}>☆ Избранные ({favoriteIds.length})</button>
      {catalogError && <div className="mt-4"><RequestState title="Каталог недоступен" description={catalogError} onRetry={() => year ? void loadGroups(year) : window.location.reload()} /></div>}
      {catalogLoading ? <div className="mt-4 space-y-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}</div> : <div className="mt-4 max-h-[62vh] space-y-2 overflow-y-auto pr-1">{visibleGroups.map(group => { const favorite = favoriteIds.includes(group.groupId); const selected = selectedGroupId === group.groupId; return <div key={group.groupId} className={`flex items-center gap-2 rounded-xl border p-2 ${selected ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200'}`}><button type="button" onClick={() => selectGroup(group.groupId)} aria-pressed={selected} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left"><span className="block truncate text-sm font-semibold text-slate-900">{group.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{group.faculty} · {group.course} курс</span></button><button type="button" onClick={() => toggleFavorite(group.groupId)} aria-label={favorite ? `Убрать группу ${group.name} из избранного` : `Добавить группу ${group.name} в избранное`} aria-pressed={favorite} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl ${favorite ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:bg-slate-100 hover:text-amber-600'}`}>{favorite ? '★' : '☆'}</button></div>; })}{!visibleGroups.length && <EmptyState title="Группы не найдены" description={favoriteOnly ? 'Добавьте группы в избранное или отключите фильтр.' : 'Измените запрос поиска.'} />}</div>}
    </section>

    <section className="min-w-0 space-y-5">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{selectedGroup ? `${selectedGroup.name} · ${year}` : 'Выберите учебную группу'}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Расписание</h2><p className="mt-1 text-sm capitalize text-slate-500">{week.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} – {(() => { const last = new Date(week); last.setDate(last.getDate() + 6); return last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); })()}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => changeWeek(-1)} className="h-10 w-10 rounded-lg border border-slate-200 text-lg" aria-label="Предыдущая неделя">‹</button><button type="button" onClick={() => setWeek(startOfWeek(new Date()))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold">Сегодня</button><button type="button" onClick={() => changeWeek(1)} className="h-10 w-10 rounded-lg border border-slate-200 text-lg" aria-label="Следующая неделя">›</button></div></header>
      <label className="block"><span className="sr-only">Поиск по расписанию группы</span><input value={lessonSearch} onChange={event => setLessonSearch(event.target.value)} placeholder="Поиск по предмету, преподавателю или аудитории" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /></label>
      {scheduleSavedAt && <p role="status" className="text-xs font-medium text-amber-700">{scheduleRefreshing ? 'Сохраненная копия · проверяем актуальность' : scheduleError ? 'Офлайн · сохранено' : 'Обновлено'} {new Date(scheduleSavedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</p>}
      {scheduleError && scheduleSavedAt && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Не удалось обновить расписание; показана сохраненная копия. <button type="button" className="font-semibold underline" onClick={() => setScheduleRetry(value => value + 1)}>Повторить</button></div>}
      {scheduleError && !scheduleSavedAt && <RequestState title="Расписание группы недоступно" description={scheduleError} onRetry={() => setScheduleRetry(value => value + 1)} />}
      {!selectedGroup && !catalogLoading && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Выберите группу слева, чтобы открыть её расписание.</div>}
      {scheduleLoading && !scheduleSavedAt && <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40 rounded-2xl" />)}</div>}
      {selectedGroup && (!scheduleLoading || Boolean(scheduleSavedAt)) && (!scheduleError || Boolean(scheduleSavedAt)) && <div className="space-y-4">{days.map((day, index) => { const matching = day.lessons.filter(lesson => !normalizedLessonSearch || `${lesson.subject} ${lesson.teacher || ''} ${lesson.room || ''} ${lesson.subgroup || ''}`.toLocaleLowerCase('ru-RU').includes(normalizedLessonSearch)); const date = new Date(`${day.date}T12:00:00`); return <section key={day.date} className="rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h3 className="font-semibold text-slate-900">{['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][index]}</h3><span className="text-xs text-slate-500">{date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {matching.length} пар</span></div>{matching.length ? <div className="divide-y divide-slate-100">{matching.map(lesson => <article key={lesson.lessonId} className="grid gap-2 px-4 py-4 sm:grid-cols-[90px_minmax(0,1fr)_auto] sm:items-center"><p className="font-mono text-xs font-semibold text-slate-500">{lessonTime(lesson.startTime)}–{lessonTime(lesson.endTime)}</p><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{lesson.subject}{lesson.subgroup ? ` · подгруппа ${lesson.subgroup}` : ''}</p>{lesson.weekType && lesson.weekType !== 'both' && <p className="mt-1 text-[10px] font-medium text-blue-700">{lesson.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}</p>}<p className="mt-1 truncate text-xs text-slate-500">{lesson.teacher || 'Преподаватель не указан'} · {lesson.room ? `ауд. ${lesson.room}` : 'аудитория не указана'}</p></div>{lesson.isReplacement && <span className="w-fit rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Замена</span>}</article>)}</div> : <p className="px-4 py-5 text-sm text-slate-400">{normalizedLessonSearch ? 'Совпадений нет' : 'Занятий нет'}</p>}</section>; })}</div>}
    </section>
  </main>;
}
