"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@napare/ui";
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
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [search, setSearch] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [universitiesLoading, setUniversitiesLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [universitiesError, setUniversitiesError] = useState(false);
  const [groupsError, setGroupsError] = useState(false);
  const [lessonsError, setLessonsError] = useState(false);
  const [universitiesRetry, setUniversitiesRetry] = useState(0);
  const [groupsRetry, setGroupsRetry] = useState(0);
  const [lessonsRetry, setLessonsRetry] = useState(0);

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
    if (!universityId || !groupId) { setLessons([]); return; }
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
  }, [universityId, groupId, weekDates, lessonsRetry]);

  const filteredGroups = useMemo(() => {
    const query = groupQuery.trim().toLocaleLowerCase("ru-RU");
    return groups.filter((group) => !query || `${group.name} ${group.faculty || ""}`.toLocaleLowerCase("ru-RU").includes(query));
  }, [groups, groupQuery]);

  const lessonsByDay = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return weekDates.map((date) => {
      const key = dateKey(date);
      const dayLessons = lessons
        .filter((lesson) => lesson.date.slice(0, 10) === key && (!query || `${lesson.subject} ${lesson.teacher || ""} ${lesson.room || ""}`.toLocaleLowerCase("ru-RU").includes(query)))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      return { date: key, label: date.toLocaleDateString("ru-RU", { weekday: "long" }), short: date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }), lessons: dayLessons };
    });
  }, [lessons, search, weekDates]);

  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedUniversity = universities.find((university) => university.id === universityId);
  const rangeLabel = `${weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — ${weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;

  return (
    <div className="public-schedule-browser">
      <aside className="schedule-picker">
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
        {universitiesError && <div className="schedule-error" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => setUniversitiesRetry((value) => value + 1)}>Повторить</button></div>}
        {!universitiesLoading && !universitiesError && universities.length === 0 && <p className="schedule-state">Вузы пока не включили публичную публикацию расписания.</p>}
        {selectedUniversity && <>
          <label className="schedule-field">
            <span>Группа или факультет</span>
            <input value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="Например, ИН-25" disabled={!groups.length} />
          </label>
          {groupsLoading && <p className="schedule-state" role="status">Загружаем группы из кабинета…</p>}
          {groupsError && <div className="schedule-error" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => setGroupsRetry((value) => value + 1)}>Повторить</button></div>}
          {!groupsLoading && !groupsError && groups.length > 0 && <p className="schedule-result-count">Найдено групп: {filteredGroups.length}</p>}
          {!groupsLoading && !groupsError && groups.length > 0 && <div className="schedule-group-list" aria-label={`Группы вуза ${selectedUniversity.name}`}>
            {filteredGroups.map((group) => (
              <button key={group.id} type="button" aria-pressed={groupId === group.id} className={groupId === group.id ? "schedule-group-option is-selected" : "schedule-group-option"} onClick={() => { setLessons([]); setLessonsLoading(true); setLessonsError(false); setGroupId(group.id); }}>
                <strong>{group.name}</strong><span>{group.faculty || selectedUniversity.city}</span>
              </button>
            ))}
            {filteredGroups.length === 0 && <p className="schedule-list-empty">По этому запросу групп не найдено.</p>}
          </div>}
          {!groupsLoading && !groupsError && groups.length === 0 && <p className="schedule-state">У этого вуза пока нет опубликованных групп.</p>}
        </>}
      </aside>

      <section className="schedule-results" aria-labelledby="public-schedule-title">
        <header className="schedule-results-heading">
          <div><p className="eyebrow">{selectedUniversity?.name || "Открытая публикация"}</p><h2 id="public-schedule-title" tabIndex={-1}>{selectedGroup?.name || "Выберите группу"}</h2><p>{selectedGroup ? `${selectedGroup.faculty ? `${selectedGroup.faculty} · ` : ""}${selectedUniversity?.city || ""}` : "Показываем расписание, опубликованное вузами в кабинетах"}</p></div>
          <div className="schedule-week-controls" aria-label="Выбор недели">
            <button type="button" aria-label="Предыдущая неделя" onClick={() => setWeek((current) => moveWeek(current, -1))}><Icon name="chevron-left" size={17} /></button>
            <span><Icon name="calendar" size={15} />{rangeLabel}</span>
            <button type="button" aria-label="Следующая неделя" onClick={() => setWeek((current) => moveWeek(current, 1))}><Icon name="chevron-right" size={17} /></button>
            <button type="button" className="schedule-today-button" onClick={() => setWeek(mondayOf(new Date()))}>Сегодня</button>
          </div>
        </header>
        <label className={`schedule-search ${styles.searchField}`}><span className="sr-only">Поиск по занятиям</span><span className={styles.searchIcon} aria-hidden="true"><Icon name="search" size={21} /></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Предмет, преподаватель или аудитория" disabled={!selectedGroup} /></label>
        {!selectedGroup && <div className="schedule-empty-prompt"><span aria-hidden="true"><Icon name="calendar" size={25} /></span><strong>{universities.length ? "Выберите вуз и группу" : "Публичных расписаний пока нет"}</strong><p>{universities.length ? "Выберите университет, затем найдите группу из опубликованной структуры." : "Университеты появятся здесь после включения публикации в их кабинетах."}</p></div>}
        {lessonsLoading && selectedGroup && <p className="schedule-state schedule-loading" role="status" aria-busy="true">Загружаем опубликованное расписание…</p>}
        {lessonsError && selectedGroup && <div className="schedule-error schedule-error-main" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => setLessonsRetry((value) => value + 1)}>Загрузить ещё раз</button></div>}
        {selectedGroup && !lessonsLoading && !lessonsError && <>
          <div className="schedule-day-list">
            {lessonsByDay.map((day) => (
              <section key={day.date} className="schedule-day">
                <header><h3>{day.label}</h3><span>{day.short}</span><b>{day.lessons.length} {day.lessons.length === 1 ? "пара" : day.lessons.length > 1 && day.lessons.length < 5 ? "пары" : "пар"}</b></header>
                {day.lessons.length > 0 ? <div className="schedule-lesson-list">
                  {day.lessons.map((lesson) => (
                    <article key={lesson.lessonId} className={lesson.isReplacement ? "schedule-lesson is-replacement" : "schedule-lesson"}>
                      <time>{lesson.startTime}<span>–{lesson.endTime}</span></time>
                      <div><h4>{lesson.subject}</h4><p>{lesson.teacher || "Преподаватель не указан"} <span aria-hidden="true">·</span> {lesson.room ? `ауд. ${lesson.room}` : "аудитория не указана"}</p>{lesson.weekType !== "both" && <small>{lesson.weekType === "odd" ? "Нечётная неделя" : "Чётная неделя"}</small>}</div>
                      {lesson.isReplacement && <span className="lesson-replacement-badge">Замена</span>}
                    </article>
                  ))}
                </div> : <p className="schedule-no-lessons">{search ? "Нет занятий по вашему запросу." : "Занятий нет"}</p>}
              </section>
            ))}
          </div>
          {!lessons.length && <p className="schedule-state schedule-no-data">В выбранной неделе нет опубликованных занятий.</p>}
        </>}
        <p className="schedule-privacy-note">Публично показываются только расписания, которые вузы включили для публикации. Персональные данные и материалы кабинетов не выводятся.</p>
      </section>
    </div>
  );
}
