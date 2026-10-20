"use client";

import Link from "next/link";
import { useWorkspaceQuery } from "@napare/ui/workspace-shell";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiFetchAllPages } from "@/lib/api";
import { ListPagination } from "@/components/ListPagination";
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
    : "Дата не указана";

export default function UniversityNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [readingId, setReadingId] = useState("");
  const [view, setView] = useState('unread');
  const [actionError, setActionError] = useState('');
  useWorkspaceQuery({ category, view }, params => { const value = params.get('category'); setCategory(filters.some(filter => filter.id === value) ? value as Category : 'all'); setView(params.get('view') === 'history' ? 'history' : 'unread'); });
  const load = () => {
    setLoading(true);
    setError("");
    apiFetchAllPages<Notification>("/notifications")
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
  const visible = useMemo(() => items.filter(item => (view === 'history' ? item.isRead : !item.isRead) && (category === 'all' || (category === 'important' ? ['urgent', 'high'].includes(item.priority || '') : item.category === category))).sort((a,b) => {
    const priority = (item: Notification) => item.priority === 'urgent' ? 2 : item.priority === 'high' ? 1 : 0;
    return priority(b) - priority(a) || (b.createdAt || '').localeCompare(a.createdAt || '');
  }), [items, category, view]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [category, view]);
  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(visible.length / pageSize))));
  }, [visible.length]);
  const unread = items.filter((item) => !item.isRead).length;
  const markRead = async (id: string) => {
    const item = items.find((current) => current.id === id);
    if (!item || item.isRead) return;
    setReadingId(id);
    setActionError("");
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      setItems((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, isRead: true } : entry,
        ),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Не удалось обновить уведомление.",
      );
    } finally {
      setReadingId("");
    }
  };
  const markAll = async () => {
    setReadingId("all");
    setActionError("");
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Не удалось отметить события прочитанными.",
      );
    } finally {
      setReadingId("");
    }
  };

  return (
    <div className="mx-auto max-w-[var(--layout-content-max)] space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">Кабинет ВУЗа · центр событий</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            События ВУЗа
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Важные события и сообщения системы в одном месте.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={unread ? "red" : "slate"}>
            {unread ? `${unread} непрочитанных` : "Всё прочитано"}
          </Badge>
          {unread > 0 && (
            <Button
              size="sm"
              variant="primary"
              loading={readingId === "all"}
              disabled={Boolean(readingId)}
              onClick={markAll}
            >
              Прочитать все
            </Button>
          )}
        </div>
      </div>
      <Card padding="sm" className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Просмотр событий">{[{ id: 'unread', label: `Непрочитанные · ${unread}` }, { id: 'history', label: 'История прочитанного' }].map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${view === item.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-sm' : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)]'}`}>{item.label}</button>)}</div>
        <div role="group" aria-label="Категории событий" className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={category === filter.id}
            onClick={() => setCategory(filter.id)}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors ${category === filter.id ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]" : "text-[var(--color-text-secondary)] hover:bg-slate-50 hover:text-[var(--color-text)]"}`}
          >
            {filter.label}
          </button>
        ))}
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">Просмотр события не меняет решение по обращению.</p>
      </Card>
      {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
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
          title={view === "unread" ? "Непрочитанных событий нет" : "История пока пуста"}
          description="Выберите другую категорию или переключитесь между непрочитанными событиями и историей."
        />
      ) : (
        <div className="space-y-3">
            {pageItems.map((item) => (
              <article
                key={item.id}
                className={`flex gap-3 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md sm:gap-4 sm:p-5 ${!item.isRead ? "border-[var(--color-brand)]/20 bg-white" : "border-[var(--color-border)] bg-white"}`}
              >
                <span
                  aria-label={item.isRead ? "Прочитано" : "Не прочитано"}
                  className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ${item.isRead ? "bg-slate-300 ring-slate-100" : item.priority === "urgent" || item.priority === "high" ? "bg-red-500 ring-red-50" : "bg-[var(--color-brand)] ring-[var(--color-brand-soft)]"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text)] sm:text-base">
                        {item.title || "Системное событие"}
                      </p>
                      <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--color-text-secondary)]">
                        {item.body || "Подробности события недоступны."}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                      {time(item.createdAt)}
                    </time>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.deepLink && (
                      <Link
                        href={item.deepLink}
                        className="inline-flex min-h-10 items-center rounded-lg bg-[var(--color-brand)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--color-brand-strong)]"
                      >
                        Открыть связанный раздел →
                      </Link>
                    )}
                    {!item.isRead && (
                      <button
                        type="button"
                        disabled={Boolean(readingId)}
                        onClick={() => markRead(item.id)}
                        className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-slate-50 disabled:opacity-50"
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
      )}
      {!loading && !error && visible.length > 0 && <ListPagination page={currentPage} pageSize={pageSize} total={visible.length} onChange={setPage} />}
    </div>
  );
}
