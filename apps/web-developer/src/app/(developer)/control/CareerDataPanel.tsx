'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, roles, useResource } from './control-ui';

type CareerTab = 'profiles' | 'admissions';
interface UniversityOption { id: string; name: string; city: string }
interface Profile { id: string; studentId: string; studentName: string; studentEmail: string; universityId: string; universityName: string; headline: string; about?: string; skills: string[]; verification: 'pending' | 'verified' | 'rejected'; createdAt: string; updatedAt: string }
interface Admission { id: string; studentId: string; studentName: string; studentEmail: string; universityId: string; universityName: string; skill: string; evidence?: string; state: 'pending' | 'approved' | 'rejected'; reason?: string; basis: string; createdAt: string; updatedAt: string }
type Selected = { kind: 'profile'; item: Profile } | { kind: 'admission'; item: Admission };
const profileStates = { pending: 'Ожидает проверки', verified: 'Проверен', rejected: 'Отклонён' };
const admissionStates = { pending: 'Ожидает решения', approved: 'Допущен', rejected: 'Отклонён' };

export default function CareerDataPanel({ access }: { access: Access }) {
  const [tab, setTab] = useState<CareerTab>('profiles');
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const writable = access.permissions.includes('career-data.write');
  const universityOptions = useResource<Page<UniversityOption>>(access.permissions.includes('universities.read') ? '/platform/universities?limit=100' : null);
  const filters = new URLSearchParams({ page: String(page), limit: '20' });
  if (query.trim()) filters.set('q', query.trim());
  if (state) filters.set(tab === 'profiles' ? 'verification' : 'state', state);
  if (universityId) filters.set('universityId', universityId);
  const list = useResource<Page<Profile | Admission>>(`/platform-career/${tab}?${filters.toString()}`);
  const refresh = () => list.refresh();

  const open = async (item: Profile | Admission) => {
    const isProfile = tab === 'profiles';
    setBusy(true); setError(''); setNotice(''); setSelected(null);
    try {
      const detail = isProfile
        ? await apiFetch<Profile>(`/platform-career/profiles/${item.id}`)
        : await apiFetch<Admission>(`/platform-career/admissions/${item.id}`);
      setSelected(isProfile ? { kind: 'profile', item: detail as Profile } : { kind: 'admission', item: detail as Admission });
      setDraft(isProfile
        ? { headline: (detail as Profile).headline, about: (detail as Profile).about ?? '', skills: (detail as Profile).skills.join('\n') }
        : { skill: (detail as Admission).skill, evidence: (detail as Admission).evidence ?? '' });
      setReason('');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const close = () => { setSelected(null); setDraft({}); setReason(''); };
  const save = async () => {
    if (!selected || !writable || reason.trim().length < 3 || busy) return;
    const path = selected.kind === 'profile' ? `/platform-career/profiles/${selected.item.id}` : `/platform-career/admissions/${selected.item.id}`;
    const payload = selected.kind === 'profile'
      ? { headline: draft.headline, about: draft.about, skills: draft.skills.split('\n'), reason: reason.trim() }
      : { skill: draft.skill, evidence: draft.evidence, reason: reason.trim() };
    setBusy(true); setError(''); setNotice('');
    try { await apiFetch(path, { method: 'PATCH', body: JSON.stringify(payload) }); close(); refresh(); setNotice('Запись сохранена; профиль или допуск возвращён на повторную проверку. Изменение записано в аудит.'); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const decide = async (decision: 'approved' | 'rejected') => {
    if (!selected || !writable || reason.trim().length < 3 || busy) return;
    const path = selected.kind === 'profile' ? `/platform-career/profiles/${selected.item.id}/decision` : `/platform-career/admissions/${selected.item.id}/decision`;
    setBusy(true); setError(''); setNotice('');
    try { await apiFetch(path, { method: 'POST', body: JSON.stringify({ decision, reason: reason.trim() }) }); close(); refresh(); setNotice(decision === 'approved' ? 'Решение одобрено и записано в аудит.' : 'Запись отклонена и решение записано в аудит.'); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Карьерные профили и допуски</h2><p className="mt-1 text-sm text-slate-400">Глобальный просмотр заявок студентов. Исправление текста сбрасывает прежнюю проверку и требует нового решения.</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Тип карьерных записей"><Button aria-pressed={tab === 'profiles'} onClick={() => { setTab('profiles'); setState(''); setPage(1); close(); }} className={tab === 'profiles' ? '!border-cyan-400 !bg-cyan-400/10' : ''}>Профили</Button><Button aria-pressed={tab === 'admissions'} onClick={() => { setTab('admissions'); setState(''); setPage(1); close(); }} className={tab === 'admissions' ? '!border-cyan-400 !bg-cyan-400/10' : ''}>Допуски</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-sm">Поиск по пользователю и записи<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="ФИО, email, ID, текст" /></label>
      {universityOptions.data && <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все университеты</option>{universityOptions.data.data.map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>}
      <label className="block text-sm">Статус<select className={inputClass} value={state} onChange={event => { setState(event.target.value); setPage(1); }}><option value="">Любой статус</option>{Object.entries(tab === 'profiles' ? profileStates : admissionStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {(error || list.error || universityOptions.error) && <Notice error>{error || list.error || universityOptions.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    {list.loading && <p role="status" className="text-sm text-slate-400">Загружаем карьерные записи…</p>}
    <div className="divide-y divide-slate-700 rounded-xl border border-slate-700">
      {list.data?.data.map(item => tab === 'profiles' ? (() => { const profile = item as Profile; return <article key={profile.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-semibold">{profile.studentName || profile.studentId}</p><p className="mt-1 break-all text-xs text-slate-400">{profile.studentEmail} · {profile.universityName} · {profile.studentId}</p><p className="mt-2 text-sm">{profile.headline}</p><p className="mt-1 text-xs text-cyan-200">{profileStates[profile.verification]} · {profile.skills.join(', ') || 'направления не указаны'}</p></div><Button disabled={busy} onClick={() => void open(profile)}>{writable ? 'Открыть и управлять' : 'Просмотреть'}</Button></article>; })() : (() => { const admission = item as Admission; return <article key={admission.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-semibold">{admission.studentName || admission.studentId} · {admission.skill}</p><p className="mt-1 break-all text-xs text-slate-400">{admission.studentEmail} · {admission.universityName} · основание: {admission.basis}</p><p className="mt-1 text-xs text-cyan-200">{admissionStates[admission.state]}</p></div><Button disabled={busy} onClick={() => void open(admission)}>{writable ? 'Открыть и управлять' : 'Просмотреть'}</Button></article>; })())}
    </div>
    {list.data?.data.length === 0 && <p className="text-sm text-slate-400">По этому запросу записей нет.</p>}{list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
    {selected && <section className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{selected.item.studentName || selected.item.studentId}</h3><p className="mt-1 break-all text-xs text-slate-400">{selected.item.studentEmail} · {selected.item.universityName} · запись {selected.item.id}</p></div><Button disabled={busy} onClick={close}>Закрыть</Button></div>
      {!writable && <Notice>У вас есть право просмотра. Для изменения или решения требуется разрешение владельца платформы.</Notice>}
      {!writable && (selected.kind === 'profile'
        ? <div className="space-y-2 text-sm"><p className="font-medium">{selected.item.headline}</p><p className="whitespace-pre-wrap break-words text-slate-300">{selected.item.about}</p><p className="text-cyan-200">{selected.item.skills.join(', ') || 'Навыки не указаны'}</p></div>
        : <div className="space-y-2 text-sm"><p className="font-medium">{selected.item.skill} · {admissionStates[selected.item.state]}</p><p className="whitespace-pre-wrap break-words text-slate-300">{selected.item.evidence}</p><p className="text-xs text-slate-400">{selected.item.reason}</p></div>)}
      {writable && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
        {selected.kind === 'profile' ? <><label className="block text-sm">Заголовок профиля<input className={inputClass} maxLength={180} value={draft.headline || ''} onChange={event => setDraft({ ...draft, headline: event.target.value })} /></label><label className="block text-sm">О себе<textarea className={`${inputClass} min-h-28`} maxLength={4000} value={draft.about || ''} onChange={event => setDraft({ ...draft, about: event.target.value })} /></label><label className="block text-sm">Направления и навыки, по одному в строке<textarea className={`${inputClass} min-h-24`} maxLength={2000} value={draft.skills || ''} onChange={event => setDraft({ ...draft, skills: event.target.value })} /></label></> : <><label className="block text-sm">Направление<input className={inputClass} maxLength={80} value={draft.skill || ''} onChange={event => setDraft({ ...draft, skill: event.target.value })} /></label><label className="block text-sm">Обоснование<textarea className={`${inputClass} min-h-28`} maxLength={4000} value={draft.evidence || ''} onChange={event => setDraft({ ...draft, evidence: event.target.value })} /></label></>}
        <label className="block text-sm">Причина администрирования<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Например: исправление после обращения пользователя" /></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Сохранить и вернуть на проверку'}</Button><Button disabled={busy || reason.trim().length < 3} onClick={() => void decide('approved')}>Одобрить</Button><Button disabled={busy || reason.trim().length < 3} onClick={() => void decide('rejected')}>Отклонить</Button></div>
      </form>}
    </section>}
  </section>;
}
