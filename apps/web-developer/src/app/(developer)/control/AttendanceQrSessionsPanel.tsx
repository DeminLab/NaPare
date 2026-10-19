'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

interface Session {
  id: string;
  universityId: string;
  universityName: string;
  lessonId: string;
  subject: string;
  groupId: string;
  groupName: string;
  teacherName: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: 'active' | 'expired' | 'revoked';
}
interface University { id: string; name: string; city: string }

type StatusFilter = 'all' | Session['status'];
const statuses: Record<StatusFilter, string> = { all: 'Все', active: 'Действующие', expired: 'Истёкшие', revoked: 'Отозванные' };
const statusStyle: Record<Session['status'], string> = {
  active: 'bg-emerald-400/10 text-emerald-200',
  expired: 'bg-amber-400/10 text-amber-200',
  revoked: 'bg-slate-700 text-slate-300',
};
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleString('ru-RU') : '—';

export default function AttendanceQrSessionsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [revokeId, setRevokeId] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canRevoke = access.permissions.includes('attendance-qr.revoke');
  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);

  const filters = new URLSearchParams({ q: query.trim().slice(0, 100), status, page: String(page), limit: '20' });
  if (universityId.trim()) filters.set('universityId', universityId.trim().slice(0, 100));
  const list = useResource<Page<Session>>(`/platform-attendance-qr/sessions?${filters.toString()}`);

  const resetMessages = () => { setError(''); setNotice(''); };
  const updateFilter = (update: () => void) => { update(); setPage(1); setRevokeId(''); setReason(''); setConfirmation(''); resetMessages(); };
  const openRevoke = (session: Session) => { setRevokeId(session.id); setReason(''); setConfirmation(''); resetMessages(); };
  const closeRevoke = () => { setRevokeId(''); setReason(''); setConfirmation(''); };
  const revoke = async (session: Session) => {
    if (!canRevoke || session.status === 'revoked' || revokeId !== session.id || reason.trim().length < 3 || confirmation !== 'ОТОЗВАТЬ СЕССИЮ' || busy) return;
    setBusy(true); resetMessages();
    try {
      await apiFetch(`/platform-attendance-qr/sessions/${encodeURIComponent(session.id)}/revoke`, { method: 'PATCH', body: JSON.stringify({ reason: reason.trim() }) });
      closeRevoke(); setNotice('QR-сессия мягко отозвана. Действие записано в аудит.'); list.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">QR-сессии посещаемости</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Поиск QR-сессий по вузам, занятиям, группам и преподавателям. Отзыв завершает сессию, история сохраняется. Секрет QR-сессии здесь не отображается.</p></div>
    {(error || list.error || universities.error) && <Notice error>{error || list.error || universities.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => updateFilter(() => setQuery(event.target.value))} placeholder="Предмет, группа, преподаватель или ID" /></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => updateFilter(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{(universities.data?.data ?? []).map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>
      <label className="block text-sm">Состояние<select className={inputClass} value={status} onChange={event => updateFilter(() => setStatus(event.target.value as StatusFilter))}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {list.loading && <p role="status" className="text-sm text-slate-400">Загружаем QR-сессии…</p>}
    {list.data && <p className="text-xs text-[var(--color-text-muted)]">Найдено сессий: {list.data.meta.total}</p>}
    <div className="space-y-3">
      {list.data?.data.map(session => <article key={session.id} className={`${panelClass} space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{session.subject || 'Занятие без названия'}</h3><p className="mt-1 text-sm text-slate-300">{session.universityName} · {session.groupName}</p><p className="mt-1 text-sm text-slate-400">Преподаватель: {session.teacherName || 'не указан'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${statusStyle[session.status] || statusStyle.expired}`}>{statuses[session.status] || session.status}</span></div>
        <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-[var(--color-text-muted)]">Создана</dt><dd className="mt-1">{dateLabel(session.createdAt)} · {session.createdByName || 'автор не указан'}</dd></div><div><dt className="text-[var(--color-text-muted)]">Истекает</dt><dd className="mt-1">{dateLabel(session.expiresAt)}</dd></div><div><dt className="text-[var(--color-text-muted)]">Отозвана</dt><dd className="mt-1">{dateLabel(session.revokedAt)}</dd></div><div><dt className="text-[var(--color-text-muted)]">Занятие / группа</dt><dd className="mt-1 break-all">{session.lessonId} · {session.groupId}</dd></div><div><dt className="text-[var(--color-text-muted)]">Университет</dt><dd className="mt-1 break-all">{session.universityId}</dd></div><div><dt className="text-[var(--color-text-muted)]">ID сессии / создателя</dt><dd className="mt-1 break-all">{session.id} · {session.createdById}</dd></div></dl>
        {session.status === 'active' && canRevoke && revokeId !== session.id && <Button disabled={busy} onClick={() => openRevoke(session)}>Отозвать QR-сессию</Button>}
        {session.status === 'active' && canRevoke && revokeId === session.id && <form className="space-y-3 rounded-lg border border-amber-400/30 p-3" onSubmit={event => { event.preventDefault(); void revoke(session); }}><h4 className="text-sm font-semibold">Подтвердите отзыв QR-сессии</h4><p className="text-xs text-slate-400">Отзыв мягкий: запись и аудит останутся. Для подтверждения введите фразу ниже.</p><label className="block text-sm">Причина отзыва<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><label className="block text-sm">Введите ОТОЗВАТЬ СЕССИЮ<input className={inputClass} autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reason.trim().length < 3 || confirmation !== 'ОТОЗВАТЬ СЕССИЮ'}>{busy ? 'Отзываем…' : 'Подтвердить отзыв'}</Button><Button disabled={busy} onClick={closeRevoke}>Отмена</Button></div></form>}
        {session.status === 'active' && !canRevoke && <p className="text-xs text-[var(--color-text-muted)]">Для отзыва требуется `attendance-qr.revoke`.</p>}
      </article>)}
      {list.data?.data.length === 0 && <p className="text-sm text-slate-400">QR-сессии не найдены.</p>}
    </div>
    {list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
  </section>;
}
