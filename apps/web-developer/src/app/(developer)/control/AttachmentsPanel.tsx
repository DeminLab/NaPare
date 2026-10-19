'use client';
import { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

interface Attachment {
  id: string; pairSpaceId: string; lessonId: string; universityId: string; universityName: string;
  subject: string; groupId: string; groupName: string; uploaderId: string; uploaderName: string;
  uploaderEmail: string; fileName: string; fileType: string; size: number; createdAt: string;
  status: 'active' | 'revoked'; revokedAt: string | null; revokedBy: string | null;
  revokeReason: string | null; fileLocation: string | null;
}
interface University { id: string; name: string; city: string }

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU') : '—';
const sizeLabel = (bytes: number) => bytes < 1024 ? `${bytes} Б` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;

export default function AttachmentsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'active' | 'revoked' | 'all'>('active');
  const [universityId, setUniversityId] = useState('');
  const [page, setPage] = useState(1);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [action, setAction] = useState<'revoke' | 'restore' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const filters = useMemo(() => {
    const params = new URLSearchParams({ q: query.slice(0, 100), status, page: String(page), limit: '20' });
    if (universityId) params.set('universityId', universityId);
    return params.toString();
  }, [query, status, universityId, page]);
  const attachments = useResource<Page<Attachment>>(`/platform-attachments?${filters}`);
  const detail = useResource<Attachment>(openedId ? `/platform-attachments/${openedId}` : null);
  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);
  const updateFilter = (update: () => void) => { update(); setPage(1); setOpenedId(null); setAction(null); setReason(''); };

  const submitAction = async () => {
    if (!openedId || !action || reason.trim().length < 3) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/platform-attachments/${openedId}/${action}`, { method: 'PATCH', body: JSON.stringify({ reason: reason.trim() }) });
      setNotice(action === 'revoke' ? 'Запись скрыта из PairSpace. Файл и доступ по ранее известной прямой ссылке не изменялись.' : 'Запись снова доступна в PairSpace.');
      setAction(null); setReason(''); detail.refresh(); attachments.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Вложения PairSpace</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Реестр ссылок на учебные материалы. Скрытие убирает запись из PairSpace, но не удаляет файл и не отменяет доступ по уже известной прямой ссылке. В карточке URL показывается без query и hash.</p></div>
    {(error || attachments.error || detail.error || universities.error) && <Notice error>{error || attachments.error || detail.error || universities.error}</Notice>}
    {notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => updateFilter(() => setQuery(event.target.value))} placeholder="файл, автор, группа, занятие или ID" /></label>
      <label className="block text-sm">Состояние<select className={inputClass} value={status} onChange={event => updateFilter(() => setStatus(event.target.value as typeof status))}><option value="active">Доступные</option><option value="revoked">Скрытые</option><option value="all">Все</option></select></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => updateFilter(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{(universities.data?.data ?? []).map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>
    </div>
    {attachments.loading && <p role="status" className="text-sm text-slate-400">Загружаем вложения…</p>}
    {attachments.data && <p className="text-xs text-[var(--color-text-muted)]">Найдено записей: {attachments.data.meta.total}</p>}
    <div className="space-y-3">
      {attachments.data?.data.map(item => { const viewed = detail.data?.id === item.id ? detail.data : item; return <details key={item.id} className={`${panelClass} space-y-3`} onToggle={event => { setOpenedId(event.currentTarget.open ? item.id : null); setAction(null); setReason(''); }}>
        <summary className="flex cursor-pointer flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{item.fileName}</h3><p className="mt-1 text-sm text-slate-400">{item.universityName} · {item.groupName} · {item.subject}</p><p className="mt-1 break-all text-xs text-[var(--color-text-muted)]">{item.uploaderName} · {item.uploaderEmail} · {sizeLabel(item.size)}</p></div><span className={`rounded-full px-2 py-1 text-xs ${item.status === 'active' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{item.status === 'active' ? 'Доступно' : 'Скрыто'}</span></summary>
        {openedId === item.id && detail.loading && <p role="status" className="text-xs text-slate-400">Записываем просмотр…</p>}
        <dl className="grid gap-2 border-t border-slate-700 pt-3 text-xs text-slate-400 sm:grid-cols-2"><div><dt className="text-[var(--color-text-muted)]">ID материала</dt><dd className="mt-1 break-all">{viewed.id}</dd></div><div><dt className="text-[var(--color-text-muted)]">Автор загрузки</dt><dd className="mt-1 break-all">{viewed.uploaderName} · {viewed.uploaderId}</dd></div><div><dt className="text-[var(--color-text-muted)]">Пространство пары / занятие</dt><dd className="mt-1 break-all">{viewed.pairSpaceId} / {viewed.lessonId}</dd></div><div><dt className="text-[var(--color-text-muted)]">Группа / университет</dt><dd className="mt-1 break-all">{viewed.groupName} · {viewed.universityId}</dd></div><div><dt className="text-[var(--color-text-muted)]">Тип / добавлено</dt><dd className="mt-1">{viewed.fileType.toUpperCase()} · {dateLabel(viewed.createdAt)}</dd></div><div><dt className="text-[var(--color-text-muted)]">Расположение</dt><dd className="mt-1 break-all font-mono">{viewed.fileLocation || 'Ссылка скрыта или не поддерживается'}</dd></div>{viewed.status === 'revoked' && <><div><dt className="text-[var(--color-text-muted)]">Скрыто</dt><dd className="mt-1">{dateLabel(viewed.revokedAt)} · оператор {viewed.revokedBy || 'недоступен'}</dd></div><div><dt className="text-[var(--color-text-muted)]">Причина</dt><dd className="mt-1 break-words">{viewed.revokeReason}</dd></div></>}</dl>
        {access.permissions.includes('attachments-data.write') && <div className="border-t border-slate-700 pt-3">{!action ? <Button disabled={busy} onClick={() => { setAction(item.status === 'active' ? 'revoke' : 'restore'); setReason(''); setError(''); }}>{item.status === 'active' ? 'Скрыть вложение' : 'Восстановить вложение'}</Button> : openedId === item.id && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submitAction(); }}><p className="text-sm text-amber-100">{action === 'revoke' ? 'Запись исчезнет из PairSpace. Ранее известная прямая ссылка может продолжить работать.' : 'Запись снова станет доступна в PairSpace.'}</p><label className="block text-sm">Причина<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Подтвердить'}</Button><Button disabled={busy} onClick={() => { setAction(null); setReason(''); }}>Отмена</Button></div></form>}</div>}
      </details>;})}
      {attachments.data?.data.length === 0 && <p className="text-sm text-slate-400">Вложения не найдены.</p>}
    </div>
    {attachments.data && <Pager page={page} totalPages={attachments.data.meta.totalPages} onChange={nextPage => { setPage(nextPage); setOpenedId(null); setAction(null); }} />}
  </section>;
}
