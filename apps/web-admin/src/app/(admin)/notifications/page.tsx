"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiFetchList } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  RequestState,
  Skeleton,
} from "@/components/ui";

type Category =
  | "all"
  | "important"
  | "schedule"
  | "homework"
  | "teachers"
  | "system";
interface Notification {
  id: string;
  title?: string;
  body?: string;
  category?: Category;
  priority?: string;
  deepLink?: string;
  createdAt?: string;
  isRead?: boolean;
}
const filters: Array<{ id: Category; label: string }> = [
  { id: "all", label: "Все" },
  { id: "important", label: "Важное" },
  { id: "schedule", label: "Расписание" },
  { id: "homework", label: "Подготовка" },
  { id: "teachers", label: "Преподаватели" },
  { id: "system", label: "Система" },
];
const time = (value?: string) =>
  value
    ? new Date(value).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Только что";

export default function UniversityNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [readingId, setReadingId] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    apiFetchList<Notification>("/notifications")
      .then(setItems)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить события ВУЗа.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const visible = useMemo(
    () =>
      category === "all"
        ? items
        : items.filter((item) => item.category === category),
    [items, category],
  );
  const unread = items.filter((item) => !item.isRead).length;
  const markRead = async (id: string) => {
    const item = items.find((current) => current.id === id);
    if (!item || item.isRead) return;
    setReadingId(id);
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      setItems((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, isRead: true } : entry,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось обновить уведомление.",
      );
    } finally {
      setReadingId("");
    }
  };
  const markAll = async () => {
    setReadingId("all");
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось отметить события прочитанными.",
      );
    } finally {
      setReadingId("");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-sky-700">Кабинет ВУЗа</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            События ВУЗа
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Операционные сигналы, изменения учебного процесса и задачи, которые
            требуют решения.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={unread ? "red" : "slate"}>
            {unread ? `${unread} непрочитанных` : "Всё прочитано"}
          </Badge>
          {unread > 0 && (
            <Button
              size="sm"
              variant="secondary"
              loading={readingId === "all"}
              onClick={markAll}
            >
              Прочитать все
            </Button>
          )}
        </div>
      </div>
      <div
        role="tablist"
        aria-label="Категории событий"
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={category === filter.id}
            onClick={() => setCategory(filter.id)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${category === filter.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : error ? (
        <RequestState
          title="Не удалось загрузить события"
          description={error}
          onRetry={load}
        />
      ) : !visible.length ? (
        <EmptyState
          title="В этой категории событий нет"
          description="Новые сигналы учебного процесса появятся здесь."
        />
      ) : (
        <Card padding="sm">
          <div className="divide-y divide-slate-100">
            {visible.map((item) => (
              <article
                key={item.id}
                className={`flex gap-3 py-4 first:pt-1 ${!item.isRead ? "rounded-lg bg-sky-50/50 px-2" : ""}`}
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? "bg-slate-200" : item.priority === "urgent" || item.priority === "high" ? "bg-red-500" : "bg-sky-600"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title || "Системное событие"}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {item.body || "Подробности события недоступны."}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-400">
                      {time(item.createdAt)}
                    </time>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.deepLink && (
                      <Link
                        href={item.deepLink}
                        onClick={() => markRead(item.id)}
                        className="inline-flex min-h-9 items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        Открыть задачу →
                      </Link>
                    )}
                    {!item.isRead && (
                      <button
                        type="button"
                        disabled={readingId === item.id}
                        onClick={() => markRead(item.id)}
                        className="min-h-9 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {readingId === item.id
                          ? "Сохраняем…"
                          : "Отметить прочитанным"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
