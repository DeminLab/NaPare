"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, getHealth, getUser } from "@/lib/api";
import type { HealthInfo, UserInfo } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Skeleton } from "@/components/ui";

interface Notice {
  id?: string;
  title?: string;
  body?: string;
}
interface PlatformEvent {
  id: string;
  type: string;
  timestamp: string;
  priority?: string;
}

const status = (online: boolean | null) => {
  if (online === null)
    return { label: "Неизвестно", variant: "default" as const };
  return online
    ? { label: "Работает", variant: "success" as const }
    : { label: "Недоступно", variant: "danger" as const };
};

export default function DeveloperOverviewPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activity, setActivity] = useState<Notice[]>([]);
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [checkedAt, setCheckedAt] = useState("");

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      getHealth(), getUser(),
      apiFetch<Notice[] | { data: Notice[] }>("/notifications").then(response => Array.isArray(response) ? response : response.data),
      apiFetch<PlatformEvent[]>("/events"),
    ]);
    const unavailable: string[] = [];
    const value = <T,>(index: number, label: string, fallback: T): T => {
      const result = results[index];
      if (result.status === 'fulfilled') return result.value as T;
      unavailable.push(label); return fallback;
    };
    setHealth(value<HealthInfo | null>(0, 'API', null));
    setUser(value<UserInfo | null>(1, 'аккаунт', null));
    setActivity(value<Notice[]>(2, 'уведомления', []));
    setEvents(value<PlatformEvent[]>(3, 'события', []));
    setFailed(unavailable);
    setCheckedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const backend = status(
    health ? ["ok", "healthy"].includes(health.status.toLowerCase()) : null,
  );
  const database = status(health?.database ? health.database === "ok" : null);
  const accountCheck = user
    ? { label: "Данные получены", variant: "success" as const }
    : failed.includes("аккаунт")
      ? { label: "Не удалось проверить", variant: "danger" as const }
      : { label: "Неизвестно", variant: "default" as const };
  const metrics = [
    { label: "Статус API", value: backend.label },
    { label: "События потока", value: failed.includes('события') ? 'Нет данных' : events.length },
    { label: "Уведомления", value: failed.includes('уведомления') ? 'Нет данных' : activity.length },
    {
      label: "Критичные события",
      value: failed.includes('события') ? 'Нет данных' : events.filter(
        (event) => event.priority === "high" || event.priority === "urgent",
      ).length,
    },
  ];
  const actions = [
    { label: 'Управление платформой', href: '/control' },
    { label: "API Explorer", href: "/api" },
    { label: "Документация", href: "/docs" },
    { label: "Архитектура", href: "/architecture" },
    { label: "Сессии", href: "/session" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Состояние системы"
          actions={
            <Button variant="secondary" onClick={load} loading={loading} disabled={loading}>
              Обновить
            </Button>
          }
        />
        {failed.length > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Не удалось проверить: {failed.join(', ')}. Повторите загрузку; отсутствие данных не означает отсутствие событий.</p>}
        {checkedAt && <p className="text-xs text-[var(--color-text-secondary)]">Последняя проверка · {checkedAt}</p>}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card
                key={metric.label}
                className="border-[var(--color-border)] bg-white"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-4 h-7 w-20" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="system-metrics">
            {metrics.map((metric) => (
              <Card
                key={metric.label}
                className="border-[var(--color-border)] bg-white"
              >
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {metric.label}
                </p>
                <p className="mt-3 text-2xl font-bold text-[var(--color-text)]">
                  {metric.value}
                </p>
              </Card>
            ))}
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <Card id="events" className="scroll-mt-24 border-[var(--color-border)] bg-white">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Поток доменных событий
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Фактически записанные события вашего ВУЗа
                  </p>
                </div>
                <Badge variant={events.length ? "success" : "default"}>
                  {loading ? "Загрузка" : failed.includes("события") ? "Нет данных" : events.length ? "Есть события" : "Пусто"}
                </Badge>
              </div>
              {events.length ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {events
                    .slice(-8)
                    .reverse()
                    .map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="break-all font-mono text-xs text-cyan-800">
                            {event.type}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {new Date(event.timestamp).toLocaleString("ru-RU")}
                          </p>
                        </div>
                        <Badge
                          variant={
                            event.priority === "high" ||
                            event.priority === "urgent"
                              ? "danger"
                              : "default"
                          }
                        >
                          {event.priority || "normal"}
                        </Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="py-3 text-sm text-[var(--color-text-secondary)]">
                  {loading ? "Загружаем события…" : failed.includes("события") ? "Поток событий не загрузился. Повторите проверку." : "Новых событий нет"}
                </p>
              )}
            </Card>
            <Card className="border-[var(--color-border)] bg-white">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Последняя активность
              </h2>
              {activity.length ? (
                <div className="mt-3 divide-y divide-[var(--color-border)]">
                  {activity.slice(0, 6).map((item, index) => (
                    <div key={item.id || index} className="py-3">
                      <p className="text-sm text-[var(--color-text)]">
                        {item.title || "Системное событие"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {item.body || "Событие уведомления"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                  {loading ? "Загружаем уведомления…" : failed.includes("уведомления") ? "Уведомления не загрузились. Повторите проверку." : "Активности пока нет."}
                </p>
              )}
            </Card>
          </div>
          <aside className="space-y-6">
            <Card className="border-[var(--color-border)] bg-white">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Быстрые действия
              </h2>
              <div className="mt-3 grid gap-2">
                {actions.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-text)]"
                  >
                    {item.label}
                    <span className="float-right text-[var(--color-text-secondary)]">→</span>
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="border-[var(--color-border)] bg-white">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Состояние системы
              </h2>
              <div className="mt-3 divide-y divide-[var(--color-border)]">
                <div className="flex items-center justify-between py-3 text-sm text-[var(--color-text-secondary)]">
                  <span>Бэкенд</span>
                  <Badge variant={backend.variant}>{backend.label}</Badge>
                </div>
                <div className="flex items-center justify-between py-3 text-sm text-[var(--color-text-secondary)]">
                  <span>База данных</span>
                  <Badge variant={database.variant}>{database.label}</Badge>
                </div>
                <div className="flex items-center justify-between py-3 text-sm text-[var(--color-text-secondary)]">
                  <span>Проверка аккаунта</span>
                  <Badge variant={accountCheck.variant}>{accountCheck.label}</Badge>
                </div>
                <div className="flex items-center justify-between py-3 text-sm text-[var(--color-text-secondary)]">
                  <span>Вебхуки</span>
                  <Badge variant="default">Нет телеметрии</Badge>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
