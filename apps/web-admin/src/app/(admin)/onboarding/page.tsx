'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch, apiFetchAllPages, type Me } from '@/lib/api';
import { Button, Card, RequestState } from '@/components/ui';
import StructureStep from './StructureStep';
import AdministratorStep from './AdministratorStep';
import ImportStep from './ImportStep';
import ReadinessStep from './ReadinessStep';
import { errorMessage, fieldClass, type Account, type Faculty, type Group, type University } from './types';

const steps = ['Вуз', 'Факультеты и группы', 'Администратор', 'Импорт расписания', 'Готовность'];
type Profile = Me & { role: string };
export default function OnboardingPage() {
  const [profile, setProfile] = useState<Profile | null>(null), [owner, setOwner] = useState(false), [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [universities, setUniversities] = useState<University[]>([]), [university, setUniversity] = useState<University | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]), [groups, setGroups] = useState<Group[]>([]), [users, setUsers] = useState<Account[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [step, setStep] = useState(0), [form, setForm] = useState({ name: '', city: '' });
  const heading = useRef<HTMLHeadingElement>(null), generation = useRef(0);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const actor = await apiFetch<Profile>('/users/me'); setProfile(actor);
      if (['developer', 'superadmin'].includes(actor.role)) {
        const access = await apiFetch<{ owner: boolean }>('/platform/access');
        setOwner(access.owner); setAllowed(access.owner);
        if (access.owner) { setUniversities(await apiFetchAllPages<University>('/platform/universities')); setUncertain(false); }
      } else {
        setOwner(false); setAllowed(actor.role === 'university_admin' && !!actor.universityId);
        if (actor.role === 'university_admin' && actor.universityId) setUniversity(await apiFetch<University>('/admin/university'));
      }
    } catch (cause) { setError(errorMessage(cause)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const reload = useCallback(async () => {
    if (!university) return;
    const id = university.id, current = ++generation.current;
    const suffix = owner ? `?universityId=${id}` : '';
    const [nextFaculties, nextGroups, nextUsers] = await Promise.all([
      apiFetchAllPages<Faculty>(owner ? `/platform/organization/faculties${suffix}` : '/admin/faculties'),
      apiFetchAllPages<Group>(owner ? `/platform/organization/groups${suffix}` : '/admin/groups'),
      apiFetchAllPages<Account>(owner ? `/platform/accounts${suffix}` : '/admin/users'),
    ]);
    if (generation.current === current) { setFaculties(nextFaculties); setGroups(nextGroups); setUsers(nextUsers); setDataReady(true); }
  }, [university, owner]);
  useEffect(() => {
    setFaculties([]); setGroups([]); setUsers([]); setDataReady(false);
    void reload().catch(cause => setError(errorMessage(cause)));
    return () => { generation.current++; };
  }, [reload]);
  useEffect(() => { heading.current?.focus(); }, [step]);
  async function createUniversity(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const saved = await apiFetch<University>('/platform/universities', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), city: form.city.trim(), status: 'pending' }) });
      setUniversities(current => [...current, saved]); setUniversity(saved); setForm({ name: '', city: '' }); setStep(1);
    } catch (cause) { setUncertain(true); setError(`${errorMessage(cause)} Перед повторным созданием обновите список вузов и убедитесь, что запись не появилась.`); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status" className="p-6 text-slate-700">Загружаем мастер настройки…</p>;
  if (error && !profile) return <RequestState title="Не удалось открыть мастер" description={error} onRetry={() => void load()} />;
  if (!allowed) return <Card><h1 className="text-2xl font-bold">Мастер недоступен</h1><p className="mt-3 text-slate-700">Создание вуза доступно владельцу платформы, настройка своего вуза — его администратору.</p>{error && <p role="alert" className="mt-3 text-red-800">{error}</p>}<Button className="mt-4" variant="secondary" onClick={() => void load()}>Проверить доступ повторно</Button></Card>;
  return <div className="space-y-6 text-slate-950">
    <div><Link href="/university" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700">← Настройки университета</Link><h1 ref={heading} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">{owner ? 'Новый вуз' : 'Подключение вуза'}</h1><p className="mt-2 text-slate-600">{university?.name || 'Создайте вуз или продолжите настройку существующего.'}</p></div>
    <nav aria-label="Шаги первичной настройки"><ol className="flex flex-wrap gap-2">{steps.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? 'step' : undefined} disabled={busy || (index > 0 && !university) || (owner && index >= 3)} className={`min-h-11 rounded-xl px-4 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50 ${step === index ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`} onClick={() => { setStep(index); setError(''); }}>{index + 1}. {label}</button></li>)}</ol></nav>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4"><p className="break-words text-red-800">{error}</p><Button className="mt-3" variant="secondary" onClick={() => { setError(''); void reload().catch(cause => setError(errorMessage(cause))); }}>Перечитать данные</Button></div>}
    {step === 0 && <Card><h2 className="text-xl font-bold">{owner ? 'Создать или выбрать вуз' : 'Данные своего вуза'}</h2>{owner ? <>
      <label className="mt-5 grid gap-2 text-sm font-semibold">Продолжить настройку<select disabled={busy} className={fieldClass} value={university?.id || ''} onChange={event => { setUniversity(universities.find(row => row.id === event.target.value) || null); setError(''); }}><option value="">Новый вуз</option>{universities.map(row => <option key={row.id} value={row.id}>{row.name} · {row.city}</option>)}</select></label>
      <Button variant="secondary" className="mt-3" onClick={() => void load()}>Обновить список вузов</Button>
      {!university && <form onSubmit={event => void createUniversity(event)} className="mt-5 grid max-w-xl gap-4"><label className="grid gap-2 text-sm font-semibold">Название вуза<input required maxLength={200} className={fieldClass} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label><label className="grid gap-2 text-sm font-semibold">Город<input required maxLength={100} className={fieldClass} value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} /></label><p className="text-sm text-slate-600">Статус новой записи — «Ожидает активации». Сначала завершите учебную и эксплуатационную проверку.</p><Button type="submit" loading={busy} disabled={busy || uncertain || !form.name.trim() || !form.city.trim()}>Создать вуз</Button></form>}
    </> : <p className="mt-4">{university?.name} · {university?.city}. Для исправления откройте <Link href="/university" className="font-semibold text-indigo-700 underline">настройки</Link>. Новый вуз создаёт владелец платформы.</p>}</Card>}
    {university && step > 0 && !dataReady && <Card><p role="status">Структура и аккаунты ещё не загружены. При ошибке перечитайте данные, прежде чем создавать записи.</p></Card>}
    {university && dataReady && <div key={university.id}>{step === 1 && <StructureStep universityId={university.id} owner={owner} faculties={faculties} groups={groups} reload={reload} />}{step === 2 && <AdministratorStep universityId={university.id} owner={owner} users={users} reload={reload} />}{step === 3 && !owner && profile && <ImportStep actorId={profile.id} universityId={university.id} groups={groups} />}{step === 4 && !owner && <ReadinessStep university={university} />}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" disabled={step === 0 || busy} onClick={() => setStep(value => value - 1)}>Предыдущий шаг</Button>{step < (owner ? 2 : 4) && <Button disabled={!university || busy} onClick={() => setStep(value => value + 1)}>Следующий шаг</Button>}</div>
  </div>;
}
