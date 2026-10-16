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
  const auth = status(user ? true : null);
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
        <div className="flex items-center gap-2 text-xs text-white/60">
          Разработчик <span>/</span>{" "}
          <span className="text-white/80">Обзор</span>
        </div>
        <PageHeader
          eyebrow="Developer workspace"
          title="Состояние системы"
          description="Результаты проверки текущего стенда и доступные доменные события"
          actions={
            <Button variant="secondary" onClick={load} loading={loading} disabled={loading}>
              Обновить
            </Button>
          }
        />
        {failed.length > 0 && <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">Не удалось проверить: {failed.join(', ')}. Повторите загрузку; отсутствие данных не означает отсутствие событий.</p>}
        {checkedAt && <p className="text-xs text-white/60">Последняя проверка · {checkedAt}</p>}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card
                key={metric.label}
                className="border-white/10 bg-white/[0.04]"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-4 h-7 w-20" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card
                key={metric.label}
                className="border-white/10 bg-white/[0.04]"
              >
                <p className="text-xs uppercase tracking-wider text-white/60">
                  {metric.label}
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {metric.value}
                </p>
              </Card>
            ))}
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <Card id="events" className="scroll-mt-24 border-white/10 bg-white/[0.04]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">
                    Поток доменных событий
                  </h2>
                  <p className="mt-1 text-xs text-white/60">
                    Фактически записанные события вашего ВУЗа
                  </p>
                </div>
                <Badge variant={events.length ? "success" : "default"}>
                  {loading ? "Загрузка" : failed.includes("события") ? "Нет данных" : events.length ? "Есть события" : "Пусто"}
                </Badge>
              </div>
              {events.length ? (
                <div className="divide-y divide-white/10">
                  {events
                    .slice(-8)
                    .reverse()
                    .map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="break-all font-mono text-xs text-cyan-200">
                            {event.type}
                          </p>
                          <p className="mt-1 text-xs text-white/60">
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
                <p className="py-10 text-center text-sm text-white/60">
                  {loading ? "Загружаем события…" : failed.includes("события") ? "Поток событий не загрузился. Повторите проверку." : "События появятся после действий в учебных сценариях."}
                </p>
              )}
            </Card>
            <Card className="border-white/10 bg-white/[0.04]">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">
                Последняя активность
              </h2>
              {activity.length ? (
                <div className="mt-3 divide-y divide-white/10">
                  {activity.slice(0, 6).map((item, index) => (
                    <div key={item.id || index} className="py-3">
                      <p className="text-sm text-white/75">
                        {item.title || "Системное событие"}
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        {item.body || "Событие уведомления"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/60">
                  {loading ? "Загружаем уведомления…" : failed.includes("уведомления") ? "Уведомления не загрузились. Повторите проверку." : "Активности пока нет."}
                </p>
              )}
            </Card>
          </div>
          <aside className="space-y-6">
            <Card className="border-white/10 bg-white/[0.04]">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">
                Быстрые действия
              </h2>
              <div className="mt-3 grid gap-2">
                {actions.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                    <span className="float-right text-white/60">→</span>
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="border-white/10 bg-white/[0.04]">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">
                Состояние системы
              </h2>
              <div className="mt-3 divide-y divide-white/10">
                <div className="flex items-center justify-between py-3 text-sm text-white/65">
                  <span>Бэкенд</span>
                  <Badge variant={backend.variant}>{backend.label}</Badge>
                </div>
                <div className="flex items-center justify-between py-3 text-sm text-white/65">
                  <span>База данных</span>
                  <Badge variant={database.variant}>{database.label}</Badge>
                </div>
                <div className="flex items-center justify-between py-3 text-sm text-white/65">
                  <span>Аутентификация</span>
                  <Badge variant={auth.variant}>{auth.label}</Badge>
                </div>
                <div className="flex items-center justify-between py-3 text-sm text-white/65">
                  <span>Вебхуки</span>
                  <Badge variant="default">Неизвестно</Badge>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
