import { FormEvent, useEffect, useState } from "react";
import { getInitData, initializeMax } from "./lib/max-bridge";
import {
  ApiError,
  AuthUser,
  Lesson,
  MyDayResponse,
  NotificationItem,
  PairSpace,
  ProfileUser,
  createAbsence,
  canLinkAbsenceToLesson,
  getMyDay,
  getNotifications,
  getPairSpace,
  getProfile,
  getWeekSchedule,
  isAuthenticated,
  loginWithMax,
  loginWithPassword,
  logout,
} from "./lib/api";

type Tab = "today" | "schedule" | "lessons" | "notifications" | "profile";
type Phase = "boot" | "login" | "ready";

const navigation: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "today", icon: "⌂", label: "Сегодня" },
  { id: "schedule", icon: "□", label: "Расписание" },
  { id: "lessons", icon: "♧", label: "Пары" },
  { id: "notifications", icon: "◌", label: "Уведомления" },
  { id: "profile", icon: "♙", label: "Профиль" },
];

const ROLE_LABELS: Record<string, string> = {
  student: "Студент",
  teacher: "Преподаватель",
  curator: "Куратор",
  faculty_dean: "Деканат",
  department_head: "Заведующий кафедрой",
  university_admin: "Администратор вуза",
  superadmin: "Суперадмин",
  developer: "Разработчик",
};

const WEEKDAYS_FULL = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];
const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function localDateKey(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function formatDayHeading(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}, ${WEEKDAYS_FULL[date.getDay()]}`;
}

function formatShortDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_GENITIVE[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} — ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "меньше минуты";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function initialsOf(user: AuthUser | null): string {
  if (!user) return "·";
  return (
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?"
  );
}

interface UpcomingLesson {
  lesson: Lesson;
  startsInMinutes: number;
  ongoing: boolean;
}

function findUpcomingLesson(lessons: Lesson[]): UpcomingLesson | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best: UpcomingLesson | null = null;
  let bestStart = Number.POSITIVE_INFINITY;

  for (const lesson of lessons) {
    const start = parseTimeToMinutes(lesson.startTime);
    const end = parseTimeToMinutes(lesson.endTime);
    if (start === null || end === null || end <= nowMinutes) continue;
    if (start < bestStart) {
      bestStart = start;
      best = {
        lesson,
        startsInMinutes: start - nowMinutes,
        ongoing: start <= nowMinutes,
      };
    }
  }
  return best;
}

export function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [tab, setTab] = useState<Tab>("today");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [insideMax, setInsideMax] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [myDay, setMyDay] = useState<MyDayResponse | null>(null);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [weekLessons, setWeekLessons] = useState<Lesson[] | null>(null);
  const [weekError, setWeekError] = useState<string | null>(null);

  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [pairSpace, setPairSpace] = useState<PairSpace | null>(null);
  const [spaceLoading, setSpaceLoading] = useState(false);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  const [inbox, setInbox] = useState<NotificationItem[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceLessonId, setAbsenceLessonId] = useState<string | null>(null);
  const [absenceSent, setAbsenceSent] = useState(false);
  const [absenceBusy, setAbsenceBusy] = useState(false);
  const [absenceError, setAbsenceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const app = await initializeMax();
      if (!cancelled) setInsideMax(Boolean(app));

      try {
        if (isAuthenticated()) {
          const profileData = await getProfile();
          if (cancelled) return;
          setUser(profileData);
          setPhase("ready");
          return;
        }
        const initData = getInitData();
        if (initData) {
          const auth = await loginWithMax(initData);
          if (cancelled) return;
          setUser(auth.user);
          setPhase("ready");
          return;
        }
        if (!cancelled) setPhase("login");
      } catch (error) {
        if (cancelled) return;
        setPhase("login");
        if (
          error instanceof ApiError &&
          !error.code.startsWith("MAX_") &&
          error.status === 401
        ) {
          setBootError(null);
        } else {
          setBootError(
            errorMessage(error, "Не удалось войти. Проверьте соединение."),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready" || tab !== "today") return;
    let cancelled = false;
    setTodayError(null);
    getMyDay()
      .then((data) => {
        if (!cancelled) setMyDay(data);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setTodayError(
            errorMessage(error, "Не удалось загрузить сегодняшний день"),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [phase, tab, refreshKey]);

  useEffect(() => {
    if (phase !== "ready" || (tab !== "schedule" && tab !== "lessons")) return;
    let cancelled = false;
    setWeekError(null);
    getWeekSchedule(toDateInput(weekStart), toDateInput(addDays(weekStart, 6)))
      .then((response) => {
        if (!cancelled) setWeekLessons(response.data);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setWeekError(errorMessage(error, "Не удалось загрузить расписание"));
      });
    return () => {
      cancelled = true;
    };
  }, [phase, tab, weekStart, refreshKey]);

  useEffect(() => {
    if (phase !== "ready" || !selectedLesson) return;
    let cancelled = false;
    setSpaceLoading(true);
    setSpaceError(null);
    setPairSpace(null);
    getPairSpace(selectedLesson.id)
      .then((space) => {
        if (!cancelled) setPairSpace(space);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setPairSpace(null);
        } else {
          setSpaceError(
            errorMessage(error, "Не удалось загрузить пространство пары"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSpaceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, selectedLesson]);

  useEffect(() => {
    if (phase !== "ready" || tab !== "notifications") return;
    let cancelled = false;
    setInboxError(null);
    getNotifications()
      .then((response) => {
        if (!cancelled) setInbox(response.data);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setInboxError(
            errorMessage(error, "Не удалось загрузить уведомления"),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [phase, tab, refreshKey]);

  useEffect(() => {
    if (phase !== "ready" || tab !== "profile") return;
    let cancelled = false;
    setProfileError(null);
    getProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setProfileError(errorMessage(error, "Не удалось загрузить профиль"));
      });
    return () => {
      cancelled = true;
    };
  }, [phase, tab]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setLoginBusy(true);
    setLoginError(null);
    try {
      const initData = getInitData();
      const auth = initData
        ? await loginWithMax(initData, { email, password })
        : await loginWithPassword(email, password);
      setUser(auth.user);
      setBootError(null);
      setPhase("ready");
    } catch (error) {
      setLoginError(errorMessage(error, "Не удалось войти"));
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleMaxLogin() {
    const initData = getInitData();
    if (!initData) return;

    setLoginBusy(true);
    setLoginError(null);
    try {
      const auth = await loginWithMax(initData);
      setUser(auth.user);
      setBootError(null);
      setPhase("ready");
    } catch (error) {
      setLoginError(errorMessage(error, "Не удалось войти через MAX"));
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setProfile(null);
    setMyDay(null);
    setWeekLessons(null);
    setInbox(null);
    setSelectedLesson(null);
    setTab("today");
    setPhase("login");
  }

  function openLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setTab("lessons");
  }

  function openAbsence(lesson?: Lesson | null) {
    setAbsenceLessonId(
      canLinkAbsenceToLesson(lesson) ? lesson?.id || null : null,
    );
    setAbsenceOpen(true);
    setAbsenceSent(false);
    setAbsenceError(null);
  }

  async function handleAbsenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const comment = String(form.get("comment") ?? "").trim();
    setAbsenceBusy(true);
    setAbsenceError(null);
    try {
      await createAbsence({
        type: String(form.get("type")),
        startDate: String(form.get("startDate")),
        endDate: String(form.get("endDate")),
        ...(comment ? { comment } : {}),
        ...(absenceLessonId ? { lessonId: absenceLessonId } : {}),
      });
      setAbsenceSent(true);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setAbsenceError(errorMessage(error, "Не удалось отправить заявку"));
    } finally {
      setAbsenceBusy(false);
    }
  }

  const isStudent = user?.role === "student";
  const todayDateKey =
    localDateKey(myDay?.date ? `${myDay.date}T12:00:00` : undefined) ??
    toDateInput(new Date());
  const upcoming = myDay ? findUpcomingLesson(myDay.lessons) : null;

  if (phase === "boot") {
    return (
      <main className="app-shell boot-screen">
        <p className="brand">НаПаре</p>
        <p className="bridge-state">Загружаем данные…</p>
      </main>
    );
  }

  if (phase === "login") {
    const maxLoginAvailable = Boolean(getInitData());
    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <p className="brand">НаПаре</p>
            <p className="subtitle">Всё важное о твоих парах</p>
          </div>
        </header>
        <section className="screen login-screen">
          <div className="screen-heading">
            <h1>Вход</h1>
            <p>
              {maxLoginAvailable
                ? "Войдите через MAX или используйте учётную запись университета"
                : "Используйте учётную запись университета"}
            </p>
          </div>
          {bootError && <p className="error-banner">{bootError}</p>}
          {maxLoginAvailable && (
            <button
              className="max-login"
              type="button"
              onClick={handleMaxLogin}
              disabled={loginBusy}
            >
              {loginBusy ? "Проверяем MAX…" : "Войти через MAX"}
            </button>
          )}
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Электронная почта
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="student@sibit.ru"
              />
            </label>
            <label>
              Пароль
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                placeholder="••••••"
              />
            </label>
            {loginError && <p className="error-banner">{loginError}</p>}
            <button className="primary" type="submit" disabled={loginBusy}>
              {loginBusy ? "Входим…" : "Войти"}
            </button>
          </form>
          <p className="bridge-state">
            {insideMax
              ? "MAX Bridge подключён. После первой привязки используйте вход через MAX — пароль повторно не понадобится."
              : "Режим браузера: после привязки аккаунта открывайте мини-приложение из MAX для быстрого входа."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand">НаПаре</p>
          <p className="subtitle">Всё важное о твоих парах</p>
        </div>
        <button
          className="avatar"
          aria-label="Открыть профиль"
          onClick={() => setTab("profile")}
        >
          {initialsOf(user)}
        </button>
      </header>

      {tab === "today" && (
        <section className="screen" aria-labelledby="today-title">
          <div className="screen-heading">
            <h1 id="today-title">Сегодня</h1>
            <p>{formatDayHeading(todayDateKey)}</p>
          </div>

          {!myDay && !todayError && (
            <p className="empty-state">Загружаем расписание…</p>
          )}
          {todayError && (
            <p className="error-banner">
              {todayError}{" "}
              <button
                className="inline-retry"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                Повторить
              </button>
            </p>
          )}

          {myDay && (
            <>
              {upcoming ? (
                <article className="next-lesson">
                  <div className="lesson-status">
                    <span>
                      {upcoming.ongoing ? "Сейчас идёт" : "Следующая пара"}
                    </span>
                    <span>
                      {upcoming.ongoing
                        ? `до ${upcoming.lesson.endTime}`
                        : `через ${formatDuration(upcoming.startsInMinutes)}`}
                    </span>
                  </div>
                  <h2>{upcoming.lesson.subject}</h2>
                  <div className="lesson-details">
                    <span>
                      ◷ {upcoming.lesson.startTime} — {upcoming.lesson.endTime}
                    </span>
                    {upcoming.lesson.room && (
                      <span>⌖ {upcoming.lesson.room}</span>
                    )}
                    {upcoming.lesson.teacherName && (
                      <span>♙ {upcoming.lesson.teacherName}</span>
                    )}
                  </div>
                  {isStudent && (
                    <button
                      className="absence-button"
                      onClick={() => openAbsence(upcoming.lesson)}
                    >
                      Сообщить об отсутствии
                    </button>
                  )}
                </article>
              ) : (
                <article className="next-lesson">
                  <div className="lesson-status">
                    <span>Свободный день</span>
                  </div>
                  <p className="empty-state">
                    {myDay.lessons.length
                      ? "Все пары на сегодня уже закончились."
                      : "Сегодня пар нет."}
                  </p>
                  {isStudent && (
                    <button
                      className="absence-button"
                      onClick={() => openAbsence()}
                    >
                      Сообщить об отсутствии
                    </button>
                  )}
                </article>
              )}

              <section
                className="schedule-section"
                aria-labelledby="schedule-title"
              >
                <div className="section-title">
                  <h2 id="schedule-title">Сегодня в расписании</h2>
                  <button onClick={() => setTab("schedule")}>Все пары →</button>
                </div>
                {myDay.lessons.length === 0 ? (
                  <p className="empty-state">На сегодня занятий нет.</p>
                ) : (
                  <div className="lesson-list">
                    {myDay.lessons.map((lesson) => (
                      <button
                        className="lesson-row"
                        key={lesson.id}
                        onClick={() => openLesson(lesson)}
                      >
                        <time>
                          {lesson.startTime}
                          <small>{lesson.endTime}</small>
                        </time>
                        <span className="divider" />
                        <span className="lesson-copy">
                          <strong>{lesson.subject}</strong>
                          <small>
                            {[lesson.room, lesson.teacherName]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </small>
                        </span>
                        {lesson.isChanged && <em>Изменено</em>}
                      </button>
                    ))}
                  </div>
                )}
              </section>
              {isStudent && myDay.absences.length > 0 && (
                <section
                  className="schedule-section"
                  aria-labelledby="absence-status-title"
                >
                  <div className="section-title">
                    <h2 id="absence-status-title">Мои обращения</h2>
                    <span>{myDay.absences.length}</span>
                  </div>
                  <div className="lesson-list">
                    {myDay.absences.map((absence) => (
                      <article className="lesson-row" key={absence.id}>
                        <span className="divider" />
                        <span className="lesson-copy">
                          <strong>
                            {absence.confirmationRequired
                              ? "Ожидает подтверждения"
                              : "Подтверждено"}
                          </strong>
                          <small>
                            {absence.comment || "Отсутствие зарегистрировано"}
                          </small>
                        </span>
                        <em>
                          {absence.confirmationRequired ? "В работе" : "Готово"}
                        </em>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      )}

      {tab === "schedule" && (
        <section
          className="screen secondary-screen"
          aria-labelledby="schedule-screen-title"
        >
          <div className="screen-heading">
            <h1 id="schedule-screen-title">Расписание</h1>
            <p>Учебная неделя</p>
          </div>
          <div className="week-nav">
            <button
              onClick={() => setWeekStart((start) => addDays(start, -7))}
              aria-label="Предыдущая неделя"
            >
              ←
            </button>
            <span>{formatWeekRange(weekStart)}</span>
            <button
              onClick={() => setWeekStart((start) => addDays(start, 7))}
              aria-label="Следующая неделя"
            >
              →
            </button>
          </div>
          {!weekLessons && !weekError && (
            <p className="empty-state">Загружаем расписание…</p>
          )}
          {weekError && (
            <p className="error-banner">
              {weekError}{" "}
              <button
                className="inline-retry"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                Повторить
              </button>
            </p>
          )}
          {weekLessons && weekLessons.length === 0 && (
            <p className="empty-state">На этой неделе пар нет.</p>
          )}
          {weekLessons && weekLessons.length > 0 && (
            <div className="day-groups">
              {Array.from(
                weekLessons.reduce((groups, lesson) => {
                  const key = localDateKey(lesson.startDate) ?? "без-даты";
                  const bucket = groups.get(key);
                  if (bucket) bucket.push(lesson);
                  else groups.set(key, [lesson]);
                  return groups;
                }, new Map<string, Lesson[]>()),
              ).map(([dateKey, lessons]) => (
                <section className="schedule-section" key={dateKey}>
                  <div className="section-title">
                    <h2>
                      {dateKey === todayDateKey ? "Сегодня · " : ""}
                      {formatDayHeading(dateKey)}
                    </h2>
                  </div>
                  <div className="lesson-list">
                    {lessons.map((lesson) => (
                      <button
                        className="lesson-row"
                        key={lesson.id}
                        onClick={() => openLesson(lesson)}
                      >
                        <time>
                          {lesson.startTime}
                          <small>{lesson.endTime}</small>
                        </time>
                        <span className="divider" />
                        <span className="lesson-copy">
                          <strong>{lesson.subject}</strong>
                          <small>
                            {[lesson.room, lesson.teacherName]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </small>
                        </span>
                        {lesson.isChanged && <em>Изменено</em>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "lessons" && (
        <section
          className="screen secondary-screen"
          aria-labelledby="lessons-title"
        >
          <div className="screen-heading">
            <h1 id="lessons-title">Пары</h1>
            <p>
              {selectedLesson
                ? selectedLesson.subject
                : "Открой пару, материалы и подготовку"}
            </p>
          </div>

          {selectedLesson ? (
            <>
              <button
                className="link-back"
                onClick={() => setSelectedLesson(null)}
              >
                ← К расписанию
              </button>
              <article className="lesson-space">
                <h2>{selectedLesson.subject}</h2>
                <p>
                  {[
                    selectedLesson.pairNumber
                      ? `${selectedLesson.pairNumber} пара`
                      : null,
                    `${selectedLesson.startTime} — ${selectedLesson.endTime}`,
                    selectedLesson.room,
                    selectedLesson.teacherName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {spaceLoading && (
                  <p className="empty-state">Загружаем пространство пары…</p>
                )}
                {spaceError && <p className="error-banner">{spaceError}</p>}
                {!spaceLoading && !spaceError && !pairSpace && (
                  <p className="empty-state">
                    Для этой пары ещё нет пространства. Материалы, объявления и
                    подготовка появится здесь, когда её добавит преподаватель.
                  </p>
                )}
                {pairSpace && (
                  <>
                    {pairSpace.announcements?.length > 0 && (
                      <section className="space-section">
                        <h3>Объявления</h3>
                        <ul className="space-list">
                          {pairSpace.announcements.map((item) => (
                            <li key={item.id}>{item.text}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {pairSpace.homeworks?.length > 0 && (
                      <section className="space-section">
                        <h3>Подготовка к паре</h3>
                        <ul className="space-list">
                          {pairSpace.homeworks.map((item) => (
                            <li key={item.id}>
                              <strong>{item.title}</strong>
                              {item.deadline && (
                                <small>
                                  до{" "}
                                  {new Date(item.deadline).toLocaleDateString(
                                    "ru-RU",
                                  )}
                                </small>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {pairSpace.files?.length > 0 && (
                      <section className="space-section">
                        <h3>Материалы</h3>
                        <ul className="space-list file-list">
                          {pairSpace.files.map((file) => (
                            <li key={file.id}>
                              <a href={file.fileUrl} download={file.fileName}>
                                {file.fileName}
                              </a>
                              <small>
                                {Math.max(1, Math.round(file.size / 1024))} КБ
                              </small>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {!pairSpace.announcements?.length &&
                      !pairSpace.homeworks?.length &&
                      !pairSpace.files?.length && (
                        <p className="empty-state">
                          По паре пока нет материалов.
                        </p>
                      )}
                  </>
                )}
              </article>
            </>
          ) : (
            <>
              {!weekLessons && !weekError && (
                <p className="empty-state">Загружаем пары недели…</p>
              )}
              {weekError && <p className="error-banner">{weekError}</p>}
              {weekLessons && weekLessons.length === 0 && (
                <p className="empty-state">На этой неделе пар нет.</p>
              )}
              {weekLessons && weekLessons.length > 0 && (
                <div className="lesson-list">
                  {weekLessons.map((lesson) => {
                    const lessonDateKey =
                      localDateKey(lesson.startDate) ?? todayDateKey;
                    return (
                      <button
                        className="lesson-row"
                        key={lesson.id}
                        onClick={() => openLesson(lesson)}
                      >
                        <time>
                          {WEEKDAYS_SHORT[parseDateKey(lessonDateKey).getDay()]}
                          <small>{lesson.startTime}</small>
                        </time>
                        <span className="divider" />
                        <span className="lesson-copy">
                          <strong>{lesson.subject}</strong>
                          <small>
                            {[formatShortDate(lessonDateKey), lesson.room]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "notifications" && (
        <section
          className="screen secondary-screen"
          aria-labelledby="notifications-title"
        >
          <div className="screen-heading">
            <h1 id="notifications-title">Уведомления</h1>
            <p>Изменения расписания и новости пар</p>
          </div>
          {!inbox && !inboxError && (
            <p className="empty-state">Загружаем уведомления…</p>
          )}
          {inboxError && <p className="error-banner">{inboxError}</p>}
          {inbox && inbox.length === 0 && (
            <p className="empty-state">Новых уведомлений нет.</p>
          )}
          {inbox && inbox.length > 0 && (
            <div className="notification-list">
              {inbox.map((item) => (
                <article className="notification-row" key={item.id}>
                  <div className="section-title">
                    <h3>{item.title}</h3>
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p>{item.body}</p>
                  {!item.isRead && (
                    <span className="unread-dot" aria-label="Не прочитано" />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "profile" && (
        <section
          className="screen secondary-screen"
          aria-labelledby="profile-title"
        >
          <div className="screen-heading">
            <h1 id="profile-title">Профиль</h1>
            <p>Учётная запись университета</p>
          </div>
          {profileError && <p className="error-banner">{profileError}</p>}
          <article className="profile-card">
            <div className="avatar-big" aria-hidden="true">
              {initialsOf(user)}
            </div>
            <h2>{user ? `${user.firstName} ${user.lastName}`.trim() : ""}</h2>
            <p className="profile-email">{user?.email}</p>
            <dl className="profile-facts">
              <div>
                <dt>Роль</dt>
                <dd>{user ? (ROLE_LABELS[user.role] ?? user.role) : "—"}</dd>
              </div>
              {profile?.groupId && (
                <div>
                  <dt>Группа</dt>
                  <dd>{profile.groupId}</dd>
                </div>
              )}
              <div>
                <dt>Вход</dt>
                <dd>{insideMax ? "Через MAX" : "По паролю"}</dd>
              </div>
            </dl>
            <button className="absence-button" onClick={handleLogout}>
              Выйти
            </button>
          </article>
          {insideMax && (
            <p className="bridge-state">
              MAX Bridge подключён. Данные запуска не используются как учётная
              запись.
            </p>
          )}
        </section>
      )}

      <nav className="bottom-nav" aria-label="Основная навигация">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {absenceOpen && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="absence-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="absence-title"
          >
            <button
              className="close"
              aria-label="Закрыть"
              onClick={() => setAbsenceOpen(false)}
            >
              ×
            </button>
            {absenceSent ? (
              <>
                <h2 id="absence-title">Заявка отправлена</h2>
                <p>
                  {absenceLessonId
                    ? "Преподаватель и куратор увидят отсутствие по этой паре."
                    : "Куратор увидит период отсутствия и комментарий."}
                </p>
                <button
                  className="primary"
                  onClick={() => setAbsenceOpen(false)}
                >
                  Готово
                </button>
              </>
            ) : (
              <form onSubmit={handleAbsenceSubmit}>
                <h2 id="absence-title">Сообщить об отсутствии</h2>
                <label>
                  Причина
                  <select name="type" required defaultValue="learning">
                    <option value="learning">Учебная причина</option>
                    <option value="sick">Болезнь</option>
                    <option value="other">Другое</option>
                  </select>
                </label>
                <div className="date-grid">
                  <label>
                    С
                    <input
                      type="date"
                      name="startDate"
                      required
                      defaultValue={todayDateKey}
                    />
                  </label>
                  <label>
                    По
                    <input
                      type="date"
                      name="endDate"
                      required
                      defaultValue={todayDateKey}
                    />
                  </label>
                </div>
                <label>
                  Комментарий
                  <textarea
                    name="comment"
                    maxLength={500}
                    placeholder="Необязательно"
                  />
                </label>
                {absenceError && <p className="error-banner">{absenceError}</p>}
                <button
                  className="primary"
                  type="submit"
                  disabled={absenceBusy}
                >
                  {absenceBusy ? "Отправляем…" : "Отправить заявку"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {getInitData() && (
        <span className="sr-only">
          Данные запуска MAX доступны для безопасной проверки на сервере
        </span>
      )}
    </main>
  );
}
