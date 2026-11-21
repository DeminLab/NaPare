"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@napare/ui";
import styles from "./schedule.module.css";

type AcademicYear = { value: string; label: string };
type StudyGroup = { groupId: string; name: string; faculty: string; course: number; academicYear: string };
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

const API = "/api/v1/auth";

async function readPublic<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { signal, credentials: "omit", headers: { Accept: "application/json" } });
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

function displayDate(value: string, options: Intl.DateTimeFormatOptions): string {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("ru-RU", options);
}

function friendlySourceError() {
  return "Не удалось получить расписание из открытого источника. Попробуйте ещё раз позже.";
}

export function PublicSchedule() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [year, setYear] = useState("");
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [search, setSearch] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [yearLoading, setYearLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [yearError, setYearError] = useState(false);
  const [groupsError, setGroupsError] = useState(false);
  const [lessonsError, setLessonsError] = useState(false);
  const [yearsRetry, setYearsRetry] = useState(0);
  const [groupsRetry, setGroupsRetry] = useState(0);
  const [lessonsRetry, setLessonsRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setYearLoading(true);
    setYearError(false);
    void readPublic<AcademicYear[]>("/rasp-years", controller.signal)
      .then((result) => {
        setYears(result);
        setYear((current) => result.some((item) => item.value === current) ? current : result.at(-1)?.value || "");
      })
      .catch(() => { if (!controller.signal.aborted) setYearError(true); })
      .finally(() => { if (!controller.signal.aborted) setYearLoading(false); });
    return () => controller.abort();
  }, [yearsRetry]);

  useEffect(() => {
    if (!year) { setGroups([]); setGroupId(""); return; }
    const controller = new AbortController();
    setGroupsLoading(true);
    setGroupsError(false);
    void readPublic<StudyGroup[]>(`/rasp-groups?year=${encodeURIComponent(year)}`, controller.signal)
      .then((result) => {
        setGroups(result);
        setGroupId((current) => result.some((group) => group.groupId === current) ? current : "");
      })
      .catch(() => { if (!controller.signal.aborted) { setGroups([]); setGroupsError(true); } })
      .finally(() => { if (!controller.signal.aborted) setGroupsLoading(false); });
    return () => controller.abort();
  }, [year, groupsRetry]);

  useEffect(() => {
    if (!year || !groupId) { setLessons([]); return; }
    const controller = new AbortController();
    setLessonsLoading(true);
    setLessonsError(false);
    void readPublic<Lesson[]>(`/rasp-schedule?groupId=${encodeURIComponent(groupId)}&year=${encodeURIComponent(year)}`, controller.signal)
      .then((result) => setLessons(result))
      .catch(() => { if (!controller.signal.aborted) { setLessons([]); setLessonsError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLessonsLoading(false); });
    return () => controller.abort();
  }, [year, groupId, lessonsRetry]);

  const filteredGroups = useMemo(() => {
    const query = groupQuery.trim().toLocaleLowerCase("ru-RU");
    return groups.filter((group) => !query || `${group.name} ${group.faculty} ${group.course}`.toLocaleLowerCase("ru-RU").includes(query));
  }, [groups, groupQuery]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(week);
    date.setDate(week.getDate() + index);
    return date;
  }), [week]);

  const lessonsByDay = useMemo(() => {
    const from = dateKey(weekDates[0]);
    const to = dateKey(weekDates[6]);
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return weekDates.map((date) => {
      const key = dateKey(date);
      const dayLessons = lessons
        .filter((lesson) => lesson.date === key && (!query || `${lesson.subject} ${lesson.teacher || ""} ${lesson.room || ""}`.toLocaleLowerCase("ru-RU").includes(query)))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      return { date: key, label: date.toLocaleDateString("ru-RU", { weekday: "long" }), short: date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }), lessons: dayLessons };
    }).filter((day) => day.date >= from && day.date <= to);
  }, [lessons, search, weekDates]);

  const selectedGroup = groups.find((group) => group.groupId === groupId);
  const rangeLabel = `${weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — ${weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;

  return (
    <div className="public-schedule-browser">
      <aside className="schedule-picker">
        <div className="schedule-picker-heading">
          <span className="schedule-picker-symbol" aria-hidden="true"><Icon name="layers" size={24} /></span>
          <div><h2>Найдите свою группу</h2><p>Открытый каталог СИБИТа</p></div>
        </div>
        <label className="schedule-field">
          <span>Учебный год</span>
          <select value={year} disabled={yearLoading || yearError || years.length === 0} onChange={(event) => { setGroupId(""); setLessons([]); setYear(event.target.value); }}>
            {yearLoading && <option value="">Загружаем…</option>}
            {yearError && <option value="">Источник недоступен</option>}
            {!yearLoading && !yearError && years.length === 0 && <option value="">Нет учебных лет</option>}
            {years.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="schedule-field">
          <span>Группа или факультет</span>
          <input value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="Например, ИВТ" disabled={!groups.length} />
        </label>
        {groupsLoading && <p className="schedule-state" role="status">Загружаем список групп…</p>}
        {yearError && <div className="schedule-error" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => setYearsRetry((value) => value + 1)}>Повторить</button></div>}
        {groupsError && !yearError && <div className="schedule-error" role="alert"><p>{friendlySourceError()}</p><button type="button" onClick={() => setGroupsRetry((value) => value + 1)}>Повторить</button></div>}
        {!groupsLoading && !groupsError && groups.length > 0 && <p className="schedule-result-count">Найдено групп: {filteredGroups.length}</p>}
        {!groupsLoading && !groupsError && groups.length > 0 && <div className="schedule-group-list" aria-label="Группы СИБИТа">
          {filteredGroups.map((group) => (
            <button key={group.groupId} type="button" aria-pressed={groupId === group.groupId} className={groupId === group.groupId ? "schedule-group-option is-selected" : "schedule-group-option"} onClick={() => { setLessons([]); setLessonsLoading(true); setLessonsError(false); setGroupId(group.groupId); }}>
              <strong>{group.name}</strong><span>{group.faculty} · {group.course} курс</span>
            </button>
          ))}
          {filteredGroups.length === 0 && <p className="schedule-list-empty">По этому запросу групп не найдено.</p>}
        </div>}
        {!yearLoading && !yearError && !groupsLoading && groups.length === 0 && !groupsError && <p className="schedule-state">В выбранном учебном году пока нет опубликованных групп.</p>}
        <a className="schedule-source-link" href="https://rasp.sano.ru/WebApp/#/Rasp/List" target="_blank" rel="noreferrer">Открыть источник СИБИТа <Icon name="arrow-right" size={15} /></a>
      </aside>

      <section className="schedule-results" aria-labelledby="public-schedule-title">
        <header className="schedule-results-heading">
          <div><p className="eyebrow">Расписание группы</p><h2 id="public-schedule-title" tabIndex={-1}>{selectedGroup?.name || "Выберите группу"}</h2><p>{selectedGroup ? `${selectedGroup.faculty} · ${year}` : "Занятия выбранной группы появятся здесь"}</p></div>
          <div className="schedule-week-controls" aria-label="Выбор недели">
            <button type="button" aria-label="Предыдущая неделя" onClick={() => setWeek((current) => moveWeek(current, -1))}><Icon name="chevron-left" size={17} /></button>
            <span><Icon name="calendar" size={15} />{rangeLabel}</span>
            <button type="button" aria-label="Следующая неделя" onClick={() => setWeek((current) => moveWeek(current, 1))}><Icon name="chevron-right" size={17} /></button>
            <button type="button" className="schedule-today-button" onClick={() => setWeek(mondayOf(new Date()))}>Сегодня</button>
          </div>
        </header>
        <label className={`schedule-search ${styles.searchField}`}><span className="sr-only">Поиск по занятиям</span><span className={styles.searchIcon} aria-hidden="true"><Icon name="search" size={21} /></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Предмет, преподаватель или аудитория" disabled={!selectedGroup} /></label>
        {!selectedGroup && <div className="schedule-empty-prompt"><span aria-hidden="true"><Icon name="calendar" size={25} /></span><strong>Начните с выбора группы</strong><p>Найдите её в каталоге слева — покажем занятия на выбранную неделю.</p></div>}
        {lessonsLoading && selectedGroup && <p className="schedule-state schedule-loading" role="status" aria-busy="true">Получаем расписание выбранной группы…</p>}
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
          {!lessons.length && <p className="schedule-state schedule-no-data">Источник пока не опубликовал занятия для этой группы.</p>}
        </>}
        <p className="schedule-privacy-note">Публичная версия содержит только сведения об учебных занятиях из открытого источника. Персональные данные и материалы кабинета здесь не показываются.</p>
      </section>
    </div>
  );
}
