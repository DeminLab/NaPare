"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button, Card, Skeleton } from "@/components/ui";

type ScheduleProvider = "rasp-sano" | "file-only";
interface ScheduleSettings {
  provider: ScheduleProvider;
  enabled: boolean;
  config: Record<string, unknown>;
}
interface SyncResult {
  timestamp?: string;
  lessons?: number;
  groups?: number;
  imported?: number;
  updated?: number;
  studentsLinked?: number;
}

export function ScheduleSourceSettings() {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<ScheduleSettings>("/admin/connectors/schedule");
      setSettings({
        provider: result.provider === "rasp-sano" ? "rasp-sano" : "file-only",
        enabled: Boolean(result.enabled),
        config: result.config ?? {},
      });
      setAcademicYear(typeof result.config?.academicYear === "string" ? result.config.academicYear : "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить источник расписания.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!settings || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (academicYear && !/^\d{4}-\d{4}$/.test(academicYear)) {
        throw new Error("Укажите учебный год в формате 2026-2027.");
      }
      const payload = { ...settings, config: { ...settings.config, ...(academicYear ? { academicYear } : {}) } };
      if (!academicYear) delete payload.config.academicYear;
      const saved = await apiFetch<ScheduleSettings>("/admin/connectors/schedule", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSettings({ ...settings, ...saved, config: saved.config ?? settings.config });
      setNotice("Настройки источника расписания сохранены.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить настройки.");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: "test" | "sync") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (settings?.provider !== "rasp-sano" || !settings.enabled) {
        throw new Error("Сначала выберите Rasp.SANO и включите источник.");
      }
      if (action === "test") {
        const result = await apiFetch<{ status?: string; academicYear?: string; groups?: number; lessons?: number; teachers?: number }>("/admin/connectors/schedule/test", { method: "POST" });
        setNotice(`Источник доступен${result.academicYear ? ` · учебный год ${result.academicYear}` : ""}. Групп: ${result.groups ?? 0}, занятий: ${result.lessons ?? 0}, преподавателей: ${result.teachers ?? 0}. Данные не записывались.`);
      } else {
        const result = await apiFetch<SyncResult>("/admin/schedule/sync", { method: "POST" });
        setNotice(`Синхронизация завершена: ${result.imported ?? result.lessons ?? 0} добавлено, ${result.updated ?? 0} обновлено; групп — ${result.groups ?? 0}.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выполнить действие с источником.");
    } finally {
      setBusy(false);
    }
  }

  return <Card className="space-y-5">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-brand)]">Расписание</p>
      <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">Источник расписания вуза</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-secondary)]">Настройка действует только для вашего вуза. Файловый импорт остаётся доступен независимо от выбранного источника.</p>
    </div>
    {loading ? <div className="space-y-3" aria-busy="true" aria-label="Загрузка настроек расписания"><Skeleton className="h-12" /><Skeleton className="h-16" /></div> : settings ? <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <label className="block text-sm font-semibold text-[var(--color-text)]" htmlFor="schedule-provider">Способ получения расписания
          <select id="schedule-provider" value={settings.provider} disabled={busy} onChange={event => setSettings(current => { if (!current) return current; const provider = event.target.value as ScheduleProvider; return { ...current, provider, enabled: provider === "file-only" ? false : current.enabled }; })} className="mt-1.5 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
            <option value="file-only">Только импорт файлов</option>
            <option value="rasp-sano">Rasp.SANO · расписание СИБИТа</option>
          </select>
        </label>
        <div className="flex items-center rounded-xl border border-[var(--color-border)] px-4 py-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-[var(--color-text)]">
            <input type="checkbox" checked={settings.enabled} disabled={busy || settings.provider === "file-only"} onChange={event => setSettings(current => current ? { ...current, enabled: event.target.checked } : current)} className="h-5 w-5 rounded border-slate-300 text-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" />
            Включить автоматический источник
          </label>
        </div>
      </div>
      {settings.provider === "rasp-sano" && <label className="block max-w-sm text-sm font-semibold text-[var(--color-text)]" htmlFor="schedule-academic-year">Учебный год <span className="font-normal text-slate-500">(необязательно)</span>
        <input id="schedule-academic-year" inputMode="numeric" maxLength={9} value={academicYear} disabled={busy} onChange={event => setAcademicYear(event.target.value)} placeholder="2026-2027" aria-describedby="schedule-year-hint" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" />
        <span id="schedule-year-hint" className="mt-1 block text-xs font-normal text-[var(--color-text-secondary)]">Оставьте пустым, чтобы использовать учебный год источника по умолчанию.</span>
      </label>}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-950">
        <p className="font-semibold">Адрес источника задан платформой</p>
        <p className="mt-1">{settings.provider === "rasp-sano" ? "Источник содержит расписание СИБИТа и использует rasp.sano.ru. Адрес нельзя заменить на произвольный сайт." : "Rasp.SANO сейчас поддерживает расписание СИБИТа. Для другого источника используйте файловый импорт."}</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} disabled={busy} onClick={() => void save()}>Сохранить настройки</Button>
        <Button variant="secondary" loading={busy} disabled={busy || settings.provider !== "rasp-sano" || !settings.enabled} onClick={() => void run("test")}>Проверить источник</Button>
        <Button variant="secondary" loading={busy} disabled={busy || settings.provider !== "rasp-sano" || !settings.enabled} onClick={() => void run("sync")}>Загрузить расписание</Button>
      </div>
    </> : <div role="alert" className="space-y-3 text-sm"><p className="text-red-700">{error || "Настройки источника недоступны."}</p><Button variant="secondary" onClick={() => void load()}>Повторить</Button></div>}
  </Card>;
}
