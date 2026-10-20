"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, apiFetchList } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  RequestState,
  Skeleton,
} from "@/components/ui";

interface Connector {
  id: string;
  name: string;
  type: string;
  status: "active" | "inactive" | "error" | "syncing" | "configured" | string;
  updatedAt?: string;
  baseUrl?: string;
  tokenConfigured?: boolean;
  capabilities?: { scheduleSync?: boolean; learningManagement?: boolean };
}
interface SyncResult {
  timestamp: string;
  lessons: number;
  groups: number;
  imported: number;
  updated: number;
  studentsLinked: number;
}
interface MoodleTestResult {
  siteName: string | null;
  userName: string | null;
  release: string | null;
}

const typeLabels: Record<string, string> = {
  api: "API",
  file: "Файловый импорт",
  lms: "Учебная система",
};
function statusInfo(status: string) {
  if (status === "active")
    return { label: "Работает", variant: "green" as const };
  if (status === "configured")
    return { label: "Ожидает проверки", variant: "amber" as const };
  if (status === "syncing")
    return { label: "Синхронизация", variant: "amber" as const };
  if (status === "error") return { label: "Ошибка", variant: "red" as const };
  return { label: "Отключён", variant: "slate" as const };
}
function isSecureMoodleUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [moodle, setMoodle] = useState({ baseUrl: "", token: "" });
  const load = () => {
    setLoading(true);
    setError("");
    apiFetchList<Connector>("/admin/connectors")
      .then((items) => {
        setConnectors(items);
        const configured = items.find((item) => item.id === "moodle");
        if (configured?.baseUrl)
          setMoodle((current) => ({
            ...current,
            baseUrl: configured.baseUrl || "",
          }));
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить коннекторы.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const counts = useMemo(
    () => ({
      active: connectors.filter((item) => item.status === "active").length,
      inactive: connectors.filter((item) => item.status === "inactive").length,
      errors: connectors.filter((item) => item.status === "error").length,
      configured: connectors.filter((item) => item.status === "configured").length,
      syncing: connectors.filter((item) => item.status === "syncing").length,
    }),
    [connectors],
  );
  const startAction = (id: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusyId(id);
    setError("");
    setMessage("");
    return true;
  };
  const finishAction = () => {
    busyRef.current = false;
    setBusyId("");
  };
  const persistStatus = async (
    connector: Connector,
    status: "active" | "inactive",
  ) => {
    if (!startAction(connector.id)) return;
    try {
      const saved = await apiFetch<Connector>(
        `/admin/connectors/${connector.id}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setConnectors((items) =>
        items.map((item) =>
          item.id === connector.id ? { ...item, ...saved } : item,
        ),
      );
      setMessage(
        status === "active"
          ? `${connector.name} включён.`
          : `${connector.name} отключён.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось изменить состояние коннектора.",
      );
    } finally {
      finishAction();
    }
  };
  const sync = async (connector: Connector) => {
    if (!startAction(connector.id)) return;
    try {
      const result = await apiFetch<SyncResult>("/admin/schedule/sync", {
        method: "POST",
      });
      setConnectors((items) =>
        items.map((item) =>
          item.id === connector.id
            ? { ...item, status: "active", updatedAt: result.timestamp }
            : item,
        ),
      );
      setMessage(
        `Синхронизация завершена: ${result.imported} добавлено, ${result.updated} обновлено; групп — ${result.groups}, привязано студентов — ${result.studentsLinked}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось запустить синхронизацию.",
      );
    } finally {
      finishAction();
    }
  };
  const configureMoodle = async () => {
    if (!startAction("moodle-configure")) return;
    try {
      const saved = await apiFetch<{ baseUrl: string }>(
        "/admin/connectors/moodle/configure",
        { method: "POST", body: JSON.stringify(moodle) },
      );
      setMoodle((current) => ({
        ...current,
        baseUrl: saved.baseUrl,
        token: "",
      }));
      setConnectors((items) =>
        items.map((item) =>
          item.id === "moodle"
            ? {
                ...item,
                status: "configured",
                baseUrl: saved.baseUrl,
                tokenConfigured: true,
              }
            : item,
        ),
      );
      setMessage(
        "Параметры Moodle сохранены в зашифрованном виде. Теперь проверьте подключение.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось сохранить параметры Moodle.",
      );
    } finally {
      finishAction();
    }
  };
  const testMoodle = async () => {
    if (!startAction("moodle-test")) return;
    try {
      const result = await apiFetch<MoodleTestResult>(
        "/admin/connectors/moodle/test",
        { method: "POST" },
      );
      setConnectors((items) =>
        items.map((item) =>
          item.id === "moodle" ? { ...item, status: "active" } : item,
        ),
      );
      setMessage(
        `Moodle подключён${result.siteName ? `: ${result.siteName}` : ""}${result.release ? `, версия ${result.release}` : ""}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось проверить Moodle.",
      );
      try {
        const items = await apiFetchList<Connector>("/admin/connectors");
        const latest = items.find((item) => item.id === "moodle");
        if (latest) {
          setConnectors((current) =>
            current.map((item) =>
              item.id === "moodle" ? { ...item, ...latest } : item,
            ),
          );
        }
      } catch {
        // Keep the last known status and the original connection error visible.
      }
    } finally {
      finishAction();
    }
  };
  if (loading)
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Загрузка источников данных">
        <p role="status" aria-live="polite" className="sr-only">Загружаем источники данных…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-44" />
      </div>
    );
  if (error && !connectors.length)
    return (
      <RequestState
        title="Не удалось загрузить центр коннекторов"
        description={error}
        onRetry={load}
      />
    );
  return (
    <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">Кабинет ВУЗа · расписание и данные</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            Источники данных
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">Состояние интеграций, синхронизация расписания и подключение учебных систем.</p>
        </div>
      </div>
      {connectors.length > 0 && <div className="metric-strip">
        {[
          { label: "Работают", value: counts.active, tone: "text-emerald-600", icon: "plug" as const },
          { label: "Отключены", value: counts.inactive, tone: "text-slate-500", icon: "plug" as const },
          { label: "Ошибки", value: counts.errors, tone: "text-red-600", icon: "bell" as const },
          { label: "Ожидают проверки", value: counts.configured, tone: "text-amber-600", icon: "info" as const },
          { label: "Синхронизация", value: counts.syncing, tone: "text-[var(--color-brand)]", icon: "refresh" as const },
        ].map((item) => <Card key={item.label} padding="sm" className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 ${item.tone}`}><Icon name={item.icon} size={20} /></span>
          <div className="min-w-0"><p className="text-2xl font-bold leading-none text-[var(--color-text)]">{item.value}</p><p className="mt-2 truncate text-xs font-medium text-[var(--color-text-secondary)]">{item.label}</p></div>
        </Card>)}
      </div>}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}
      {connectors.length ? (
        <div className="space-y-3">
          {connectors.map((connector) => {
            const info = statusInfo(connector.status);
            const inactive = connector.status === "inactive";
            const canSyncSchedule =
              connector.capabilities?.scheduleSync === true;
            const isMoodle =
              connector.capabilities?.learningManagement === true;
            return (
              <Card
                key={connector.id}
                padding="sm"
                className={`overflow-hidden border transition-shadow hover:shadow-md ${connector.status === "error" ? "border-red-200" : "border-[var(--color-border)]"}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                      <Icon name="plug" size={19} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-[var(--color-text)]">
                          {connector.name}
                        </h2>
                        <Badge variant="slate">
                          {typeLabels[connector.type] || connector.type}
                        </Badge>
                        <Badge variant={info.variant} dot>
                          {info.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Последнее изменение:{" "}
                        {connector.updatedAt
                          ? new Date(connector.updatedAt).toLocaleString(
                              "ru-RU",
                            )
                          : "ещё не зафиксировано"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inactive ? (
                      <Button
                        size="sm"
                        loading={busyId === connector.id}
                        disabled={Boolean(busyId)}
                        onClick={() => persistStatus(connector, "active")}
                      >
                        Включить
                      </Button>
                    ) : (
                      <>
                        {canSyncSchedule && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busyId === connector.id}
                            disabled={Boolean(busyId)}
                            onClick={() => sync(connector)}
                          >
                            Синхронизировать расписание
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(busyId)}
                          onClick={() => persistStatus(connector, "inactive")}
                        >
                          Отключить
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isMoodle ? (
                  <div className="mt-5 space-y-4 border-t border-[var(--color-border)] pt-5">
                    <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
                      <p className="font-semibold">
                        Подключение Moodle
                      </p>
                      <p className="mt-1 text-sky-800">
                        NaPare показывает контекст пары и подготовку; задания,
                        файлы, попытки и оценки остаются в Moodle.
                      </p>
                    </div>
                    {connector.status === "error" && (
                      <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                        Последняя проверка не пройдена. Проверьте URL и токен.
                        После изменения параметров сохраните их и повторите
                        проверку подключения.
                      </p>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700">
                        URL Moodle
                        <input
                          type="url"
                          name="moodle-base-url"
                          autoComplete="url"
                          required
                          aria-describedby="moodle-url-hint"
                          value={moodle.baseUrl}
                          disabled={Boolean(busyId)}
                          onChange={(event) =>
                            setMoodle((current) => ({
                              ...current,
                              baseUrl: event.target.value,
                            }))
                          }
                          placeholder="https://moodle.university.ru/"
                          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                        />
                        <span id="moodle-url-hint" className="mt-1 block text-xs font-normal text-slate-500">Укажите полный адрес Moodle с защищённым протоколом https://.</span>
                        {moodle.baseUrl && !isSecureMoodleUrl(moodle.baseUrl) && <span className="mt-1 block text-xs font-normal text-red-700">Проверьте адрес: требуется полный HTTPS URL.</span>}
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Web Services token
                        <input
                          name="moodle-token"
                          value={moodle.token}
                          disabled={Boolean(busyId)}
                          onChange={(event) =>
                            setMoodle((current) => ({
                              ...current,
                              token: event.target.value,
                            }))
                          }
                          type="password"
                          autoComplete="new-password"
                          placeholder={
                            connector.tokenConfigured
                              ? "Токен сохранён — введите новый только для замены"
                              : "Токен Moodle"
                          }
                          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        loading={busyId === "moodle-configure"}
                        disabled={Boolean(busyId) || !isSecureMoodleUrl(moodle.baseUrl) || !moodle.token}
                        onClick={configureMoodle}
                      >
                        Сохранить защищённо
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === "moodle-test"}
                        disabled={Boolean(busyId) || !connector.tokenConfigured}
                        onClick={testMoodle}
                      >
                        Проверить подключение
                      </Button>
                      <span className="text-xs text-slate-500">
                        {connector.tokenConfigured
                          ? "Токен зашифрован и не отображается."
                          : "Токен пока не сохранён."}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
                    <p className="text-xs text-slate-400">
                      История изменений
                    </p>
                    <Link
                      href="/audit-log"
                      className="mt-1 inline-block font-semibold text-sky-700"
                    >
                      Открыть журнал →
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Коннектор не настроен"
          description="Выберите поддерживаемый источник в профиле университета. Файл расписания можно импортировать без подключения внешнего источника." action={<div className="flex flex-wrap justify-center gap-3"><Link href="/university?section=integrations" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-brand)] px-4 text-sm font-semibold text-white">Настроить источник</Link><Link href="/schedule-import" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold text-[var(--color-brand)]">Импортировать файл</Link></div>}
        />
      )}
    </div>
  );
}
