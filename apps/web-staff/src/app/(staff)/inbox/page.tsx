"use client";


import { AttentionNavigation } from "../AttentionNavigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceQuery } from "@napare/ui/workspace-shell";
import { apiFetch } from "@/lib/api";
import {
  Badge,
  Button,
  EmptyState,
  RequestState,
  Skeleton,
} from "@/components/ui";

interface InboxItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: "open" | "snoozed" | "done";
  createdAt: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueAt?: string | null;
  deepLink?: string;
}
const INBOX_PAGE_SIZE = 100;
const priorityRank = (item: InboxItem) => item.priority === 'urgent' ? 3 : item.priority === 'high' ? 2 : item.priority === 'normal' ? 1 : 0;
const category = (type: string) =>
  type.includes("message")
    ? "Сообщения"
    : type.includes("absence")
      ? "Посещаемость"
      : type.includes("lesson") || type.includes("room")
        ? "Расписание"
        : type.includes("homework")
          ? "Подготовка к парам"
          : "Системные действия";

function eventHref(value?:string){
  if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/staff/notifications';
  const url=new URL(value,'https://workspace.invalid');
  if(url.origin!=='https://workspace.invalid')return '/staff/notifications';
  const path=url.pathname.startsWith('/staff/')||url.pathname==='/staff'?url.pathname:'/staff'+url.pathname;
  return path+url.search+url.hash;
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<InboxItem["status"]>("open");
  const [savingId, setSavingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const queryReady = useWorkspaceQuery({ status: filter }, query => {
    const value = query.get("status");
    setFilter(value === "done" || value === "snoozed" ? value : "open");
  });
  const loadController = useRef<AbortController | null>(null);
  const loadMoreController = useRef<AbortController | null>(null);
  const cancelLoadMore = useCallback(() => {
    loadMoreController.current?.abort();
    loadMoreController.current = null;
    setLoadingMore(false);
  }, []);
  const load = useCallback(() => {
    if (!queryReady) return;
    loadController.current?.abort();
    cancelLoadMore();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setError("");
    setHasMore(false);
    setLoadMoreError("");
    apiFetch<InboxItem[]>("/notifications/inbox?status=" + filter + "&limit=" + INBOX_PAGE_SIZE, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setItems(value); setHasMore(value.length === INBOX_PAGE_SIZE); } })
      .catch((err) => {
        if (!controller.signal.aborted) setError(
          err instanceof Error ? err.message : "Не удалось загрузить входящие.",
        );
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [cancelLoadMore, filter, queryReady]);
  const loadMore = useCallback(async () => {
    if (!loadController.current || loadController.current.signal.aborted || loadMoreController.current || loadingMore || !hasMore) return;
    const controller = new AbortController();
    loadMoreController.current = controller;
    setLoadingMore(true);
    setLoadMoreError("");
    try {
      const value = await apiFetch<InboxItem[]>(
        "/notifications/inbox?status=" + filter + "&limit=" + INBOX_PAGE_SIZE + "&offset=" + items.length,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted && loadMoreController.current === controller) {
        setItems(previous => {
          const knownIds = new Set(previous.map(item => item.id));
          return [...previous, ...value.filter(item => !knownIds.has(item.id))];
        });
        setHasMore(value.length === INBOX_PAGE_SIZE);
      }
    } catch (err) {
      if (!controller.signal.aborted && loadMoreController.current === controller) setLoadMoreError(err instanceof Error ? err.message : "Не удалось загрузить предыдущие действия.");
    } finally {
      if (loadMoreController.current === controller) {
        loadMoreController.current = null;
        setLoadingMore(false);
      }
    }
  }, [filter, hasMore, items.length, loadingMore]);
  useEffect(() => {
    load();
    return () => {
      loadController.current?.abort();
      cancelLoadMore();
    };
  }, [load]);
  const complete = async (id: string) => {
    setSavingId(id); setActionError(""); setActionStatus("");
    try {
      await apiFetch("/notifications/inbox/" + id + "/complete", { method: "PATCH" });
      cancelLoadMore();
      setItems(previous => previous.filter(item => item.id !== id));
      setActionStatus("Пункт отмечен разобранным. Он доступен в списке «Разобраны».");
    } catch { setActionError("Не удалось изменить статус. Пункт остался в списке — попробуйте ещё раз."); }
    finally { setSavingId(""); }
  };
  const grouped = useMemo(
    () =>
      [...items].sort((a,b) => priorityRank(b)-priorityRank(a) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || b.createdAt.localeCompare(a.createdAt)).reduce<Record<string, InboxItem[]>>((result, item) => {
        const key = category(item.type);
        (result[key] ||= []).push(item);
        return result;
      }, {}),
    [items],
  );
  return (
    <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
      <div>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Центр внимания
        </h1>

      </div>
      <AttentionNavigation active="tasks" />
      <div role="group" aria-label="Статус действий" className="flex gap-2 overflow-x-auto">{([{ id: "open", label: "Открытые" }, { id: "snoozed", label: "Отложены" }, { id: "done", label: "Разобраны" }] as const).map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => { setActionError(""); setActionStatus(""); setSearch(""); setFilter(item.id); }} className={"min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold " + (filter === item.id ? "border-indigo-700 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600")}>{item.label}</button>)}</div>

      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      {actionStatus && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">{actionStatus}</p>}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : error ? (
        <RequestState
          title="Не удалось загрузить входящие"
          description={error}
          onRetry={load}
        />
      ) : !items.length ? (
        <EmptyState
          title={filter === "open" ? "Нет действий, ожидающих внимания" : filter === "done" ? "Разобранных действий пока нет" : "Отложенных действий нет"}
          description="Новые события доступны в разделе «Все уведомления»."
        />
      ) : (
        <div className="space-y-3"><label className="block"><span className="sr-only">Поиск событий</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Найти событие…" className="min-h-11 w-full rounded-xl border bg-white px-3 text-sm" /></label>{search && hasMore && <p className="text-xs text-slate-500">Поиск охватывает {items.length} загруженных действий. Загрузите ещё, чтобы искать в более ранних.</p>}{Object.values(grouped).flat().filter(item => `${item.title} ${item.description}`.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU'))).map(item => <article
                    key={item.id}
                    aria-labelledby={`inbox-item-${item.id}`}
                    className={`overflow-hidden rounded-xl border bg-white px-4 py-3 ${item.status === "open" ? "border-l-2 border-l-indigo-500 bg-indigo-50/30" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h2 id={`inbox-item-${item.id}`} className="text-sm font-semibold text-slate-900">{item.title}</h2>
                          <span className="text-xs font-normal text-slate-500">{category(item.type)}</span>
                          {(item.priority === 'high' || item.priority === 'urgent') && <Badge variant="red">{item.priority === 'urgent' ? 'Срочно' : 'Важно'}</Badge>}
                        </div>
                        <p className="mt-1 break-words text-sm text-slate-600">{item.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-slate-500">
                          {item.status === "done"
                            ? "Разобрано"
                            : item.status === "snoozed"
                              ? "Отложено"
                              : "Открыто"}
                        </span>
                        <time dateTime={item.createdAt} className="mt-1 block shrink-0 text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                        </time>
                      </div>
                    </div>
                    {item.dueAt && <p className="mt-2 text-xs font-medium text-slate-600">Срок · {new Date(item.dueAt).toLocaleString('ru-RU', { day:'numeric',month:'short',hour:'2-digit',minute:'2-digit' })}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2"><a href={eventHref(item.deepLink)} className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-indigo-700">Открыть событие</a>{item.status !== "done" && <Button variant="ghost" size="sm" disabled={!!savingId} onClick={() => void complete(item.id)}>{savingId === item.id ? "Сохраняем…" : "Отметить разобранным"}</Button>}</div>
</article>)}{search && !items.some(item => `${item.title} ${item.description}`.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU'))) && <p className="py-4 text-sm text-slate-500">Событий не найдено.</p>}{loadMoreError && <p role="alert" className="text-sm text-red-700">Не удалось загрузить предыдущие действия: {loadMoreError}</p>}{hasMore && <div className="flex justify-center pt-2"><Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Загружаем…" : "Загрузить ещё"}</Button></div>}</div>
      )}
    </div>
  );
}
