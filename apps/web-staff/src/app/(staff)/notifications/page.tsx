"use client";

import Link from "next/link";
import { useWorkspaceQuery } from "@napare/ui/workspace-shell";
import { AttentionNavigation } from "../AttentionNavigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetchList, markAllRead, markNotificationRead } from "@/lib/api";
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
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  useWorkspaceQuery({filter},params=>setFilter(filters.some(item=>item.id===params.get('filter'))?params.get('filter') as Filter:'all'));

  const load = () => {
    setLoading(true);
    setError("");
    apiFetchList<Notification>("/notifications")
      .then(setNotifications)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить уведомления.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const unread = notifications.filter((item) => !item.isRead).length;
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
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Загружаем события…" : unread ? `${unread} непрочитанных` : "Все уведомления прочитаны"}
          </p>
        </div>
        {unread > 0 && (
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
            onClick={() => setFilter(item.id)}
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
          title="Нет уведомлений"
          description={
            filter === "all"
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
                        className="inline-flex min-h-9 items-center rounded-lg px-2.5 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50"
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
    </div>
  );
}
