"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, LessonTypeBadge, lessonTypeKey } from "@napare/ui";
import styles from "./schedule.module.css";

type University = { id: string; name: string; city: string };
type StudyGroup = { id: string; name: string; faculty?: string | null };
type Lesson = {
  lessonId: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  pairNumber: number;
  subject: string;
  subjectType?: string;
  teacher?: string;
  room?: string;
  groupName?: string;
  weekType: "odd" | "even" | "both";
  isReplacement: boolean;
};

const API = "/api/v1/public/schedule";

async function readPublic<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    signal,
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("schedule-source-unavailable");
  return response.json() as Promise<T>;
}

function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - weekday);
  return monday;
}

function moveWeek(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount * 7);
  return next;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function friendlySourceError() {
  return "Не удалось получить опубликованное расписание. Попробуйте ещё раз.";
}

export function PublicSchedule() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [browseMode, setBrowseMode] = useState<"group" | "teacher" | "room">("group");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [publicSearchLessons, setPublicSearchLessons] = useState<Lesson[]>([]);
  const [browseQuery, setBrowseQuery] = useState("");
  const [search, setSearch] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [universitiesLoading, setUniversitiesLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [publicSearchLoading, setPublicSearchLoading] = useState(false);
  const [universitiesError, setUniversitiesError] = useState(false);
  const [groupsError, setGroupsError] = useState(false);
  const [lessonsError, setLessonsError] = useState(false);
  const [publicSearchError, setPublicSearchError] = useState(false);
  const [universitiesRetry, setUniversitiesRetry] = useState(0);
  const [groupsRetry, setGroupsRetry] = useState(0);
  const [lessonsRetry, setLessonsRetry] = useState(0);
  const [publicSearchRetry, setPublicSearchRetry] = useState(0);

  useEffect(() => {
    const openFiltersFromHash = () => {
      if (window.location.hash === "#public-schedule-filters") setFiltersOpen(true);
    };
    openFiltersFromHash();
    window.addEventListener("hashchange", openFiltersFromHash);
    return () => window.removeEventListener("hashchange", openFiltersFromHash);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setUniversitiesLoading(true);
    setUniversitiesError(false);
    void readPublic<University[]>("/universities", controller.signal)
      .then((result) => {
        setUniversities(result);
        setUniversityId((current) => result.some((item) => item.id === current) ? current : result[0]?.id || "");
      })
      .catch(() => { if (!controller.signal.aborted) setUniversitiesError(true); })
      .finally(() => { if (!controller.signal.aborted) setUniversitiesLoading(false); });
    return () => controller.abort();
  }, [universitiesRetry]);

  useEffect(() => {
    if (!universityId) { setGroups([]); setGroupId(""); return; }
    const controller = new AbortController();
    setGroupsLoading(true);
    setGroupsError(false);
    setGroups([]);
    setGroupId("");
    setLessons([]);
    void readPublic<StudyGroup[]>(`/universities/${encodeURIComponent(universityId)}/groups`, controller.signal)
      .then((result) => setGroups(result))
      .catch(() => { if (!controller.signal.aborted) { setGroups([]); setGroupsError(true); } })
      .finally(() => { if (!controller.signal.aborted) setGroupsLoading(false); });
    return () => controller.abort();
  }, [universityId, groupsRetry]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(week);
    date.setDate(week.getDate() + index);
    return date;
  }), [week]);

  useEffect(() => {
    if (!universityId || !groupId || browseMode !== "group") { setLessons([]); return; }
    const controller = new AbortController();
    const query = new URLSearchParams({
      organizationId: universityId,
      groupId,
      from: dateKey(weekDates[0]),
      to: dateKey(weekDates[6]),
    });
    setLessonsLoading(true);
    setLessonsError(false);
    setLessons([]);
    void readPublic<Lesson[]>(`/lessons?${query.toString()}`, controller.signal)
      .then((result) => setLessons(result))
      .catch(() => { if (!controller.signal.aborted) setLessonsError(true); })
      .finally(() => { if (!controller.signal.aborted) setLessonsLoading(false); });
    return () => controller.abort();
  }, [universityId, groupId, weekDates, lessonsRetry, browseMode]);

  useEffect(() => {
    const queryValue = browseQuery.trim();
    if (!universityId || browseMode === "group" || queryValue.length < 2) {
      setPublicSearchLessons([]);
      setPublicSearchLoading(false);
      setPublicSearchError(false);
      return;
    }
    setPublicSearchLessons([]);
    setPublicSearchLoading(true);
    setPublicSearchError(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        organizationId: universityId,
        mode: browseMode,
        query: queryValue,
        from: dateKey(weekDates[0]),
        to: dateKey(weekDates[6]),
      });
      void readPublic<Lesson[]>(`/search?${query.toString()}`, controller.signal)
        .then((result) => setPublicSearchLessons(result))
        .catch(() => { if (!controller.signal.aborted) setPublicSearchError(true); })
        .finally(() => { if (!controller.signal.aborted) setPublicSearchLoading(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [universityId, browseMode, browseQuery, weekDates, publicSearchRetry]);

  const filteredGroups = useMemo(() => {
    const query = groupQuery.trim().toLocaleLowerCase("ru-RU");
    return groups.filter((group) => !query || `${group.name} ${group.faculty || ""}`.toLocaleLowerCase("ru-RU").includes(query));
  }, [groups, groupQuery]);

  const lessonsByDay = useMemo(() => {
    const query = browseMode === "group" ? search.trim().toLocaleLowerCase("ru-RU") : "";
    const visibleLessons = browseMode === "group" ? lessons : publicSearchLessons;
    return weekDates.map((date) => {
      const key = dateKey(date);
      const dayLessons = visibleLessons
        .filter((lesson) => lesson.date.slice(0, 10) === key && (!query || `${lesson.subject} ${lesson.teacher || ""} ${lesson.room || ""}`.toLocaleLowerCase("ru-RU").includes(query)))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      return { date: key, label: date.toLocaleDateString("ru-RU", { weekday: "long" }), short: date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }), lessons: dayLessons };
    });
  }, [browseMode, lessons, publicSearchLessons, search, weekDates]);

  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedUniversity = universities.find((university) => university.id === universityId);
  const searchReady = browseMode === "group" || browseQuery.trim().length >= 2;
  const activeLoading = browseMode === "group" ? lessonsLoading : publicSearchLoading;
  const activeError = browseMode === "group" ? lessonsError : publicSearchError;
  const hasActiveSchedule = browseMode === "group" ? Boolean(selectedGroup) : searchReady;
  const summaryReady = hasActiveSchedule && !activeLoading && !activeError;
  const activeScheduleTitle = browseMode === "group"
    ? selectedGroup?.name || "Выберите группу"
    : browseMode === "teacher"
      ? (browseQuery.trim() ? `Преподаватель: ${browseQuery.trim()}` : "Найдите преподавателя")
      : (browseQuery.trim() ? `Аудитория: ${browseQuery.trim()}` : "Найдите аудиторию");
  const visibleLessonCount = lessonsByDay.reduce((count, day) => count + day.lessons.length, 0);
  const rangeLabel = `${weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — ${weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;

  return (
    <div className={`public-schedule-browser ${styles.scheduleBrowser}`}>
      <button id="schedule-filter-toggle" type="button" className="schedule-filter-toggle" aria-expanded={filtersOpen} aria-controls="public-schedule-filters" onClick={() => setFiltersOpen((open) => !open)}>
        <Icon name="settings" size={18} />
        <span>Фильтры</span>
        {browseMode !== "group" && browseQuery.trim() && <span className="schedule-filter-summary">{browseMode === "teacher" ? "Преподаватель" : "Аудитория"}</span>}
      </button>
      <aside id="public-schedule-filters" className={`schedule-picker${filtersOpen ? " is-open" : ""}`}>
        <div className="schedule-picker-heading">
          <span className="schedule-picker-symbol" aria-hidden="true"><Icon name="layers" size={24} /></span>
          <div><h2>Расписание вузов</h2><p>Публикации из кабинетов университетов</p></div>
        </div>
        <label className="schedule-field">
          <span>Университет</span>
          <select
            value={universityId}
            disabled={universitiesLoading || universitiesError || universities.length === 0}
            onChange={(event) => { setGroupId(""); setLessons([]); setGroupQuery(""); setUniversityId(event.target.value); }}
          >
            {universitiesLoading && <option value="">Загружаем…</option>}
            {universitiesError && <option value="">Список недоступен</option>}
            {!universitiesLoading && !universitiesError && universities.length === 0 && <option value="">Пока нет опубликованных вузов</option>}
            {universities.map((university) => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}
          </select>
        </label>
        <label className="schedule-field">
          <span>Искать по</span>
          <select value={browseMode} onChange={(event) => { setBrowseMode(event.target.value as "group" | "teacher" | "room"); setBrowseQuery(""); setSearch(""); }}>
            <option value="group">Учебной группе</option>
            <option value="teacher">Преподавателю</option>
            <option value="room">Аудитории</option>
          </select>
        </label>
        {universitiesError && <div className="schedule-error" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => setUniversitiesRetry((value) => value + 1)}>Повторить</button></div>}
        {!universitiesLoading && !universitiesError && universities.length === 0 && <p className="schedule-state">Вузы пока не включили публичную публикацию расписания.</p>}
        {selectedUniversity && browseMode === "group" && <>
          <label className="schedule-field">
            <span>Группа или факультет</span>
            <input value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="Например, ИН-25" disabled={!groups.length} />
          </label>
          {groupsLoading && <p className="schedule-state" role="status">Загружаем группы из кабинета…</p>}
          {groupsError && <div className="schedule-error" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => setGroupsRetry((value) => value + 1)}>Повторить</button></div>}
          {!groupsLoading && !groupsError && groups.length > 0 && <p className="schedule-result-count">Найдено групп: {filteredGroups.length}</p>}
          {!groupsLoading && !groupsError && groups.length > 0 && <div className="schedule-group-list" aria-label={`Группы вуза ${selectedUniversity.name}`}>
            {filteredGroups.map((group) => (
              <button key={group.id} type="button" aria-pressed={groupId === group.id} className={groupId === group.id ? "schedule-group-option is-selected" : "schedule-group-option"} onClick={() => { setLessons([]); setLessonsLoading(true); setLessonsError(false); setGroupId(group.id); setFiltersOpen(false); }}>
                <strong>{group.name}</strong><span>{group.faculty || selectedUniversity.city}</span>
              </button>
            ))}
            {filteredGroups.length === 0 && <p className="schedule-list-empty">По этому запросу групп не найдено.</p>}
          </div>}
          {!groupsLoading && !groupsError && groups.length === 0 && <p className="schedule-state">У этого вуза пока нет опубликованных групп.</p>}
        </>}
        {selectedUniversity && browseMode !== "group" && <>
          <label className="schedule-field">
            <span>{browseMode === "teacher" ? "Фамилия или имя преподавателя" : "Номер аудитории"}</span>
            <input value={browseQuery} onChange={(event) => setBrowseQuery(event.target.value)} placeholder={browseMode === "teacher" ? "Например, Иванова" : "Например, 204"} />
          </label>
          <p className="schedule-state">Введите от двух символов — покажем пары за выбранную неделю и связанные группы.</p>
        </>}
      </aside>

      <section className="schedule-results" aria-labelledby="public-schedule-title">
        <header className="schedule-results-heading">
          <div><p className="eyebrow">{selectedUniversity?.name || "Открытая публикация"}</p><h2 id="public-schedule-title" tabIndex={-1}>{activeScheduleTitle}</h2><p>{browseMode === "group" ? (selectedGroup ? `${selectedGroup.faculty ? `${selectedGroup.faculty} · ` : ""}${selectedUniversity?.city || ""}` : "Показываем расписание, опубликованное вузами в кабинетах") : `${browseMode === "teacher" ? "Занятия преподавателя" : "Занятия в аудитории"} · ${selectedUniversity?.city || ""}`}</p></div>
          <div className="schedule-week-controls" aria-label="Выбор недели">
            <button type="button" aria-label="Предыдущая неделя" onClick={() => setWeek((current) => moveWeek(current, -1))}><Icon name="chevron-left" size={17} /></button>
            <span><Icon name="calendar" size={15} />{rangeLabel}</span>
            <button type="button" aria-label="Следующая неделя" onClick={() => setWeek((current) => moveWeek(current, 1))}><Icon name="chevron-right" size={17} /></button>
            <button type="button" className="schedule-today-button" onClick={() => setWeek(mondayOf(new Date()))}>Сегодня</button>
          </div>
        </header>
        {hasActiveSchedule && <nav className={styles.weekStrip} aria-label="Дни выбранной недели">
          {weekDates.map((date, index) => {
            const day = lessonsByDay[index];
            const currentDay = dateKey(new Date()) === day.date;
            return <button key={day.date} type="button" className={currentDay ? styles.weekDayCurrent : ""} aria-label={`${day.label}, ${day.short}, занятий: ${day.lessons.length}`} onClick={() => document.getElementById(`schedule-day-${day.date}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <span>{date.toLocaleDateString("ru-RU", { weekday: "short" })}</span><strong>{date.getDate()}</strong><small>{day.lessons.length > 0 ? day.lessons.length : "—"}</small>
            </button>;
          })}
        </nav>}
        {!hasActiveSchedule && <div className="schedule-empty-prompt"><span aria-hidden="true"><Icon name="calendar" size={25} /></span><strong>{browseMode === "group" ? (universities.length ? "Выберите вуз и группу" : "Публичных расписаний пока нет") : "Введите запрос в фильтрах"}</strong><p>{browseMode === "group" ? (universities.length ? "Выберите университет, затем найдите группу из опубликованной структуры." : "Университеты появятся здесь после включения публикации в их кабинетах.") : "Укажите не менее двух символов имени преподавателя или номера аудитории."}</p></div>}
        {activeLoading && hasActiveSchedule && <p className="schedule-state schedule-loading" role="status" aria-busy="true">Загружаем опубликованное расписание…</p>}
        {activeError && hasActiveSchedule && <div className="schedule-error schedule-error-main" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => browseMode === "group" ? setLessonsRetry((value) => value + 1) : setPublicSearchRetry((value) => value + 1)}>Загрузить ещё раз</button></div>}
        {hasActiveSchedule && !activeLoading && !activeError && <>
          {browseMode === "group" && <label id="schedule-search" className={`schedule-search ${styles.searchField}`}><span className="ds-sr-only">Поиск по занятиям выбранной группы</span><span className={styles.searchIcon} aria-hidden="true"><Icon name="search" size={21} /></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Предмет, преподаватель или аудитория" disabled={!selectedGroup} /></label>}
          {visibleLessonCount > 0 && <div className={styles.lessonTypeLegend} role="group" aria-label="Цвета типов занятий">
            <span className={styles.lessonTypeLegendLabel}>Тип занятия</span>
            <LessonTypeBadge subjectType="lecture" />
            <LessonTypeBadge subjectType="practice" />
            <LessonTypeBadge subjectType="lab" />
          </div>}
          <div className="schedule-day-list">
            {lessonsByDay.map((day) => (
              <section key={day.date} id={`schedule-day-${day.date}`} className="schedule-day">
                <header><h3>{day.label}</h3><span>{day.short}</span><b>{day.lessons.length} {day.lessons.length === 1 ? "пара" : day.lessons.length > 1 && day.lessons.length < 5 ? "пары" : "пар"}</b></header>
                {day.lessons.length > 0 ? <div className="schedule-lesson-list">
                  {day.lessons.map((lesson) => (
                    <article key={lesson.lessonId} className={lesson.isReplacement ? "schedule-lesson is-replacement" : "schedule-lesson"} data-lesson-type={lessonTypeKey(lesson.subjectType)}>
                      <time>{lesson.startTime}<span>–{lesson.endTime}</span></time>
                      <div><h4>{lesson.subject}</h4>{lesson.subjectType && <div className={styles.lessonTypeTag}><LessonTypeBadge subjectType={lesson.subjectType} /></div>}<p>{lesson.teacher || "Преподаватель не указан"} <span aria-hidden="true">·</span> {lesson.room ? `ауд. ${lesson.room}` : "аудитория не указана"}{lesson.groupName && <> <span aria-hidden="true">·</span> группа {lesson.groupName}</>}</p>{lesson.weekType !== "both" && <small>{lesson.weekType === "odd" ? "Нечётная неделя" : "Чётная неделя"}</small>}</div>
                      {lesson.isReplacement && <span className="lesson-replacement-badge">Замена</span>}
                    </article>
                  ))}
                </div> : <p className="schedule-no-lessons">{search ? "Нет занятий по вашему запросу." : "Занятий нет"}</p>}
              </section>
            ))}
          </div>
          {!visibleLessonCount && <p className="schedule-state schedule-no-data">{browseMode !== "group" && browseQuery.trim().length < 2 ? "Введите не менее двух символов для поиска." : "В выбранной неделе нет занятий по этому запросу."}</p>}
        </>}
        <p className="schedule-privacy-note">Публично показываются только расписания, которые вузы включили для публикации. Персональные данные и материалы кабинетов не выводятся.</p>
      </section>
      <aside className={styles.scheduleRail} aria-label="О выбранной неделе">
        <section className={styles.railCard}>
          <div className={styles.railHeading}><span><Icon name="calendar" size={18} /></span><div><h2>Обзор недели</h2><p>{rangeLabel}</p></div></div>
          {summaryReady ? <>
            <p className={styles.railMetric}>{visibleLessonCount} <span>{visibleLessonCount === 1 ? "занятие" : visibleLessonCount > 1 && visibleLessonCount < 5 ? "занятия" : "занятий"}</span></p>
            <div className={styles.railProgress} aria-hidden="true"><span style={{ width: `${Math.min(100, visibleLessonCount * 12)}%` }} /></div>
            <p className={styles.railCaption}>{selectedGroup ? `в расписании группы ${selectedGroup.name}` : browseMode === "teacher" ? `в расписании преподавателя ${browseQuery.trim()}` : `в аудитории ${browseQuery.trim()}`}</p>
          </> : <p className={styles.railBody}>{activeLoading ? "Загружаем расписание за выбранную неделю…" : activeError ? "Не удалось загрузить расписание. Попробуйте ещё раз." : browseMode === "group" ? "Выберите опубликованную группу — здесь появится число занятий за выбранную неделю." : "Введите имя преподавателя или номер аудитории, чтобы увидеть сводку."}</p>}
        </section>
        <section className={styles.railCard}>
          <div className={styles.railHeading}><span><Icon name="search" size={18} /></span><div><h2>Как искать</h2><p>Открытый доступ</p></div></div>
          <ul className={styles.railList}><li>Выберите вуз и учебную группу</li><li>Ищите по предмету, преподавателю или аудитории</li><li>Листайте недели и выбирайте нужный день</li></ul>
        </section>
        <section className={`${styles.railCard} ${styles.railNotice}`}>
          <div className={styles.railHeading}><span><Icon name="info" size={18} /></span><div><h2>Публикация</h2><p>Данные задаёт университет</p></div></div>
          <p className={styles.railBody}>Показываются только занятия из расписаний, которые вуз включил для публичного просмотра.</p>
          <a href="/universities">Для университетов <Icon name="arrow-right" size={15} /></a>
        </section>
      </aside>
    </div>
  );
}
