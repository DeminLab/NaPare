"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
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

function isUpcoming(value?: string): boolean {
  return Boolean(
    value && new Date(value).getTime() >= new Date().setHours(0, 0, 0, 0),
  );
}

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
          className="group flex w-full items-start gap-3 px-1 py-4 text-left transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]"
        >
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-brand)]"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--color-text)]">
                {item.preparation.title}
              </span>
              <Badge variant="indigo">Подготовка</Badge>
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

  const load = () => {
    setLoading(true);
    setError("");
    apiFetch<MyDayResponse>("/my-day")
      .then(setDay)
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось загрузить подготовку к парам.",
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
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
          `${item.preparation.title} ${item.preparation.description || ""} ${item.lesson?.subject || ""}`.toLocaleLowerCase(
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
    setSelected(item);
    setDetail(null);
    if (!item.lesson) return;
    setDetailLoading(true);
    apiFetch<PairSpace>(`/pair-spaces/${item.lesson.id}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
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

  const upcoming = preparations.filter((item) =>
    isUpcoming(item.preparation.deadline),
  ).length;
  const withoutDate = preparations.filter(
    (item) => !item.preparation.deadline,
  ).length;

  return (
    <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.1em] text-[var(--color-brand)]">
            Контур преподавателя
          </p>
          <h1 className="ds-page-title">Подготовка к парам</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-secondary)]">
            Ориентиры для конкретных занятий: что прочитать, принести или
            подготовить группе. Сдача работ и оценки остаются в Moodle.
          </p>
        </div>
        <Link href="/pair-space">
          <Button>Открыть пространство пары</Button>
        </Link>
      </header>

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Сводка подготовки"
      >
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Опубликовано
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {preparations.length}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            в пространствах пар на сегодня
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            С указанной датой
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {upcoming}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            помогают спланировать пару
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Без даты
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {withoutDate}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            общие ориентиры для группы
          </p>
        </Card>
      </section>

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
              query ? "Подготовка не найдена" : "Подготовки на сегодня пока нет"
            }
            description={
              query
                ? "Измените поисковый запрос или сбросьте фильтр."
                : "Откройте пространство нужной пары и опубликуйте, что группе нужно подготовить."
            }
            action={
              query ? (
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
        onClose={() => setSelected(null)}
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
            ) : detail?.files?.length ? (
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  Материалы к паре
                </h2>
                <div className="mt-2 space-y-2">
                  {detail.files.map((file, index) => (
                    <a
                      key={file.id || index}
                      href={file.fileUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[var(--radius-md)] border p-3 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-surface-secondary)]"
                    >
                      {file.fileName || "Материал"}
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
