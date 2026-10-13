"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, getNotifications, getUser } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  RequestState,
  Skeleton,
} from "@/components/ui";

interface Lesson {
  id: string;
  subject: string;
  subjectType?: string;
  room?: string;
  startTime: string;
  endTime: string;
  isChanged?: boolean;
  changeDescription?: string;
  groupName?: string;
}
interface Homework {
  id: string;
  title: string;
  deadline?: string;
}
interface PairSpaceSummary {
  lessonId: string;
  homeworks?: Homework[];
  announcements?: unknown[];
  messages?: unknown[];
  files?: unknown[];
}
interface MyDayResponse {
  date: string;
  lessons: Lesson[];
  pairSpaces?: PairSpaceSummary[];
  notifications?: { unreadCount?: number };
  summary?: {
    totalLessons: number;
    changedLessons: number;
    totalAbsences: number;
  };
}
interface Notice {
  id?: string;
  title?: string;
  message?: string;
  body?: string;
  isRead?: boolean;
  type?: string;
  createdAt?: string;
}

const typeLabels: Record<string, string> = {
  lecture: "Лекция",
  practice: "Практика",
  lab: "Лабораторная",
  exam: "Экзамен",
  consultation: "Консультация",
  test: "Зачёт",
};
function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
function lessonState(lesson: Lesson, now: Date) {
  const current = now.getHours() * 60 + now.getMinutes();
  if (current >= minutes(lesson.startTime) && current < minutes(lesson.endTime))
    return { label: "Сейчас", variant: "sky" as const };
  if (current < minutes(lesson.startTime))
    return { label: "Следующая", variant: "indigo" as const };
  return { label: "Завершено", variant: "slate" as const };
}

export default function TodayPage() {
  const [user, setUser] = useState<Awaited<ReturnType<typeof getUser>> | null>(null);
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [attentionCount,setAttentionCount]=useState<number|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadDay = () => {
    setLoading(true);
    setError("");
    Promise.all([
      getUser(),
      apiFetch<MyDayResponse>(`/my-day?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")}`),
      getNotifications(),
      apiFetch<Array<{id:string}>>("/notifications/inbox?status=open&limit=100").catch(()=>null),
    ])
      .then(([profile, today, notificationItems,inbox]) => {
        setUser(profile);
        setDay(today);
        setNotices(notificationItems);
        setAttentionCount(inbox ? inbox.length : null);
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить рабочий день.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    loadDay();
  }, []);
  const now = new Date();
  const lessons = day?.lessons ?? [];
  const spaces = day?.pairSpaces ?? [];
  const current = lessons.find(
    (lesson) => lessonState(lesson, now).label === "Сейчас",
  );
  const next =
    current ||
    lessons.find((lesson) => lessonState(lesson, now).label === "Следующая");
  const groups = new Set(
    lessons.map((lesson) => lesson.groupName).filter(Boolean),
  );
  const activeHomework = spaces.reduce(
    (sum, space) =>
      sum +
      (space.homeworks?.filter(
        (item) => !item.deadline || new Date(item.deadline) >= now,
      ).length || 0),
    0,
  );
  const unread = day?.notifications?.unreadCount ?? notices.filter(notice=>notice.isRead===false).length;
  const attention = useMemo(
    () => [
      {
        label: "Активные задания",
        value: activeHomework,
        href: next ? `/pair-space/${next.id}` : "/pair-space",
      },
      { label: "Непросмотренные сообщения", value: unread, href: "/inbox" },
      {
        label: "Изменения расписания",
        value: day?.summary?.changedLessons || 0,
        href: "/week",
      },
      {
        label: "Ожидают действия",
        value:
          attentionCount ?? "Нет данных",
        href: "/inbox",
      },
    ],
    [activeHomework, day, next, unread,attentionCount],
  );
  if (loading)
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-36" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-[1400px]">
        <RequestState
          title="Не удалось загрузить рабочий день"
          description={error}
          onRetry={loadDay}
        />
      </div>
    );
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow={user?.role === "curator" ? "Рабочий день куратора" : user?.role === "teacher" ? "Рабочий день преподавателя" : "Рабочий день"}
        title={`Добрый день, ${user?.firstName || ""}`}
        description={now.toLocaleDateString("ru-RU", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <Link href="/week">
            <Button variant="secondary">Открыть расписание</Button>
          </Link>
        }
      />
      {["curator","faculty_dean","department_head","university_admin","superadmin"].includes(user?.role || "") && <Card className="border-sky-200 bg-sky-50/50"><h2 className="text-lg font-semibold text-slate-900">{user?.role === "curator" ? "Группы и обращения" : user?.role === "faculty_dean" ? "Учебный день факультета" : user?.role === "department_head" ? "Учебный день кафедры" : "Учебные действия"}</h2><p className="mt-2 text-sm text-slate-600">Проверьте доступную очередь действий, затем группы и обращения. Сведения показаны в пределах прав вашего аккаунта.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/inbox"><Button>Открыть очередь · {attentionCount ?? "Нет данных"}</Button></Link><Link href="/attendance"><Button variant="secondary">Посещаемость и обращения</Button></Link><Link href="/groups"><Button variant="secondary">Открыть группы</Button></Link><Link href="/inbox"><Button variant="ghost">Центр внимания</Button></Link></div></Card>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Следующая пара",
            value: next ? next.startTime : "—",
            note: next?.subject || "Свободное время",
          },
          {
            label: "Группы сегодня",
            value: groups.size,
            note: "Уникальные группы",
          },
          {
            label: "Активные задания",
            value: activeHomework,
            note: "Подготовка к занятиям",
          },
          {
            label: "Непросмотренные",
            value: unread,
            note: "Сообщения и события",
          },
        ].map((stat) => (
          <Card key={stat.label} padding="sm" className="min-h-[104px]">
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {stat.label}
            </p>
            <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {current ? "Сейчас" : !next && lessons.length ? "Занятия завершены" : "Следующая пара"}
              </h2>
              <span className="text-xs text-slate-400">
                {next ? lessonState(next, now).label : "Сегодня"}
              </span>
            </div>
            {next ? (
              <Card className="border-l-4 border-l-sky-500 px-5 py-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {next.subject}
                      </h3>
                      <Badge variant="sky">
                        {next.groupName || "Группа не указана"}
                      </Badge>
                      <Badge variant={lessonState(next, now).variant}>
                        {lessonState(next, now).label}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {next.startTime}–{next.endTime}
                      </span>
                      <span>Ауд. {next.room || "—"}</span>
                      <span>
                        {typeLabels[next.subjectType || ""] ||
                          next.subjectType ||
                          "Занятие"}
                      </span>
                    </div>
                    {next.isChanged && (
                      <p className="mt-3 text-sm font-medium text-amber-700">
                        {next.changeDescription || "Расписание изменилось"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/pair-space/${next.id}`}>
                      <Button>Открыть пару</Button>
                    </Link>
                    <Link href={`/attendance?lesson=${next.id}`}>
                      <Button variant="secondary">Посещаемость</Button>
                    </Link>
                    <Link href={`/pair-space/${next.id}?compose=homework`}>
                      <Button variant="ghost">Подготовка к паре</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ) : (
              <EmptyState
                title={lessons.length ? "Все занятия на сегодня завершены" : "Сегодня нет занятий"}
                description="Проверьте незавершённые действия или подготовьте следующие занятия."
                action={<div className="flex flex-wrap justify-center gap-3"><Link href="/inbox" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-brand)] px-4 text-sm font-semibold text-white">Разобрать действия</Link><Link href="/pair-space" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold text-[var(--color-brand)]">Следующие занятия</Link></div>}
              />
            )}
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Расписание дня
              </h2>
              <span className="text-sm text-slate-500">
                {lessons.length} занятий
              </span>
            </div>
            {lessons.length ? (
              <div className="space-y-2">
                {lessons.map((lesson) => {
                  const state = lessonState(lesson, now);
                  return (
                    <Link
                      key={lesson.id}
                      href={`/pair-space/${lesson.id}`}
                      className="block"
                    >
                      <Card hover className="px-4 py-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 shrink-0">
                            <p className="text-sm font-bold text-slate-900">
                              {lesson.startTime}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {lesson.endTime}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-slate-900">
                                {lesson.subject}
                              </h3>
                              <Badge size="sm" variant={state.variant}>
                                {state.label}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {lesson.groupName || "Группа не указана"} · Ауд.{" "}
                              {lesson.room || "—"}
                            </p>
                            {lesson.isChanged && (
                              <p className="mt-2 text-xs font-medium text-amber-700">
                                {lesson.changeDescription || "Есть изменение"}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Нет занятий"
                description="На сегодня нет запланированных занятий."
              />
            )}
          </section>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-24">
          <Card padding="sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Ожидают действия</h2>
              <Link
                href="/inbox"
                className="text-xs font-semibold text-sky-700"
              >
                Центр внимания
              </Link>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {attention.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 hover:text-sky-700"
                >
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                    {item.value}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
          <Card padding="sm">
            <h2 className="font-bold text-slate-900">Последние события</h2>
            {notices.length ? (
              <div className="mt-3 space-y-3">
                {notices.slice(0, 4).map((notice, index) => (
                  <div key={notice.id || index}>
                    <p className="text-sm font-medium text-slate-800">
                      {notice.title || notice.message || "Новое уведомление"}
                    </p>
                    {notice.createdAt && (
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(notice.createdAt).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Новых событий нет.</p>
            )}
            <Link
              href="/notifications"
              className="mt-4 block text-sm font-semibold text-sky-700"
            >
              Все уведомления
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
