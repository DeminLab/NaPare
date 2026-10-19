'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

interface Assignment {
  id: string; universityId: string; universityName: string; groupId: string; groupName: string; groupExternalId: string | null;
  userId: string; userName: string; userEmail: string; userRole: string; status: 'active' | 'revoked'; grantedBy: string;
  createdAt: string; revokedAt: string | null; revokedBy: string | null;
}
interface AssignmentDetail {
  assignment: Pick<Assignment, 'id' | 'universityId' | 'createdAt' | 'revokedAt' | 'grantedBy' | 'revokedBy' | 'status'>;
  university: { id: string; name: string; city: string };
  group: { id: string; name: string; externalId: string | null };
  user: { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; universityId: string };
  grantedByUser: { id: string; firstName: string; lastName: string; email: string } | null;
  revokedByUser: { id: string; firstName: string; lastName: string; email: string } | null;
}
interface University { id: string; name: string; city?: string }
interface Group { id: string; name: string; externalId: string | null; universityId: string }
interface Candidate { id: string; firstName: string; lastName: string; email: string; role: string }
type StatusFilter = 'all' | 'active' | 'revoked';
const roleNames: Record<string, string> = { student: 'Студент', teacher: 'Преподаватель', curator: 'Куратор', faculty_dean: 'Деканат', department_head: 'Заведующий кафедрой', university_admin: 'Администратор вуза' };
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleString('ru-RU') : '—';
const personName = (user: { firstName: string; lastName: string }) => `${user.lastName} ${user.firstName}`.trim();

export default function CuratorAssignmentsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [showGrant, setShowGrant] = useState(false);
  const [grantUniversityId, setGrantUniversityId] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const [candidatePage, setCandidatePage] = useState(1);
  const [groupId, setGroupId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('curation-data.write');

  const universities = useResource<Page<University>>(access.permissions.includes('universities.read') ? '/platform/universities?page=1&limit=100' : null);
  const filters = new URLSearchParams({ q: query.slice(0, 100), status, page: String(page), limit: '20' });
  if (universityId) filters.set('universityId', universityId);
  const list = useResource<Page<Assignment>>(`/platform-curation/assignments?${filters.toString()}`);
  const details = useResource<AssignmentDetail>(selectedId ? `/platform-curation/assignments/${selectedId}` : null);
  const groupFilters = new URLSearchParams({ universityId: grantUniversityId, q: groupQuery.slice(0, 100), page: String(groupPage), limit: '20' });
  const candidateFilters = new URLSearchParams({ universityId: grantUniversityId, q: candidateQuery.slice(0, 100), page: String(candidatePage), limit: '20' });
  const groups = useResource<Page<Group>>(grantUniversityId ? `/platform-curation/groups?${groupFilters.toString()}` : null);
  const candidates = useResource<Page<Candidate>>(grantUniversityId ? `/platform-curation/candidates?${candidateFilters.toString()}` : null);

  const resetMessages = () => { setError(''); setNotice(''); };
  const updateFilter = (update: () => void) => { update(); setPage(1); setSelectedId(''); resetMessages(); };
  const openGrant = () => { setShowGrant(true); setGrantUniversityId(universityId); setGroupId(''); setCandidateId(''); setGroupQuery(''); setCandidateQuery(''); setGroupPage(1); setCandidatePage(1); setReason(''); resetMessages(); };
  const closeGrant = () => { setShowGrant(false); setGroupId(''); setCandidateId(''); setReason(''); };
  const grant = async () => {
    if (!groupId || !candidateId || reason.trim().length < 3 || busy) return;
    setBusy(true); resetMessages();
    try {
      await apiFetch('/platform-curation/assignments', { method: 'POST', body: JSON.stringify({ groupId, userId: candidateId, reason: reason.trim() }) });
      closeGrant(); setStatus('active'); setPage(1); setNotice('Куратор назначен. Действие добавлено в аудит.'); list.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!selectedId || !details.data || details.data.assignment.status !== 'active' || reason.trim().length < 3 || busy) return;
    setBusy(true); resetMessages();
    try {
      await apiFetch(`/platform-curation/assignments/${selectedId}/revoke`, { method: 'PATCH', body: JSON.stringify({ reason: reason.trim() }) });
      setNotice('Назначение отозвано. История сохранена в аудите.'); setReason(''); details.refresh(); list.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const current = details.data?.assignment.id === selectedId ? details.data : null;
  const universityOptions = universities.data?.data || [];

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Назначения кураторов</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Глобальная история доступа кураторов к учебным группам. Назначение и мягкий отзыв требуют причины и записываются в аудит.</p></div>{canWrite && <Button onClick={openGrant}>Назначить куратора</Button>}</div>
    {(error || list.error || details.error || universities.error) && <Notice error>{error || list.error || details.error || universities.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">Поиск<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => updateFilter(() => setQuery(event.target.value))} placeholder="Куратор, группа, email или ID" /></label>
      <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => updateFilter(() => setUniversityId(event.target.value))}><option value="">Все университеты</option>{universityOptions.map(item => <option key={item.id} value={item.id}>{item.name}{item.city ? ` · ${item.city}` : ''}</option>)}</select></label>
      <label className="block text-sm">Состояние<select className={inputClass} value={status} onChange={event => updateFilter(() => setStatus(event.target.value as StatusFilter))}><option value="active">Действующие</option><option value="revoked">Отозванные</option><option value="all">Все</option></select></label>
    </div>
    {list.loading && <p role="status" className="text-sm text-slate-400">Загружаем назначения…</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0"><div className="max-h-[38rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">
        {list.data?.data.map(item => <button key={item.id} aria-pressed={selectedId === item.id} className={`block min-h-24 w-full p-3 text-left hover:bg-slate-800 ${selectedId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setSelectedId(item.id); setReason(''); resetMessages(); }}>
          <span className="flex flex-wrap items-center justify-between gap-2"><span className="break-words text-sm font-semibold">{item.groupName}</span><span className={`rounded-full px-2 py-0.5 text-xs ${item.status === 'active' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{item.status === 'active' ? 'Действует' : 'Отозвано'}</span></span>
          <span className="mt-1 block break-all text-xs text-slate-300">{item.userName || item.userEmail} · {item.userEmail}</span><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{item.universityName} · {roleNames[item.userRole] || item.userRole} · {dateLabel(item.createdAt)}</span>
        </button>)}
      </div>{list.data && <><p className="mt-2 text-xs text-[var(--color-text-muted)]">Найдено назначений: {list.data.meta.total}</p><Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} /></>}{list.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-400">Назначения не найдены.</p>}</div>
      <div className="min-w-0 space-y-4">
        {!selectedId && <div className={panelClass}><p className="text-sm text-slate-400">Выберите назначение, чтобы увидеть связанные университет, группу, пользователя и историю отзыва.</p></div>}
        {selectedId && details.loading && <p role="status" className="text-sm text-slate-400">Открываем историю назначения…</p>}
        {current && <article className={`${panelClass} space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{current.group.name}</h3><p className="mt-1 text-sm text-slate-300">{current.university.name}{current.university.city ? ` · ${current.university.city}` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${current.assignment.status === 'active' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{current.assignment.status === 'active' ? 'Действует' : 'Отозвано'}</span></div>
          <p className="break-all font-mono text-xs text-[var(--color-text-muted)]">Назначение {current.assignment.id}</p>
          <div className="rounded-lg border border-slate-700 p-3"><h4 className="text-sm font-semibold">Куратор</h4><p className="mt-1 text-sm text-slate-200">{personName(current.user)} · {roleNames[current.user.role] || current.user.role}</p><p className="break-all text-xs text-slate-400">{current.user.email}</p><p className="mt-1 break-all text-xs text-[var(--color-text-muted)]">ID {current.user.id} · {current.user.isActive ? 'Аккаунт активен' : 'Аккаунт отключён'}</p></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--color-text-muted)]">Группа</dt><dd className="mt-1 text-slate-300">{current.group.name}{current.group.externalId ? ` · внешний ID ${current.group.externalId}` : ''}</dd><dd className="break-all text-xs text-[var(--color-text-muted)]">{current.group.id}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">Назначено</dt><dd className="mt-1 text-slate-300">{dateLabel(current.assignment.createdAt)}</dd><dd className="mt-1 text-xs text-slate-400">{current.grantedByUser ? `${personName(current.grantedByUser)} · ${current.grantedByUser.email}` : `ID ${current.assignment.grantedBy}`}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">Отозвано</dt><dd className="mt-1 text-slate-300">{dateLabel(current.assignment.revokedAt)}</dd><dd className="mt-1 text-xs text-slate-400">{current.revokedByUser ? `${personName(current.revokedByUser)} · ${current.revokedByUser.email}` : current.assignment.revokedBy ? `ID ${current.assignment.revokedBy}` : '—'}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">Университет / группа</dt><dd className="mt-1 break-all text-xs text-slate-400">{current.assignment.universityId} · {current.group.id}</dd></div></dl>
          {current.assignment.status === 'active' && canWrite && <form className="space-y-3 rounded-lg border border-amber-400/30 p-3" onSubmit={event => { event.preventDefault(); void revoke(); }}><h4 className="text-sm font-semibold">Мягко отозвать назначение</h4><p className="text-xs text-slate-400">Историческая запись останется доступна для просмотра.</p><label className="block text-sm">Причина отзыва<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Отзываем…' : 'Отозвать назначение'}</Button></form>}
          {current.assignment.status === 'active' && !canWrite && <p className="text-xs text-[var(--color-text-muted)]">Для отзыва требуется `curation-data.write`.</p>}
        </article>}
      </div>
    </div>
    {showGrant && <form className={`${panelClass} space-y-4 !border-cyan-400/30`} onSubmit={event => { event.preventDefault(); void grant(); }}>
      <div><h3 className="font-semibold">Новое назначение</h3><p className="mt-1 text-sm text-slate-400">Выберите университет, группу и активный аккаунт. Сервер повторно проверяет, что пользователь и группа относятся к этому университету.</p></div>
      {error && <Notice error>{error}</Notice>}
      <label className="block text-sm">Университет<select className={inputClass} required value={grantUniversityId} onChange={event => { setGrantUniversityId(event.target.value); setGroupId(''); setCandidateId(''); setGroupQuery(''); setCandidateQuery(''); setGroupPage(1); setCandidatePage(1); }}><option value="">Выберите университет</option>{universityOptions.map(item => <option key={item.id} value={item.id}>{item.name}{item.city ? ` · ${item.city}` : ''}</option>)}</select></label>
      {!universityOptions.length && !universities.loading && <p className="text-xs text-[var(--color-text-muted)]">Для списка университетов требуется разрешение `universities.read`.</p>}
      {grantUniversityId && <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><label className="block text-sm">Найти группу<input className={inputClass} maxLength={100} value={groupQuery} onChange={event => { setGroupQuery(event.target.value); setGroupId(''); setGroupPage(1); }} placeholder="Название или внешний ID" /></label>{groups.error && <Notice error>{groups.error}</Notice>}{groups.loading && <p role="status" className="text-xs text-slate-400">Ищем группы…</p>}<div className="max-h-52 divide-y divide-slate-700 overflow-y-auto rounded-lg border border-slate-700">{groups.data?.data.map(group => <button key={group.id} type="button" aria-pressed={groupId === group.id} className={`block min-h-14 w-full p-3 text-left text-sm hover:bg-slate-800 ${groupId === group.id ? 'bg-cyan-400/10' : ''}`} onClick={() => setGroupId(group.id)}><span className="block font-medium">{group.name}</span><span className="text-xs text-[var(--color-text-muted)]">{group.externalId ? `Внешний ID ${group.externalId} · ` : ''}{group.id}</span></button>)}{groups.data?.data.length === 0 && <p className="p-3 text-xs text-[var(--color-text-muted)]">Группы не найдены.</p>}</div>{groups.data && <Pager page={groupPage} totalPages={groups.data.meta.totalPages} onChange={setGroupPage} />}{groupId && <p className="text-xs text-cyan-200">Группа выбрана</p>}</div>
        <div className="space-y-2"><label className="block text-sm">Найти пользователя<input className={inputClass} maxLength={100} value={candidateQuery} onChange={event => { setCandidateQuery(event.target.value); setCandidateId(''); setCandidatePage(1); }} placeholder="ФИО, email или ID" /></label>{candidates.error && <Notice error>{candidates.error}</Notice>}{candidates.loading && <p role="status" className="text-xs text-slate-400">Ищем пользователей…</p>}<div className="max-h-52 divide-y divide-slate-700 overflow-y-auto rounded-lg border border-slate-700">{candidates.data?.data.map(user => <button key={user.id} type="button" aria-pressed={candidateId === user.id} className={`block min-h-14 w-full p-3 text-left text-sm hover:bg-slate-800 ${candidateId === user.id ? 'bg-cyan-400/10' : ''}`} onClick={() => setCandidateId(user.id)}><span className="block font-medium">{personName(user)}</span><span className="block break-all text-xs text-slate-400">{user.email}</span><span className="text-xs text-[var(--color-text-muted)]">{roleNames[user.role] || user.role}</span></button>)}{candidates.data?.data.length === 0 && <p className="p-3 text-xs text-[var(--color-text-muted)]">Подходящие пользователи не найдены.</p>}</div>{candidates.data && <Pager page={candidatePage} totalPages={candidates.data.meta.totalPages} onChange={setCandidatePage} />}{candidateId && <p className="text-xs text-cyan-200">Пользователь выбран</p>}</div>
      </div>}
      <label className="block text-sm">Причина назначения<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !grantUniversityId || !groupId || !candidateId || reason.trim().length < 3}>{busy ? 'Назначаем…' : 'Назначить куратора'}</Button><Button disabled={busy} onClick={closeGrant}>Отмена</Button></div>
    </form>}
  </section>;
}
