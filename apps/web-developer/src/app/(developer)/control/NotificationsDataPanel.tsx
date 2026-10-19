'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource, useTargetUserId } from './control-ui';

type Kind = 'notification' | 'inbox';
type Mode = Kind | 'devices';
type NotificationStatus = 'read' | 'unread';
type InboxStatus = 'open' | 'snoozed' | 'done';
type Priority = 'low' | 'normal' | 'high' | 'urgent';
interface RecordSummary { id: string; kind: Kind; userId: string; userName: string; userEmail: string; universityId: string; universityName: string; title: string; status: string; priority: Priority | null; createdAt: string; updatedAt: string }
interface RecordDetail extends RecordSummary { user: { id: string; firstName: string; lastName: string; email: string }; university: { id: string; name: string }; type?: string; category?: string; body?: string | null; description?: string | null; deepLink?: string | null; isRead?: boolean; readAt?: string | null; dueAt?: string | null; completedAt?: string | null; eventId?: string | null; data?: unknown; actions?: unknown; }
interface DeviceSummary { id: string; userId: string; userName: string; userEmail: string; platform: string; deviceName: string | null; isActive: boolean; createdAt: string; updatedAt: string }
const priorityLabels: Record<Priority, string> = { low: 'Низкий', normal: 'Обычный', high: 'Высокий', urgent: 'Срочный' };
const notificationStatusLabel = (status: string) => status === 'read' ? 'Прочитано' : status === 'unread' ? 'Не прочитано' : status;
const inboxStatusLabel: Record<InboxStatus, string> = { open: 'Открыто', snoozed: 'Отложено', done: 'Завершено' };
const toLocalDateTime = (value: string | null | undefined) => { if (!value) return ''; const date = new Date(value); if (!Number.isFinite(date.getTime())) return ''; date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const fromLocalDateTime = (value: string) => value ? new Date(value).toISOString() : null;
const safeLink = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' ? value : null; } catch { return null; }
};

export default function NotificationsDataPanel({ access }: { access: Access }) {
  const targetUserId = useTargetUserId();
  const [mode, setMode] = useState<Mode>('notification');
  const kind: Kind = mode === 'inbox' ? 'inbox' : 'notification';
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (targetUserId) setUserId(targetUserId); }, [targetUserId]);

  const filters = new URLSearchParams({ kind, q: query.slice(0, 100), page: String(page), limit: '20' });
  if (userId.trim()) filters.set('userId', userId.trim());
  if (universityId.trim()) filters.set('universityId', universityId.trim());
  if (status) filters.set('status', status);
  const recordList = useResource<Page<RecordSummary>>(mode === 'devices' ? null : `/platform-notifications/records?${filters.toString()}`);
  const deviceFilters = new URLSearchParams({ q: query.slice(0, 100), page: String(page), limit: '20' });
  if (userId.trim()) deviceFilters.set('userId', userId.trim());
  const deviceList = useResource<Page<DeviceSummary>>(mode === 'devices' ? `/platform-notifications/devices?${deviceFilters.toString()}` : null);
  const details = useResource<RecordDetail>(selectedId && mode !== 'devices' ? `/platform-notifications/records/${kind}/${selectedId}` : null);
  const canWrite = access.permissions.includes('notification-data.write');
  useEffect(() => {
    if (!details.data || details.data.id !== selectedId || details.data.kind !== kind) return;
    setDraft(kind === 'notification'
      ? { isRead: Boolean(details.data.isRead), readAt: toLocalDateTime(details.data.readAt), title: details.data.title || '', body: details.data.body || '', deepLink: details.data.deepLink || '' }
      : { status: (details.data.status as InboxStatus) || 'open', title: details.data.title || '', description: details.data.description || '', deepLink: details.data.deepLink || '', priority: (details.data.priority as Priority) || 'normal', dueAt: toLocalDateTime(details.data.dueAt), completedAt: toLocalDateTime(details.data.completedAt) });
    setReason('');
  }, [details.data, kind, selectedId]);

  const updateFilter = (update: () => void) => { update(); setPage(1); setSelectedId(''); setReason(''); setError(''); setNotice(''); };
  const save = async () => {
    if (!selectedId || reason.trim().length < 3 || busy) return;
    const payload = kind === 'notification'
      ? { isRead: Boolean(draft.isRead), readAt: fromLocalDateTime(String(draft.readAt || '')), title: String(draft.title || '').trim(), body: String(draft.body || ''), deepLink: String(draft.deepLink || '').trim() || null, reason: reason.trim() }
      : { status: String(draft.status || 'open'), title: String(draft.title || '').trim(), description: String(draft.description || ''), deepLink: String(draft.deepLink || '').trim() || null, priority: String(draft.priority || 'normal'), dueAt: fromLocalDateTime(String(draft.dueAt || '')), completedAt: fromLocalDateTime(String(draft.completedAt || '')), reason: reason.trim() };
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/platform-notifications/records/${kind}/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      details.refresh(); recordList.refresh(); setNotice('Запись изменена, действие добавлено в аудит.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const revokeDevice = async (device: DeviceSummary) => {
    if (!device.isActive || reason.trim().length < 3 || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/platform-notifications/devices/${device.id}/revoke`, { method: 'PATCH', body: JSON.stringify({ reason: reason.trim() }) });
      deviceList.refresh(); setReason(''); setNotice('Push-устройство отключено, действие добавлено в аудит.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const currentDetail = details.data?.id === selectedId && details.data.kind === kind ? details.data : null;
  const currentDevice = deviceList.data?.data.find(device => device.id === selectedId) || null;

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Уведомления, входящие и push-устройства</h2><p className="mt-1 text-sm text-slate-400">Ищите данные по всем пользователям или откройте записи конкретного пользователя. Полное содержимое доступно отдельно; исправления и отзыв устройства требуют причины и попадают в аудит.</p></div>
    {(error || recordList.error || deviceList.error || details.error) && <Notice error>{error || recordList.error || deviceList.error || details.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-sm">Раздел<select className={inputClass} value={mode} onChange={event => updateFilter(() => { setMode(event.target.value as Mode); setStatus(''); })}><option value="notification">Уведомления</option><option value="inbox">Входящие задачи</option><option value="devices">Push-устройства</option></select></label>
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => updateFilter(() => setQuery(event.target.value))} placeholder="Заголовок, текст, email или ID" /></label>
      <label className="block text-sm">UUID пользователя<input className={inputClass} maxLength={64} value={userId} onChange={event => updateFilter(() => setUserId(event.target.value))} placeholder="Любой пользователь" /></label>
      {mode !== 'devices' ? <><label className="block text-sm">UUID университета<input className={inputClass} maxLength={64} value={universityId} onChange={event => updateFilter(() => setUniversityId(event.target.value))} placeholder="Все университеты" /></label><label className="block text-sm sm:col-span-2 lg:col-span-1">Статус<select className={inputClass} value={status} onChange={event => updateFilter(() => setStatus(event.target.value))}><option value="">Все</option>{kind === 'notification' ? <><option value="unread">Не прочитано</option><option value="read">Прочитано</option></> : <><option value="open">Открыто</option><option value="snoozed">Отложено</option><option value="done">Завершено</option></>}</select></label></> : <p className="self-end pb-2 text-xs text-[var(--color-text-muted)]">Токен устройства не запрашивается и не отображается.</p>}
    </div>
    {(mode === 'devices' ? deviceList.loading : recordList.loading) && <p role="status" className="text-sm text-slate-400">Загружаем записи…</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0"><div className="max-h-[38rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">{mode === 'devices' ? deviceList.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-20 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); setReason(''); setError(''); setNotice(''); }}><span className="block break-words text-sm font-semibold">{item.deviceName || item.platform || 'Push-устройство'}</span><span className="mt-1 block break-all text-xs text-slate-400">{item.userName || item.userEmail} · {item.userEmail}</span><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{item.platform} · {new Date(item.createdAt).toLocaleString('ru-RU')}</span><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${item.isActive ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{item.isActive ? 'Активно' : 'Отключено'}</span></button>) : recordList.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-20 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); setError(''); setNotice(''); }}><span className="block break-words text-sm font-semibold">{item.title || 'Без заголовка'}</span><span className="mt-1 block break-all text-xs text-slate-400">{item.userName || item.userEmail} · {item.userEmail}</span><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{item.universityName || `Университет ${item.universityId}`} · {new Date(item.createdAt).toLocaleString('ru-RU')}</span><span className="mt-1 inline-flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-700 px-2 py-0.5 text-slate-300">{kind === 'notification' ? notificationStatusLabel(item.status) : inboxStatusLabel[item.status as InboxStatus] || item.status}</span>{item.priority && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-slate-300">{priorityLabels[item.priority] || item.priority}</span>}</span></button>)}</div>{mode === 'devices' ? deviceList.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено устройств: {deviceList.data.meta.total}</p><Pager page={page} totalPages={deviceList.data.meta.totalPages} onChange={setPage} /></> : recordList.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено записей: {recordList.data.meta.total}</p><Pager page={page} totalPages={recordList.data.meta.totalPages} onChange={setPage} /></>}{mode === 'devices' ? deviceList.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Устройства не найдены.</p> : recordList.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Записи не найдены.</p>}</div>
      <div className="min-w-0 space-y-4">
        {!selectedId && <div className={panelClass}><p className="text-sm text-slate-400">{mode === 'devices' ? 'Выберите устройство, чтобы просмотреть его состояние и при необходимости отозвать.' : 'Выберите запись, чтобы открыть полный текст и параметры.'}</p></div>}
        {mode !== 'devices' && selectedId && details.loading && <p role="status" className="text-sm text-slate-400">Открываем запись…</p>}
        {mode === 'devices' && currentDevice && <article className={`${panelClass} space-y-4`}><div><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{currentDevice.deviceName || currentDevice.platform || 'Push-устройство'}</h3><p className="mt-1 text-sm text-slate-300">{currentDevice.userName || currentDevice.userEmail} · {currentDevice.userEmail}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{currentDevice.platform} · пользователь {currentDevice.userId}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${currentDevice.isActive ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{currentDevice.isActive ? 'Активно' : 'Отключено'}</span></div><p className="mt-2 break-all font-mono text-xs text-[var(--color-text-muted)]">ID устройства: {currentDevice.id}</p><p className="text-xs text-[var(--color-text-muted)]">Создано {new Date(currentDevice.createdAt).toLocaleString('ru-RU')} · обновлено {new Date(currentDevice.updatedAt).toLocaleString('ru-RU')}</p></div><p className="text-xs text-[var(--color-text-muted)]">Токен устройства скрыт.</p>{currentDevice.isActive && canWrite && <form className="space-y-3 rounded-lg border border-amber-400/30 p-3" onSubmit={event => { event.preventDefault(); void revokeDevice(currentDevice); }}><h4 className="text-sm font-semibold">Отозвать push-устройство</h4><label className="block text-sm">Причина отзыва<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Отзываем…' : 'Отозвать устройство'}</Button></form>}{!canWrite && currentDevice.isActive && <p className="text-xs text-[var(--color-text-muted)]">Для отзыва требуется `notification-data.write`.</p>}</article>}
        {currentDetail && <article className={`${panelClass} space-y-4`}>
          <div><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{currentDetail.title || 'Без заголовка'}</h3><p className="mt-1 break-all text-sm text-slate-300">{currentDetail.user.lastName} {currentDetail.user.firstName} · {currentDetail.user.email}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{currentDetail.university.name} · {currentDetail.type || currentDetail.category || 'Запись'}</p></div><span className="max-w-full break-all font-mono text-xs text-[var(--color-text-muted)]">{currentDetail.id}</span></div><p className="mt-2 break-all text-xs text-[var(--color-text-muted)]">Пользователь: {currentDetail.userId} · создано {new Date(currentDetail.createdAt).toLocaleString('ru-RU')}</p></div>
          <div className="space-y-3 rounded-lg border border-slate-700 p-3"><h4 className="text-sm font-semibold">Полное содержимое</h4>{kind === 'notification' ? <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{currentDetail.body || 'Текст уведомления отсутствует.'}</p> : <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{currentDetail.description || 'Описание отсутствует.'}</p>}{currentDetail.deepLink && (safeLink(currentDetail.deepLink) ? <a className="inline-flex min-h-11 items-center break-all text-sm text-cyan-200 underline" href={safeLink(currentDetail.deepLink)!} target="_blank" rel="noreferrer">Открыть ссылку</a> : <p className="break-all text-xs text-[var(--color-text-muted)]">Ссылка: {currentDetail.deepLink}</p>)}<dl className="grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-[var(--color-text-muted)]">Тип</dt><dd className="mt-1 break-words text-slate-300">{currentDetail.type || currentDetail.category || '—'}</dd></div><div><dt className="text-[var(--color-text-muted)]">Состояние</dt><dd className="mt-1 text-slate-300">{kind === 'notification' ? notificationStatusLabel(currentDetail.status) : inboxStatusLabel[currentDetail.status as InboxStatus] || currentDetail.status}{currentDetail.priority ? ` · ${priorityLabels[currentDetail.priority] || currentDetail.priority}` : ''}</dd></div><div><dt className="text-[var(--color-text-muted)]">Обновлено</dt><dd className="mt-1 text-slate-300">{new Date(currentDetail.updatedAt).toLocaleString('ru-RU')}</dd></div>{kind === 'notification' && <div><dt className="text-[var(--color-text-muted)]">Время прочтения</dt><dd className="mt-1 text-slate-300">{currentDetail.readAt ? new Date(currentDetail.readAt).toLocaleString('ru-RU') : '—'}</dd></div>}{kind === 'inbox' && <><div><dt className="text-[var(--color-text-muted)]">Срок</dt><dd className="mt-1 text-slate-300">{currentDetail.dueAt ? new Date(currentDetail.dueAt).toLocaleString('ru-RU') : '—'}</dd></div><div><dt className="text-[var(--color-text-muted)]">Завершено</dt><dd className="mt-1 text-slate-300">{currentDetail.completedAt ? new Date(currentDetail.completedAt).toLocaleString('ru-RU') : '—'}</dd></div></>}{currentDetail.eventId && <div><dt className="text-[var(--color-text-muted)]">Событие</dt><dd className="mt-1 break-all text-slate-300">{currentDetail.eventId}</dd></div>}</dl><details className="rounded-md border border-slate-700"><summary className="min-h-11 cursor-pointer px-3 py-2 text-sm text-slate-300">Технические данные и действия</summary><div className="space-y-3 border-t border-slate-700 p-3">{currentDetail.data !== undefined && <div><p className="mb-1 text-xs text-[var(--color-text-muted)]">data</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">{JSON.stringify(currentDetail.data, null, 2)}</pre></div>}{currentDetail.actions !== undefined && <div><p className="mb-1 text-xs text-[var(--color-text-muted)]">actions</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">{JSON.stringify(currentDetail.actions, null, 2)}</pre></div>}</div></details></div>
          {canWrite ? <form className="space-y-3 rounded-lg border border-cyan-400/30 p-3" onSubmit={event => { event.preventDefault(); void save(); }}><h4 className="text-sm font-semibold">Исправить запись</h4>
            <label className="block text-sm">Заголовок<input className={inputClass} required maxLength={500} value={String(draft.title || '')} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
            {kind === 'notification' ? <><label className="block text-sm">Текст уведомления<textarea className={`${inputClass} min-h-28`} maxLength={10000} value={String(draft.body || '')} onChange={event => setDraft({ ...draft, body: event.target.value })} /></label><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(draft.isRead)} onChange={event => setDraft({ ...draft, isRead: event.target.checked, readAt: event.target.checked ? String(draft.readAt || toLocalDateTime(new Date().toISOString())) : '' })} />Прочитано</label><label className="block text-sm">Время прочтения<input className={inputClass} type="datetime-local" value={String(draft.readAt || '')} onChange={event => setDraft({ ...draft, readAt: event.target.value, isRead: Boolean(event.target.value) })} /></label></> : <><label className="block text-sm">Описание<textarea className={`${inputClass} min-h-28`} maxLength={10000} value={String(draft.description || '')} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Статус<select className={inputClass} value={String(draft.status || 'open')} onChange={event => setDraft({ ...draft, status: event.target.value, completedAt: event.target.value === 'done' ? String(draft.completedAt || toLocalDateTime(new Date().toISOString())) : '' })}><option value="open">Открыто</option><option value="snoozed">Отложено</option><option value="done">Завершено</option></select></label><label className="block text-sm">Приоритет<select className={inputClass} value={String(draft.priority || 'normal')} onChange={event => setDraft({ ...draft, priority: event.target.value })}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm">Срок<input className={inputClass} type="datetime-local" value={String(draft.dueAt || '')} onChange={event => setDraft({ ...draft, dueAt: event.target.value })} /></label><label className="block text-sm">Время завершения<input className={inputClass} type="datetime-local" value={String(draft.completedAt || '')} onChange={event => setDraft({ ...draft, completedAt: event.target.value })} /></label></div></>}
            <label className="block text-sm">Ссылка<input className={inputClass} type="text" maxLength={2048} value={String(draft.deepLink || '')} onChange={event => setDraft({ ...draft, deepLink: event.target.value })} placeholder="HTTPS или /внутренний-путь" /></label><label className="block text-sm">Причина изменения<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Сохранить исправление'}</Button>
          </form> : <p className="text-xs text-[var(--color-text-muted)]">У вас есть право просмотра. Для исправлений требуется `notification-data.write`.</p>}
        </article>}
      </div>
    </div>
  </section>;
}
