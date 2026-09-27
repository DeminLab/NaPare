"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getToken, logout } from "@/lib/api";

type SessionStatus = "Active" | "Expired";

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
      status: expired ? "Expired" : "Active",
    };
  } catch {
    return {
      device,
      created: "Недоступно",
      expiresAt: "Недоступно",
      status: "Active",
    };
  }
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const active = status === "Active";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          : "border-amber-400/20 bg-amber-400/10 text-amber-300"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {active ? "Активна" : "Истекла"}
    </span>
  );
}

export default function SessionPage() {
  const [session, setSession] = useState<SessionRecord | null>(null);

  useEffect(() => {
    const token = getToken();
    setSession(token ? readLocalSession(token) : null);
  }, []);

  return (
    <div className="min-h-full bg-[#0b0e14] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <div className="flex items-center gap-2 text-xs text-white/40">
          Разработчик <span>/</span>{" "}
          <span className="text-white/80">Сессия</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Текущая сессия
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Здесь показан токен, сохранённый в этом браузере. Выход безопасно
            отзовёт все активные токены аккаунта.
          </p>
        </div>

        <section
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          aria-label="Статус сессии"
        >
          <Card className="border-white/10 bg-white/[0.04]">
            <p className="text-xs text-white/40">Сессия на устройстве</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {session ? "1" : "0"}
            </p>
            <span className="mt-1 block text-xs text-white/35">
              {session ? "локальный токен найден" : "токен не найден"}
            </span>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <p className="text-xs text-white/40">Статус</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">
              {session?.status === "Expired"
                ? "Истекла"
                : session
                  ? "Активна"
                  : "—"}
            </p>
            <span className="mt-1 block text-xs text-white/35">
              проверяется по данным JWT
            </span>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <p className="text-xs text-white/40">Отзыв токенов</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">Включён</p>
            <span className="mt-1 block text-xs text-white/35">
              для всех устройств аккаунта
            </span>
          </Card>
        </section>

        {session ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/35">
                  Это устройство
                </p>
                <h2 className="mt-1 text-lg font-semibold">{session.device}</h2>
              </div>
              <StatusBadge status={session.status} />
            </div>

            <dl className="mt-6 grid gap-4 border-y border-white/10 py-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-white/35">Создана</dt>
                <dd className="mt-1 text-white/75">{session.created}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/35">Истекает</dt>
                <dd className="mt-1 text-white/75">{session.expiresAt}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-6 text-white/45">
                Сервер отзовёт access- и refresh-токены на всех устройствах,
                затем текущий браузер вернётся на страницу входа.
              </p>
              <Button variant="secondary" onClick={logout}>
                Выйти на всех устройствах
              </Button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">
              Активная локальная сессия не найдена
            </h2>
            <p className="mt-2 text-sm text-white/45">
              Войдите в кабинет разработчика, чтобы увидеть данные текущего
              токена.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5 sm:p-6">
          <h2 className="text-base font-semibold text-amber-100">
            Что пока недоступно
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/70">
            Сервер не хранит список устройств, поэтому здесь нельзя показать
            каждую отдельную сессию и отозвать только одну из них. Сейчас
            доступен безопасный глобальный выход: он инвалидирует все ранее
            выданные токены аккаунта.
          </p>
        </section>
      </div>
    </div>
  );
}
