"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceQuery } from "@napare/ui/workspace-shell";
import { apiFetch, type PaginatedResponse } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  RequestState,
  Sheet,
  Skeleton,
} from "@/components/ui";

interface Lesson {
  id: string;
  subject: string;
  groupName?: string;
  teacherName?: string;
  startTime?: string;
}

interface Preparation {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
}

interface PairSpaceSummary {
  lessonId: string;
  homeworks?: Preparation[];
}

interface MyDayResponse {
  lessons: Lesson[];
  pairSpaces?: PairSpaceSummary[];
}

interface FileItem {
  id?: string;
  fileName?: string;
  fileUrl?: string;
}

interface PairSpace {
  files?: FileItem[];
}

type Sort = "date" | "subject";

interface PreparationWithLesson {
  preparation: Preparation;
  lesson?: Lesson;
}

function dateLabel(value?: string): string {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

type DeadlineState = "overdue" | "today" | "soon" | "later" | "none";

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function deadlineState(value?: string, now = new Date()): DeadlineState {
  if (!value) return "none";
  const deadlineDate = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) return "none";
  const today = dateKey(now);
  if (deadlineDate < today) return "overdue";
  if (deadlineDate === today) return "today";
  const soonLimit = new Date(now);
  soonLimit.setDate(soonLimit.getDate() + 7);
  return deadlineDate <= dateKey(soonLimit) ? "soon" : "later";
}

const deadlineLabels: Record<DeadlineState, string> = {
  overdue: "Просрочено",
  today: "Сегодня",
  soon: "Скоро",
  later: "Впереди",
  none: "Без срока",
};

const deadlineVariants = {
  overdue: "red",
  today: "amber",
  soon: "indigo",
  later: "green",
  none: "slate",
} as const;

function PreparationList({
  items,
  onOpen,
}: {
  items: PreparationWithLesson[];
  onOpen: (item: PreparationWithLesson) => void;
}) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <button
          key={item.preparation.id}
          type="button"
          onClick={() => onOpen(item)}
          className="group flex w-full flex-wrap items-start gap-3 px-1 py-4 text-left transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-brand)]"
            aria-hidden="true"
          />
          <span className="min-w-[min(12rem,100%)] flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--color-text)]">
                {item.preparation.title}
              </span>
              <Badge
                variant={deadlineVariants[deadlineState(item.preparation.deadline)]}
              >
                {deadlineLabels[deadlineState(item.preparation.deadline)]}
              </Badge>
            </span>
            <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
              {item.lesson?.subject || "Предмет не указан"}
              {item.lesson?.groupName ? ` · ${item.lesson.groupName}` : ""}
            </span>
            {item.preparation.description && (
              <span className="mt-2 line-clamp-2 block text-sm leading-5 text-[var(--color-text-secondary)]">
                {item.preparation.description}
              </span>
            )}
          </span>
          <span className="shrink-0 text-right text-xs text-[var(--color-text-secondary)]">
            <span className="block font-medium">
              {dateLabel(item.preparation.deadline)}
            </span>
            <span className="mt-1 block text-[var(--color-brand)] group-hover:underline">
              Открыть →
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function AssignmentsPage() {
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [selected, setSelected] = useState<PreparationWithLesson | null>(null);
  const [detail, setDetail] = useState<PairSpace | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [partial, setPartial] = useState(0);
  const [range, setRange] = useState('');
  const loadSequence = useRef(0);
  const detailSequence = useRef(0);
  useWorkspaceQuery({ q: query, sort }, params => { setQuery((params.get('q') || '').slice(0,100)); setSort(params.get('sort') === 'subject' ? 'subject' : 'date'); });

  const load = async () => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    setError("");
    setPartial(0);
    const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const start = new Date(); start.setDate(start.getDate()-7);
    const end = new Date(); end.setDate(end.getDate()+14);
    setRange(`${start.toLocaleDateString('ru-RU')}–${end.toLocaleDateString('ru-RU')}`);
    try {
      const query = `startDate=${localDate(start)}&endDate=${localDate(end)}&limit=100`;
      const firstPage = await apiFetch<PaginatedResponse<Lesson>>(`/schedule/range?${query}&page=1`);
      const pageCount = Math.max(1, firstPage.meta?.totalPages || 1);
      const remainingPages: Lesson[] = [];
      for (let page = 2; page <= pageCount; page += 1) {
        const response = await apiFetch<PaginatedResponse<Lesson>>(`/schedule/range?${query}&page=${page}`);
        remainingPages.push(...response.data);
      }
      const lessons = [...firstPage.data, ...remainingPages];
      if (requestId !== loadSequence.current) return;
      const spaces: PairSpaceSummary[] = [];
      let cursor = 0;
      let failures = 0;
      await Promise.all(Array.from({ length: Math.min(4, lessons.length) }, async () => {
          while (cursor < lessons.length) {
            const lesson = lessons[cursor++];
            try {
              const space = await apiFetch<PairSpaceSummary>(`/pair-spaces/${lesson.id}`);
              spaces.push({ ...space, lessonId: lesson.id });
            } catch {
              failures += 1;
            }
          }
        }));
      if (requestId === loadSequence.current) {
        setDay({lessons,pairSpaces:spaces});
        setPartial(failures);
      }
    } catch (reason: unknown) {
      if (requestId === loadSequence.current) {
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить подготовку к парам.');
      }
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => { loadSequence.current += 1; detailSequence.current += 1; };
  }, []);

  const preparations = useMemo<PreparationWithLesson[]>(() => {
    const lessons = day?.lessons || [];
    return (day?.pairSpaces || []).flatMap((space) =>
      (space.homeworks || []).map((preparation) => ({
        preparation,
        lesson: lessons.find((lesson) => lesson.id === space.lessonId),
      })),
    );
  }, [day]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
    return preparations
      .filter((item) => {
        const text =
          `${item.preparation.title} ${item.preparation.description || ""} ${item.lesson?.subject || ""} ${item.lesson?.groupName || ""}`.toLocaleLowerCase(
            "ru-RU",
          );
        return !normalizedQuery || text.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sort === "subject") {
          return (left.lesson?.subject || "").localeCompare(
            right.lesson?.subject || "",
            "ru-RU",
          );
        }
        return (
          new Date(left.preparation.deadline || "9999-12-31").getTime() -
          new Date(right.preparation.deadline || "9999-12-31").getTime()
        );
      });
  }, [preparations, query, sort]);

  const openDetail = (item: PreparationWithLesson) => {
    const requestId = ++detailSequence.current;
    setSelected(item);
    setDetail(null);
    setDetailError("");
    setDetailLoading(Boolean(item.lesson));
    if (!item.lesson) return;
    apiFetch<PairSpace>(`/pair-spaces/${item.lesson.id}`)
      .then(result => { if (requestId === detailSequence.current) setDetail(result); })
      .catch(reason => { if (requestId === detailSequence.current) setDetailError(reason instanceof Error ? reason.message : "Не удалось загрузить материалы пары."); })
      .finally(() => { if (requestId === detailSequence.current) setDetailLoading(false); });
  };

  const closeDetail = () => {
    detailSequence.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
  };

  if (loading) {
    return (
      <div
        className="mx-auto max-w-[var(--layout-content-max)] space-y-5"
        aria-busy="true"
        aria-label="Загрузка подготовки к парам"
      >
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[var(--layout-content-max)]">
        <RequestState
          title="Не удалось загрузить подготовку к парам"
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  const overdue = visible.filter(item => deadlineState(item.preparation.deadline) === "overdue").length;
  const dueToday = visible.filter(item => deadlineState(item.preparation.deadline) === "today").length;
  const withoutDate = visible.filter(
    (item) => !item.preparation.deadline,
  ).length;

  return (
    <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>

          <h1 className="ds-page-title">Подготовка к парам</h1>

        </div>
        <Link href="/pair-space" className="role-link role-link-primary">Добавить подготовку</Link>
      </header>

      <p className="text-xs text-[var(--color-text-secondary)]">Период · {range} · занятий: {day?.lessons.length ?? 0}</p>
      {partial > 0 && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Не загрузились пространства {partial} занятий. Показаны доступные темы; повторите загрузку для полного списка. {" "}
          <button type="button" onClick={load} className="font-semibold underline">Повторить</button>
        </p>
      )}
      <p className="text-sm text-slate-500" aria-live="polite">{visible.length} материалов · сегодня: {dueToday} · просрочено: {overdue} · без срока: {withoutDate}</p>

      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            aria-label="Поиск подготовки"
            placeholder="Поиск по теме, предмету или группе"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="sm:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            Сортировка
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="min-h-11 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]"
            >
              <option value="date">По дате подготовки</option>
              <option value="subject">По предмету</option>
            </select>
          </label>
        </div>
      </Card>

      <section aria-live="polite">
        {!visible.length ? (
          <EmptyState
            title={
              partial > 0
                ? "Не удалось подтвердить результат"
                : query
                  ? "Подготовка не найдена"
                  : "В этом периоде подготовки нет"
            }
            description={
              partial > 0
                ? "Часть пространств занятий не загрузилась, поэтому список может быть неполным. Повторите загрузку, чтобы проверить результат."
                : query
                  ? "Измените поисковый запрос или сбросьте фильтр."
                  : "Откройте пространство нужной пары и опубликуйте, что группе нужно подготовить."
            }
            action={
              partial > 0 ? (
                <Button variant="secondary" onClick={load}>
                  Повторить загрузку
                </Button>
              ) : query ? (
                <Button variant="secondary" onClick={() => setQuery("")}>
                  Сбросить поиск
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card padding="sm">
            <PreparationList items={visible} onOpen={openDetail} />
          </Card>
        )}
      </section>

      <Sheet
        open={Boolean(selected)}
        onClose={closeDetail}
        title={selected?.preparation.title}
        side="right"
      >
        {selected && (
          <div className="space-y-5">
            <Badge variant="indigo">Подготовка к занятию</Badge>
            <div className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 text-sm">
              <p>
                <span className="text-[var(--color-text-secondary)]">
                  Предмет:
                </span>{" "}
                {selected.lesson?.subject || "Не указан"}
              </p>
              <p>
                <span className="text-[var(--color-text-secondary)]">
                  Группа:
                </span>{" "}
                {selected.lesson?.groupName || "Не указана"}
              </p>
              <p>
                <span className="text-[var(--color-text-secondary)]">
                  Подготовить к:
                </span>{" "}
                {dateLabel(selected.preparation.deadline)}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Что нужно подготовить
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">
                {selected.preparation.description ||
                  "Дополнительный контекст не добавлен."}
              </p>
            </div>
            {detailLoading ? (
              <Skeleton className="h-20" />
            ) : detailError ? <RequestState title="Материалы не загрузились" description={detailError} onRetry={() => openDetail(selected)} /> : detail?.files?.length ? (
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  Материалы к паре
                </h2>
                <div className="mt-2 space-y-2">
                  {detail.files.map((file, index) => (
                    <a
                      key={file.id || index}
                      href={file.fileUrl?.startsWith("https://") ? file.fileUrl : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[var(--radius-md)] border p-3 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-surface-secondary)]"
                    >
                      {file.fileName || "Материал"}{!file.fileUrl?.startsWith("https://") && " · ссылка недоступна"}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Материалы к паре не прикреплены.
              </p>
            )}
            {selected.lesson && (
              <Link
                href={`/pair-space/${selected.lesson.id}`}
                className="block"
              >
                <Button fullWidth>Открыть пространство пары</Button>
              </Link>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
