"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui";
import { getToken, logout } from "@/lib/api";

type SessionStatus = "Active" | "Expired" | "Unknown";

interface SessionRecord {
  device: string;
  created: string;
  expiresAt: string;
  status: SessionStatus;
}

interface JwtTimestampClaims {
  exp?: number;
  iat?: number;
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return "Недоступно";

  return new Date(timestamp * 1000).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readLocalSession(token: string): SessionRecord {
  const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Мобильный браузер"
    : "Браузер на компьютере";

  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) throw new Error("JWT payload is missing");

    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const claims = JSON.parse(atob(normalizedPayload)) as JwtTimestampClaims;
    const expired =
      typeof claims.exp === "number" && claims.exp * 1000 <= Date.now();

    return {
      device,
      created: formatTimestamp(claims.iat),
      expiresAt: formatTimestamp(claims.exp),
      status: typeof claims.exp !== "number" ? "Unknown" : expired ? "Expired" : "Active",
    };
  } catch {
    return {
      device,
      created: "Недоступно",
      expiresAt: "Недоступно",
      status: "Unknown",
    };
  }
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const tone =
    status === "Active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Expired"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === "Active" ? "Срок не истёк" : status === "Expired" ? "Срок истёк" : "Не удалось прочитать"}
    </span>
  );
}

export default function SessionPage() {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const refresh = () => { const token = getToken(); setSession(token ? readLocalSession(token) : null); };
    refresh(); const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sessionStatus = session?.status;
  const sessionStatusTone =
    sessionStatus === "Active"
      ? "text-emerald-700"
      : sessionStatus === "Expired"
        ? "text-amber-700"
        : "text-slate-600";

  return (
    <div className="min-h-full px-4 py-6 text-[var(--color-text)] sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          Разработчик <span>/</span>{" "}
          <span className="font-semibold text-[var(--color-text)]">Сессия</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Текущая сессия
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Здесь показаны локальные сроки токена в этом браузере. Его наличие не подтверждает доступ на сервере. Глобальный выход действует на все устройства.
          </p>
        </div>

        <section
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          aria-label="Статус сессии"
        >
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">Сессия на устройстве</p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
              {session ? "1" : "0"}
            </p>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
              {session ? "локальный токен найден" : "токен не найден"}
            </span>
          </Card>
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">Статус</p>
            <p className={`mt-2 text-2xl font-bold ${sessionStatusTone}`}>
              {session?.status === "Expired" ? "Истекла" : session?.status === "Unknown" ? "Не удалось прочитать" : session ? "Срок не истёк" : "Нет токена"}
            </p>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
              проверяется по данным JWT
            </span>
          </Card>
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">Отзыв токенов</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">Включён</p>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
              для всех устройств аккаунта
            </span>
          </Card>
        </section>

        {session ? (
          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Это устройство
                </p>
                <h2 className="mt-1 text-lg font-semibold">{session.device}</h2>
              </div>
              <StatusBadge status={session.status} />
            </div>

            <dl className="mt-6 grid gap-4 border-y border-[var(--color-border)] py-5 text-sm sm:grid-cols-2">
              <div>
              <dt className="text-sm text-[var(--color-text-secondary)]">Создана</dt>
                <dd className="mt-1 font-medium">{session.created}</dd>
              </div>
              <div>
              <dt className="text-sm text-[var(--color-text-secondary)]">Истекает</dt>
                <dd className="mt-1 font-medium">{session.expiresAt}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Сервер отзовёт access- и refresh-токены на всех устройствах,
                затем текущий браузер вернётся на страницу входа.
              </p>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                Выйти на всех устройствах
              </Button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">
              Активная локальная сессия не найдена
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Войдите в кабинет разработчика, чтобы увидеть данные текущего
              токена.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-amber-900">
            Что пока недоступно
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-800">
            Сервер не хранит список устройств, поэтому здесь нельзя показать
            каждую отдельную сессию и отозвать только одну из них. Сейчас
            доступен безопасный глобальный выход: он инвалидирует все ранее
            выданные токены аккаунта.
          </p>
        </section>
        <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Выйти на всех устройствах?" description="Все ранее выданные токены аккаунта будут отозваны. Вы и другие устройства должны будете войти заново." confirmLabel="Выйти везде" loading={loggingOut} onConfirm={() => { setLoggingOut(true); void logout().finally(() => setLoggingOut(false)); }} />
      </div>
    </div>
  );
}
