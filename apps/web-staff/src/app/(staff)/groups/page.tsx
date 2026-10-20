"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspaceQuery } from "@napare/ui/workspace-shell";
import { LessonTypeBadge } from "@napare/ui";
import { apiFetchList } from "@/lib/api";
import {
  Badge,
  Card,
  EmptyState,
  RequestState,
  SearchInput,
  Sheet,
  Skeleton,
} from "@/components/ui";

interface Group {
  id: string;
  name: string;
  studentCount?: number;
  faculty?: { name?: string } | null;
  facultyName?: string;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}
interface Lesson {
  id: string;
  subject: string;
  subjectType?: string;
  groupName: string;
  startDate?: string;
  startTime: string;
  endTime: string;
  room: string;
}
type DetailTab =
  | "students"
  | "schedule"
  | "attendance"
  | "assignments"
  | "announcements";

function groupFaculty(group: Group) {
  return group.facultyName || group.faculty?.name || "Факультет не указан";
}
function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("students");
  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState("all");
  const [scheduleError,setScheduleError]=useState("");
  useWorkspaceQuery({q:search,faculty},params=>{setSearch((params.get("q")||"").slice(0,100));setFaculty(params.get("faculty")||"all");});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const start = getWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    Promise.all([
      apiFetchList<Group>("/admin/attendance-groups"),
      apiFetchList<Lesson>(
        `/schedule/range?startDate=${dateKey(start)}&endDate=${dateKey(end)}&limit=100`,
      ).catch(()=>{setScheduleError("Расписание недели не загрузилось.");return [];}),
    ])
      .then(([groupItems, lessonItems]) => {
        setGroups(groupItems);
        setLessons(lessonItems);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить группы.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const faculties = [
    ...new Set(
      groups.map(groupFaculty).filter((item) => item !== "Факультет не указан"),
    ),
  ].sort();
  const filtered = groups.filter(
    (group) =>
      group.name.toLowerCase().includes(search.toLowerCase()) &&
      (faculty === "all" || groupFaculty(group) === faculty),
  );
  const groupLessons = selected
    ? lessons
        .filter((lesson) => lesson.groupName === selected.name)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    : [];

  const openGroup = (group: Group) => {
    setSelected(group);
    setDetailTab("students");
    setDetailError("");
    setDetailLoading(true);
    apiFetchList<Student>(`/admin/groups/${group.id}/students`)
      .then(setStudents)
      .catch((err) =>
        setDetailError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить студентов.",
        ),
      )
      .finally(() => setDetailLoading(false));
  };

  const attendanceLink = selected
    ? `/attendance?group=${selected.id}`
    : "/attendance";
  const tabs: Array<{ id: DetailTab; label: string; href?: string }> = [
    { id: "students", label: "Студенты" },
    { id: "schedule", label: "Расписание" },
    { id: "attendance", label: "Посещаемость", href: attendanceLink },
    { id: "assignments", label: "Подготовка к парам", href: `/assignments?q=${encodeURIComponent(selected?.name || "")}` },
    { id: "announcements", label: "Объявления", href: "/notifications?filter=teachers" },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Мои группы
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Загружаем доступные группы…" : `${groups.length} групп доступно`}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={setSearch}
          placeholder="Поиск групп..."
        />
        <select
          aria-label="Фильтр по факультету"
          value={faculty}
          onChange={(event) => setFaculty(event.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <option value="all">Все факультеты</option>
          {faculties.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <Skeleton className="h-44" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <RequestState
          title="Не удалось загрузить группы"
          description={error}
          onRetry={() => window.location.reload()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Группы не найдены"
          description={
            search || faculty !== "all"
              ? "Измените параметры поиска или фильтра."
              : "Группы пока не назначены."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((group) => {
            const nearest = lessons.filter(lesson=>lesson.groupName===group.name && new Date(lesson.startDate || lesson.startTime).getTime()>=Date.now()).sort((a,b)=>(a.startDate || a.startTime).localeCompare(b.startDate || b.startTime))[0];
            return (
              <div
                key={group.id}
                className="text-left"
              >
                <Card
                  hover
                  className={`h-full transition-shadow ${selected?.id === group.id ? "border-indigo-300 ring-2 ring-indigo-100" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900"><button type="button" onClick={() => openGroup(group)} className="min-h-11 text-left hover:text-indigo-700">{group.name}</button></h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.studentCount === undefined ? "Откройте список студентов" : `${group.studentCount} студентов`}
                      </p>
                    </div>
                    {group.studentCount !== undefined && <Badge variant="sky">{group.studentCount}</Badge>}
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Ближайшее занятие этой недели
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {scheduleError ? "Нет данных расписания" : nearest?.subject || "Ближайших занятий нет"}
                  </p>
                  {nearest?.subjectType && <div className="mt-2"><LessonTypeBadge subjectType={nearest.subjectType} /></div>}
                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                    <Link
                      href={`/attendance?group=${group.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Посещаемость
                    </Link>
                    <Link
                      href={`/week?group=${group.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Расписание
                    </Link>
                    <button type="button" onClick={() => openGroup(group)} className="ml-auto min-h-11 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                      Открыть →
                    </button>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
      {selected && (
        <Sheet open onClose={()=>setSelected(null)} title={selected.name}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {selected.name}
                </h2>
                {!detailLoading && !detailError && <Badge variant="sky">{students.length} студентов</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {groupFaculty(selected)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="self-start rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Закрыть детали"
            >
              Закрыть
            </button>
          </div>
          <div className="mt-5 space-y-3">
            <div role="group" aria-label="Содержимое группы" className="flex gap-1 border-b border-slate-200">
              {tabs.filter((tab) => !tab.href).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={detailTab === tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={`min-h-11 border-b-2 px-3 py-3 text-sm font-medium ${detailTab === tab.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <nav aria-label="Другие разделы группы" className="flex flex-wrap gap-2">
              {tabs.filter((tab) => tab.href).map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href!}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {tab.label}<span aria-hidden="true">→</span>
                </Link>
              ))}
            </nav>
          </div>
          {detailLoading ? (
            <div className="mt-5">
              <Skeleton className="h-32" />
            </div>
          ) : detailError && detailTab === "students" ? (
            <div className="mt-5">
              <RequestState
                title="Не удалось загрузить студентов"
                description={detailError}
                onRetry={() => openGroup(selected)}
              />
            </div>
          ) : detailTab === "students" ? (
            <div className="mt-5">
              {students.length ? (
                <div className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {student.email}
                        </p>
                      </div>
                      <Link
                        href={`${attendanceLink}&student=${student.id}`}
                        className="text-xs font-semibold text-indigo-700 hover:text-indigo-800"
                      >
                        Посещаемость
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Студенты не найдены"
                  description="В этой группе пока нет добавленных студентов."
                />
              )}
            </div>
          ) : detailTab === "schedule" ? (
            <div className="mt-5">
              {scheduleError ? <RequestState title="Расписание недоступно" description={scheduleError} onRetry={()=>window.location.reload()}/> : groupLessons.length ? (
                <div className="space-y-2">
                  {groupLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <span className="w-28 shrink-0 text-sm font-semibold text-slate-700">
                        {lesson.startDate?.slice(0,10) || (lesson.startTime.includes("T") ? lesson.startTime.slice(0,10) : "Дата не указана")} ·{" "}
                        {lesson.startTime.includes("T") ? lesson.startTime.slice(11,16) : lesson.startTime}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {lesson.subject}
                      </span>
                      <LessonTypeBadge subjectType={lesson.subjectType} />
                      <span className="ml-auto text-xs text-slate-500">
                        ауд. {lesson.room || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Расписание не найдено"
                  description="Для этой группы нет занятий в загруженном диапазоне."
                />
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-500">
              Откройте раздел «{tabs.find((tab) => tab.id === detailTab)?.label}
              », чтобы работать с данными группы.
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
