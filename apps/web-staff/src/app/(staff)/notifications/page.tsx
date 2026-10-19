"use client";

import Link from "next/link";
import { useWorkspaceQuery } from "@napare/ui/workspace-shell";
import { AttentionNavigation } from "../AttentionNavigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, markAllRead, markNotificationRead, type PaginatedResponse } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  RequestState,
  Skeleton,
} from "@/components/ui";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  category?:
    | "all"
    | "important"
    | "schedule"
    | "homework"
    | "teachers"
    | "system";
  isRead: boolean;
  createdAt: string;
  deepLink?: string;
  actions?: Array<{ label: string; href: string }>;
  priority?: string;
  data?: Record<string, unknown>;
}
type Filter =
  | "all"
  | "important"
  | "schedule"
  | "homework"
  | "teachers"
  | "system";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "important", label: "Важное" },
  { id: "schedule", label: "Расписание" },
  { id: "homework", label: "Подготовка" },
  { id: "teachers", label: "Преподаватели" },
  { id: "system", label: "Система" },
];

function timeAgo(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "только что";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`;
  return new Date(value).toLocaleDateString("ru-RU");
}
function actorName(notification: Notification) {
  const data = notification.data || {};
  return String(
    data.studentName || data.actorName || data.authorName || "НаПаре",
  );
}
function actionFor(notification: Notification) {
  return (
    notification.actions?.[0] ||
    (notification.deepLink
      ? { label: "Открыть", href: notification.deepLink }
      : null)
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreadCountLoading, setUnreadCountLoading] = useState(true);
  const [unreadCountError, setUnreadCountError] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const requestSequence = useRef(0);
  const changeFilter = (value: Filter) => {
    setFilter(value);
    setPage(1);
  };
  useWorkspaceQuery({filter},params=>changeFilter(filters.some(item=>item.id===params.get('filter'))?params.get('filter') as Filter:'all'));

  const load = useCallback(() => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setUnreadCountLoading(true);
    setUnreadCountError(false);
    setError("");
    apiFetch<PaginatedResponse<Notification>>(`/notifications?page=${page}&limit=50`)
      .then((response) => {
        if (requestId !== requestSequence.current) return;
        setNotifications(response.data);
        setTotal(response.meta?.total ?? response.data.length);
        setPages(Math.max(1, response.meta?.totalPages ?? 1));
        setUnreadCount(response.data.filter((item) => !item.isRead).length);
        void apiFetch<number>("/notifications/unread-count")
          .then((count) => {
            if (requestId !== requestSequence.current) return;
            setUnreadCount(count);
            setUnreadCountError(false);
          })
          .catch(() => {
            if (requestId === requestSequence.current) setUnreadCountError(true);
          })
          .finally(() => {
            if (requestId === requestSequence.current) setUnreadCountLoading(false);
          });
      })
      .catch((err) =>
        {
          if (requestId !== requestSequence.current) return;
          setError(err instanceof Error ? err.message : "Не удалось загрузить уведомления.");
          setUnreadCountError(true);
          setUnreadCountLoading(false);
        },
      )
      .finally(() => { if (requestId === requestSequence.current) setLoading(false); });
  }, [page]);
  useEffect(() => {
    load();
    return () => { requestSequence.current += 1; };
  }, [load]);
  const unread = unreadCount;
  const visible = useMemo(()=>notifications.filter(item=>filter==='all'||(filter==='important'?item.category==='important'||['high','urgent'].includes(item.priority||''):item.category===filter)).sort((a,b)=>(b.priority==='urgent'?2:b.priority==='high'?1:0)-(a.priority==='urgent'?2:a.priority==='high'?1:0)||Number(a.isRead)-Number(b.isRead)||b.createdAt.localeCompare(a.createdAt)),[filter,notifications]);
  const markRead = async (id: string) => {
    if(busy) return; setBusy(id); setActionError("");
    try {
      await markNotificationRead(id);
      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setActionError("Не удалось отметить событие прочитанным. Повторите действие.");
    } finally {setBusy("");}
  };
  const markEverythingRead = async () => {
    if(busy) return; setBusy("all"); setActionError("");
    try {
      await markAllRead();
      setNotifications((items) =>
        items.map((item) => ({ ...item, isRead: true })),
      );
      setUnreadCount(0);
      setUnreadCountError(false);
    } catch {
      setActionError("Не удалось отметить уведомления прочитанными.");
    } finally {setBusy("");}
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Уведомления
          </h1>
          <p
            role="status"
            aria-live="polite"
            className={`mt-1 text-sm ${unreadCountError ? "text-amber-700" : "text-slate-500"}`}
          >
            {loading
              ? "Загружаем события…"
              : unreadCountLoading
                ? "Обновляем счётчик непрочитанных…"
                : unreadCountError
                  ? `Общий счётчик недоступен. На этой странице: ${unread}.`
                  : unread
                    ? `${unread} непрочитанных`
                    : "Все уведомления прочитаны"}
          </p>
        </div>
        {(unread > 0 || unreadCountError) && (
          <Button variant="ghost" size="sm" onClick={markEverythingRead} disabled={Boolean(busy)} loading={busy === "all"}>
            Отметить все прочитанными
          </Button>
        )}
      </div>
      <AttentionNavigation active="notifications" />
      <div
        role="group"
        aria-label="Фильтры уведомлений"
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => changeFilter(item.id)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${filter === item.id ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <Skeleton className="h-20" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <RequestState
          title="Не удалось загрузить уведомления"
          description={error}
          onRetry={load}
        />
      ) : !visible.length ? (
        <EmptyState
          title={notifications.length ? "На этой странице нет уведомлений в выбранном разделе" : "Нет уведомлений"}
          description={
            notifications.length
              ? "Перейдите на другую страницу списка или выберите другой раздел."
              : filter === "all"
                ? "Здесь появятся события учебного процесса."
                : "В этом разделе пока нет событий."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[180px_minmax(0,1fr)_100px_190px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid">
            <span>Кто</span>
            <span>Событие</span>
            <span>Время</span>
            <span>Действие</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visible.map((notification) => {
              const action = actionFor(notification);
              return (
                <div
                  key={notification.id}
                  className={`grid gap-3 px-4 py-4 xl:grid-cols-[150px_minmax(0,1fr)_100px_210px] md:items-center md:gap-4 md:px-5 ${!notification.isRead ? "bg-sky-50/40" : ""}`}
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                      Кто
                    </span>
                    <p className="mt-1 text-sm font-semibold text-slate-800 md:mt-0">
                      {actorName(notification)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {notification.title}
                        </p>{["high","urgent"].includes(notification.priority || "") && <Badge variant="red" className="mt-2">{notification.priority === "urgent" ? "Срочно" : "Важно"}</Badge>}
                        <p className="mt-1 text-sm leading-5 text-slate-500">
                          {notification.body}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                      Время
                    </span>
                    <p className="mt-1 text-xs text-slate-500 md:mt-0">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:flex-col xl:items-start">
                    {action && (
                      <Link
                        href={action.href}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                      >
                        {action.label} →
                      </Link>
                    )}
                    {!notification.isRead && <button type="button" disabled={Boolean(busy)} onClick={()=>void markRead(notification.id)} className="min-h-11 rounded-lg px-2.5 text-xs font-semibold text-slate-600">{busy===notification.id?"Сохраняем…":"Отметить прочитанным"}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!loading && !error && pages > 1 && (
        <nav aria-label="Страницы уведомлений" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {total.toLocaleString("ru-RU")} событий · страница {page} из {pages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={page <= 1 || Boolean(busy)} onClick={() => setPage(value => Math.max(1, value - 1))}>
              Назад
            </Button>
            <Button variant="secondary" disabled={page >= pages || Boolean(busy)} onClick={() => setPage(value => Math.min(pages, value + 1))}>
              Дальше
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
