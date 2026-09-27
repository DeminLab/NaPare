"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
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
    }),
    [connectors],
  );
  const persistStatus = async (
    connector: Connector,
    status: "active" | "inactive",
  ) => {
    setBusyId(connector.id);
    setError("");
    setMessage("");
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
      setBusyId("");
    }
  };
  const sync = async (connector: Connector) => {
    setBusyId(connector.id);
    setError("");
    setMessage("");
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
      setBusyId("");
    }
  };
  const configureMoodle = async () => {
    setBusyId("moodle-configure");
    setError("");
    setMessage("");
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
      setBusyId("");
    }
  };
  const testMoodle = async () => {
    setBusyId("moodle-test");
    setError("");
    setMessage("");
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
    } finally {
      setBusyId("");
    }
  };
  if (loading)
    return (
      <div className="space-y-4">
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
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard" className="hover:text-slate-900">
          Кабинет ВУЗа
        </Link>
        <span>/</span>
        <span className="text-slate-900">Коннекторы</span>
      </div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-sky-700">Кабинет ВУЗа</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Центр коннекторов
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Расписание, Moodle и другие системы подключаются без копирования
            чувствительных данных в интерфейс.
          </p>
        </div>
        <Badge variant="slate">Данные ВУЗа</Badge>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Работают
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {counts.active}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Отключены
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {counts.inactive}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ошибки
          </p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {counts.errors}
          </p>
        </Card>
      </div>
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
                className={connector.status === "error" ? "border-red-200" : ""}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon name="plug" size={19} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-slate-950">
                          {connector.name}
                        </h2>
                        <Badge variant="slate">
                          {typeLabels[connector.type] || connector.type}
                        </Badge>
                        <Badge variant={info.variant} dot>
                          {info.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
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
                            onClick={() => sync(connector)}
                          >
                            Синхронизировать расписание
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === connector.id}
                          onClick={() => persistStatus(connector, "inactive")}
                        >
                          Отключить
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isMoodle ? (
                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
                      <p className="font-semibold">
                        Moodle — источник сдач и оценок
                      </p>
                      <p className="mt-1 text-sky-800">
                        NaPare показывает контекст пары и подготовку; задания,
                        файлы, попытки и оценки остаются в Moodle.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700">
                        URL Moodle
                        <input
                          value={moodle.baseUrl}
                          onChange={(event) =>
                            setMoodle((current) => ({
                              ...current,
                              baseUrl: event.target.value,
                            }))
                          }
                          placeholder="https://moodle.university.ru/"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Web Services token
                        <input
                          value={moodle.token}
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
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        loading={busyId === "moodle-configure"}
                        disabled={!moodle.baseUrl || !moodle.token}
                        onClick={configureMoodle}
                      >
                        Сохранить защищённо
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === "moodle-test"}
                        disabled={!connector.tokenConfigured}
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
                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400">
                        Результат синхронизации
                      </p>
                      <p className="mt-1 text-slate-700">
                        Смотрите в журнале после запуска.
                      </p>
                    </div>
                    <div>
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
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Коннектор не настроен"
          description="Добавьте тип коннектора в профиле ВУЗа, чтобы подключить источник расписания или Moodle."
        />
      )}
    </div>
  );
}
