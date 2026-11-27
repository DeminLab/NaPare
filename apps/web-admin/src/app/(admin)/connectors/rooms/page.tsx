"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, apiFetchAllPages } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Modal, RequestState, Skeleton } from "@/components/ui";

interface Room {
  id: string;
  name: string;
  code?: string | null;
  building?: string | null;
  floor?: string | null;
  capacity?: number | null;
  isArchived: boolean;
  archiveReason?: string | null;
}
interface RoomForm { name: string; code: string; building: string; floor: string; capacity: string; }
const blank: RoomForm = { name: "", code: "", building: "", floor: "", capacity: "" };

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<RoomForm>(blank);
  const [editing, setEditing] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Room | null>(null);
  const [reason, setReason] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError("");
    try { setRooms(await apiFetchAllPages<Room>("/admin/rooms")); }
    catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Не удалось загрузить аудитории."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => rooms.filter(room => room.isArchived === showArchived).sort((a, b) => a.name.localeCompare(b.name, "ru")), [rooms, showArchived]);
  function resetForm() { setForm(blank); setEditing(null); }
  function beginEdit(room: Room) {
    setEditing(room);
    setForm({ name: room.name, code: room.code || "", building: room.building || "", floor: room.floor || "", capacity: room.capacity == null ? "" : String(room.capacity) });
    setError("");
    setNotice("");
  }
  function update(field: keyof RoomForm, value: string) { setForm(current => ({ ...current, [field]: value })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const capacity = form.capacity.trim() ? Number(form.capacity) : undefined;
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) { setError("Вместимость должна быть целым числом не меньше 1."); return; }
    setBusy(true); setError(""); setNotice("");
    const payload = { name: form.name.trim(), code: form.code.trim() || undefined, building: form.building.trim() || undefined, floor: form.floor.trim() || undefined, capacity };
    try {
      const saved = editing
        ? await apiFetch<Room>(`/admin/rooms/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiFetch<Room>("/admin/rooms", { method: "POST", body: JSON.stringify(payload) });
      setRooms(current => editing ? current.map(room => room.id === saved.id ? saved : room) : [...current, saved]);
      setNotice(editing ? "Изменения аудитории сохранены." : "Аудитория добавлена в каталог.");
      resetForm();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить аудиторию."); }
    finally { setBusy(false); }
  }

  async function changeArchiveState() {
    if (!archiveTarget || !reason.trim() || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await apiFetch<Room>(`/admin/rooms/${archiveTarget.id}`, { method: "PATCH", body: JSON.stringify({ isArchived: !archiveTarget.isArchived, reason: reason.trim() }) });
      setRooms(current => current.map(room => room.id === saved.id ? saved : room));
      setNotice(saved.isArchived ? `Аудитория «${saved.name}» помещена в архив. Её можно восстановить.` : `Аудитория «${saved.name}» восстановлена.`);
      setArchiveTarget(null); setReason("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось изменить состояние аудитории."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6"><header><p className="workspace-kicker">Университет · расписание и данные</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text)]">Аудитории</h1><p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">Каталог помещений вашего вуза. Архивирование обратимо, история расписания сохраняется.</p></header><div className="space-y-4" aria-busy="true" aria-label="Загрузка каталога аудиторий"><p role="status" className="sr-only">Загружаем аудитории…</p><Skeleton className="h-48" /><Skeleton className="h-48" /></div></div>;
  if (loadError && rooms.length === 0) return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-4"><header><p className="workspace-kicker">Университет · расписание и данные</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text)]">Аудитории</h1><p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">Каталог помещений вашего вуза. Архивирование обратимо, история расписания сохраняется.</p></header><RequestState title="Каталог аудиторий недоступен" description={loadError} headingLevel={2} onRetry={() => void load()} /></div>;

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="workspace-kicker">Университет · расписание и данные</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text)]">Аудитории</h1><p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">Каталог помещений вашего вуза. Архивирование обратимо, история расписания сохраняется.</p></div>
      <Link href="/connectors" className="inline-flex min-h-11 items-center font-semibold text-[var(--color-brand)] underline underline-offset-4">← Источники данных</Link>
    </div>
    {loadError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Не удалось обновить список: {loadError} <button type="button" className="ml-2 min-h-11 underline" onClick={() => void load()}>Повторить</button></p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

    <Card>
      <h2 className="text-lg font-bold text-[var(--color-text)]">{editing ? `Изменить: ${editing.name}` : "Добавить аудиторию"}</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input id="room-name" label="Название аудитории" required maxLength={120} value={form.name} onChange={event => update("name", event.target.value)} placeholder="Аудитория 204" />
        <Input label="Код" maxLength={60} value={form.code} onChange={event => update("code", event.target.value)} placeholder="204-А" />
        <Input label="Корпус" maxLength={120} value={form.building} onChange={event => update("building", event.target.value)} placeholder="Главный корпус" />
        <Input label="Этаж" maxLength={40} value={form.floor} onChange={event => update("floor", event.target.value)} placeholder="2" />
        <Input label="Вместимость" type="number" min={1} step={1} value={form.capacity} onChange={event => update("capacity", event.target.value)} placeholder="30" />
        <div className="flex flex-wrap items-end gap-2"><Button type="submit" loading={busy} disabled={busy || !form.name.trim()}>{editing ? "Сохранить" : "Добавить"}</Button>{editing && <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>Отмена</Button>}</div>
      </form>
    </Card>

    <Card>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold text-[var(--color-text)]">{showArchived ? "Архив аудиторий" : "Каталог аудиторий"}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{visible.length} {showArchived ? "в архиве" : "активных"} · Всего: {rooms.length}</p></div><Button type="button" variant="secondary" onClick={() => setShowArchived(value => !value)}>{showArchived ? "Показать действующие" : `Архив (${rooms.filter(room => room.isArchived).length})`}</Button></div>
      {visible.length ? <ul className="mt-4 divide-y divide-[var(--color-border)]">{visible.map(room => <li key={room.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--color-text)]">{room.name}</h3>{room.code && <Badge variant="slate">{room.code}</Badge>}{room.isArchived && <Badge variant="amber">В архиве</Badge>}</div><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{[room.building, room.floor && `этаж ${room.floor}`, room.capacity != null && `${room.capacity} мест`].filter(Boolean).join(" · ") || "Дополнительные параметры не указаны"}</p>{room.isArchived && room.archiveReason && <p className="mt-1 text-xs text-slate-500">Основание: {room.archiveReason}</p>}</div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => beginEdit(room)}>Изменить</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setArchiveTarget(room); setReason(""); setError(""); }}>{room.isArchived ? "Восстановить" : "В архив"}</Button></div></li>)}</ul> : <div className="mt-4"><EmptyState title={showArchived ? "Архив пуст" : "Аудиторий пока нет"} description={showArchived ? "Архивированные аудитории появятся здесь." : "Добавьте аудитории в каталог, чтобы централизованно вести их названия и характеристики."} action={showArchived ? undefined : <Button variant="secondary" onClick={() => document.getElementById("room-name")?.focus()}>Добавить аудиторию</Button>} /></div>}
    </Card>

    <Modal open={Boolean(archiveTarget)} onClose={() => { if (!busy) setArchiveTarget(null); }} title={archiveTarget?.isArchived ? "Восстановить аудиторию" : "Переместить аудиторию в архив"}>
      {archiveTarget && <><p className="text-sm text-[var(--color-text-secondary)]">{archiveTarget.name} · укажите основание, оно сохранится в журнале изменений.</p><label htmlFor="room-archive-reason" className="mt-4 block text-sm font-semibold text-[var(--color-text)]">Основание</label><textarea id="room-archive-reason" required minLength={3} maxLength={500} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" />{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setArchiveTarget(null)}>Отмена</Button><Button loading={busy} disabled={busy || reason.trim().length < 3} onClick={() => void changeArchiveState()}>{archiveTarget.isArchived ? "Восстановить" : "В архив"}</Button></div></>}
    </Modal>
  </div>;
}
