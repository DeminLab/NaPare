'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LessonTypeBadge } from './LessonTypeBadge';

type Fetcher = <T>(path: string, init?: RequestInit) => Promise<T>;
interface Context { canCurate: boolean; canManage: boolean; groupCount: number }
interface Page<T> { data: T[]; meta: { page: number; totalPages: number; total: number } }
interface Group { id: string; name: string }
interface Person { id: string; userId?: string; firstName: string; lastName: string; email?: string; role?: string }
interface Lesson { id: string; subject: string; subjectType?: string; startDate: string; startTime: string; endTime: string; room?: string; teacherName?: string }
interface Absence { id: string; studentId: string; startDate: string; endDate: string; comment?: string; type: string; canReview: boolean; student: Person | null }
const button = 'curation-button';
const primary = `${button} curation-button--primary`;
const input = 'curation-input';
const roles: Record<string, string> = { student: 'Студент', teacher: 'Преподаватель', curator: 'Куратор', faculty_dean: 'Деканат', department_head: 'Заведующий кафедрой', university_admin: 'Администратор' };
const message = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос.';
const date = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const time = (value: string) => value.includes('T') ? value.slice(11, 16) : value.slice(0, 5);

function Pager({ page, totalPages, busy, onChange }: { page: number; totalPages: number; busy: boolean; onChange: (value: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Страницы списка" className="flex flex-wrap items-center justify-between gap-2 pt-3"><button className={button} disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>Назад</button><span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span><button className={button} disabled={busy || page >= totalPages} onClick={() => onChange(page + 1)}>Далее</button></nav>;
}

/** Discover grants on focus and periodically; rights never live in a stale JWT or local storage. */
export function useCurationContext(apiFetch: Fetcher, enabled = true) {
  const [context, setContext] = useState<Context | null>(null);
  useEffect(() => {
    if (!enabled) { setContext(null); return; }
    let active = true;
    const load = () => { void apiFetch<Context>('/curation/context', { cache: 'no-store' }).then(result => { if (active) setContext(result); }).catch(() => { if (active) setContext(null); }); };
    load(); window.addEventListener('focus', load); const timer = window.setInterval(load, 30000);
    return () => { active = false; window.removeEventListener('focus', load); window.clearInterval(timer); };
  }, [apiFetch, enabled]);
  return context;
}

export function CurationEntry({ apiFetch, basePath }: { apiFetch: Fetcher; basePath: string }) {
  const context = useCurationContext(apiFetch);
  if (!context || (!context.canCurate && !context.canManage)) return null;
  return <a href={`${basePath}/curation`} className="curation-entry"><span>Кураторство{context.groupCount > 0 ? ` · ${context.groupCount} групп` : ''}</span><span>{context.canManage ? 'Назначения' : 'Открыть'} <span aria-hidden="true">→</span></span></a>;
}

export function CurationWorkspace({ apiFetch, showCounts = false }: { apiFetch: Fetcher; showCounts?: boolean }) {
  const [context, setContext] = useState<Context | null>(null);
  const [mode, setMode] = useState<'mine' | 'manage'>('mine');
  const [contextError, setContextError] = useState('');
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const [groups, setGroups] = useState<Page<Group> | null>(null);
  const [selected, setSelected] = useState<Group | null>(null);
  const [groupsError, setGroupsError] = useState('');
  const [groupsBusy, setGroupsBusy] = useState(false);
  const [tab, setTab] = useState<'absences' | 'students' | 'lessons'>('absences');
  const [detailPage, setDetailPage] = useState(1);
  const [detail, setDetail] = useState<Page<Absence | Person | Lesson> | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<{ absence: Absence; status: 'confirm' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [focusedAbsence, setFocusedAbsence] = useState('');
  const [linkError, setLinkError] = useState('');
  const [curators, setCurators] = useState<Page<Person> | null>(null);
  const [curatorPage, setCuratorPage] = useState(1);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidates, setCandidates] = useState<Page<Person> | null>(null);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [remove, setRemove] = useState<Person | null>(null);
  const detailGeneration = useRef(0);
  const decisionRef = useRef<HTMLTextAreaElement>(null);
  const decisionTriggerRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('absence');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    const abort = new AbortController();
    void apiFetch<Group>(`/curation/absences/${id}/context`, { signal: abort.signal, cache: 'no-store' }).then(group => {
      if (!abort.signal.aborted) { setSelected(group); setFocusedAbsence(id); }
    }).catch(reason => { if (!abort.signal.aborted) setLinkError(message(reason)); });
    return () => abort.abort();
  }, [apiFetch]);
  useEffect(() => {
    let active = true;
    const load = () => { void apiFetch<Context>('/curation/context', { cache: 'no-store' }).then(result => {
      if (!active) return;
      setContext(result); setContextError('');
      if (!result.canManage) setMode('mine');
      if (!result.canCurate && !result.canManage) { setSelected(null); setDetail(null); }
    }).catch(reason => { if (active) { setContextError(message(reason)); setSelected(null); setDetail(null); } }); };
    load(); window.addEventListener('focus', load); const timer = window.setInterval(load, 30000);
    return () => { active = false; window.removeEventListener('focus', load); window.clearInterval(timer); };
  }, [apiFetch, revision]);
  useEffect(() => {
    if (!context || (mode === 'manage' && !context.canManage)) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      setGroupsBusy(true); setGroupsError('');
      void apiFetch<Page<Group>>(`/curation/${mode === 'manage' ? 'manage/' : ''}groups?q=${encodeURIComponent(query)}&page=${groupPage}&limit=20`, { signal: abort.signal, cache: 'no-store' }).then(result => { if (!abort.signal.aborted) setGroups(result); }).catch(reason => { if (!abort.signal.aborted) { setGroups(null); setGroupsError(message(reason)); } }).finally(() => { if (!abort.signal.aborted) setGroupsBusy(false); });
    }, 180);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [apiFetch, context, mode, query, groupPage, revision]);
  useEffect(() => {
    if (!selected || !context) return;
    const generation = ++detailGeneration.current;
    const abort = new AbortController();
    setDetail(null); setCurators(null); setDetailError(''); setDetailBusy(true);
    const path = mode === 'manage' ? `/curation/groups/${selected.id}/curators?page=${curatorPage}&limit=20` : tab === 'absences' ? `/curation/absences?groupId=${selected.id}&status=pending&page=${detailPage}&limit=20${focusedAbsence ? `&absenceId=${focusedAbsence}` : ''}` : `/curation/groups/${selected.id}/${tab}?page=${detailPage}&limit=20`;
    void apiFetch<Page<Absence | Person | Lesson>>(path, { signal: abort.signal, cache: 'no-store' }).then(result => {
      if (abort.signal.aborted || generation !== detailGeneration.current) return;
      if (mode === 'manage') setCurators(result as Page<Person>); else setDetail(result);
    }).catch(reason => { if (!abort.signal.aborted) { setDetailError(message(reason)); setDecision(null); setRemove(null); } }).finally(() => { if (!abort.signal.aborted) setDetailBusy(false); });
    return () => abort.abort();
  }, [apiFetch, selected, context, mode, tab, detailPage, curatorPage, revision, focusedAbsence]);
  useEffect(() => {
    setCandidates(null); setCandidateError('');
    setCandidateBusy(false);
    if (mode !== 'manage' || !selected || candidateQuery.trim().length < 2) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      setCandidateBusy(true);
      void apiFetch<Page<Person>>(`/curation/manage/candidates?q=${encodeURIComponent(candidateQuery.trim())}&page=${candidatePage}&limit=10`, { signal: abort.signal, cache: 'no-store' }).then(result => { if (!abort.signal.aborted) setCandidates(result); }).catch(reason => { if (!abort.signal.aborted) setCandidateError(message(reason)); }).finally(() => { if (!abort.signal.aborted) setCandidateBusy(false); });
    }, 250);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [apiFetch, mode, selected, candidateQuery, candidatePage, revision]);
  useEffect(() => { if (decision) decisionRef.current?.focus(); }, [decision]);

  const choose = (group: Group) => { setSelected(group); setFocusedAbsence(''); setDetail(null); setCurators(null); setDetailError(''); setNotice(''); setDecision(null); setRemove(null); setComment(''); setDetailPage(1); setCuratorPage(1); setCandidateQuery(''); setCandidates(null); };
  const changeMode = (value: 'mine' | 'manage') => { setMode(value); setSelected(null); setGroups(null); setQuery(''); setGroupPage(1); setDecision(null); setRemove(null); setNotice(''); };
  const assign = async (person: Person, grant: boolean) => {
    if (!selected || busy) return;
    setBusy(true); setNotice('');
    try {
      await apiFetch(`/curation/groups/${selected.id}/curators/${person.userId || person.id}`, { method: grant ? 'PUT' : 'DELETE' });
      setNotice(grant ? 'Куратор назначен. Его основной аккаунт сохранён.' : 'Кураторство снято.'); setRemove(null); refresh();
    } catch (reason) { setNotice(message(reason)); }
    finally { setBusy(false); }
  };
  const review = async () => {
    if (!decision || busy || (decision.status === 'reject' && !comment.trim())) return;
    const target = decision;
    setBusy(true); setNotice('');
    try {
      await apiFetch(`/curator/absences/${target.absence.id}/${target.status}`, { method: 'PATCH', body: JSON.stringify(target.status === 'reject' ? { reason: comment.trim() } : { comment: comment.trim() || undefined }) });
      setDecision(null); setFocusedAbsence(''); setComment(''); setDetail(null); setNotice(target.status === 'reject' ? 'Обращение отклонено.' : 'Обращение подтверждено.'); refresh();
    } catch (reason) { setNotice(message(reason)); refresh(); }
    finally { setBusy(false); }
  };
  const cancelDecision = () => {
    setDecision(null);
    window.requestAnimationFrame(() => decisionTriggerRef.current?.focus());
  };

  if (!context) return <section className="mx-auto max-w-5xl space-y-4"><header className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-5 sm:p-7"><p className="text-sm font-semibold text-[var(--color-brand)]">РАБОТА С УЧЕБНЫМИ ГРУППАМИ</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Кураторство</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">Сведения доступны только в рамках активных назначений и полномочий вашего аккаунта.</p></header>{contextError ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>{contextError}</p><button className={`${button} mt-3`} onClick={refresh}>Повторить</button></div> : <p role="status" className="rounded-xl border bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-secondary)]">Проверяем ваши назначения…</p>}</section>;
  const emptyGroupsDescription = query
    ? 'Группы не найдены. Измените поисковый запрос.'
    : !context.canManage
      ? 'Вам ещё не назначили группы для кураторства. Попросите деканат или администратора вашего университета назначить вас на нужную группу.'
      : mode === 'mine'
        ? 'Здесь показаны только группы, на которые вы назначены куратором. Чтобы назначить кураторов и просмотреть группы университета, откройте режим «Назначения».'
        : 'В учебной структуре университета пока нет групп. Назначать кураторов можно после того, как группы появятся в структуре.';
  return <div className="curation-workspace mx-auto max-w-[var(--layout-content-max)] space-y-5">
    <header className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-sky-50 to-cyan-100 p-5 sm:p-7">
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--color-brand)]">Сопровождение учебных групп</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">Кураторство</h1><p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">Группы, студенты, обращения и ближайшие занятия в пределах ваших назначений.</p></div>
        <button className={`${button} shrink-0`} disabled={busy} onClick={refresh}>Обновить данные</button>
      </div>
    </header>
    <section aria-label="Сводка кураторства" className="grid gap-3 sm:grid-cols-2">
      <div className="flex min-h-24 items-center gap-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-4 shadow-sm"><span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-xl text-blue-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><circle cx="9" cy="8" r="3.5"/><path d="M2.8 20v-1.4a6.2 6.2 0 0 1 12.4 0V20M16 5.2a3.5 3.5 0 0 1 0 6.6m2.3 2.1a5.8 5.8 0 0 1 3 5.1V20"/></svg></span><div><p className="text-2xl font-bold tabular-nums text-[var(--color-text)]">{context.groupCount}</p><p className="text-sm text-[var(--color-text-secondary)]">Мои активные назначения</p></div></div>
      <div className="flex min-h-24 items-center gap-4 rounded-2xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50 p-4 shadow-sm"><span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cyan-100 text-xl text-cyan-700">✓</span><div><p className="text-base font-semibold text-[var(--color-text)]">{context.canManage ? 'Управление назначениями' : context.canCurate ? 'Доступ по назначению' : 'Назначение не найдено'}</p><p className="text-sm text-[var(--color-text-secondary)]">{context.canManage ? 'Доступно управление в пределах университета' : context.canCurate ? 'Данные групп доступны вашему аккаунту' : 'Попросите администратора проверить доступ'}</p></div></div>
    </section>
    {contextError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{contextError}</p>}
    {linkError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{linkError}</p>}
    {context.canManage && <div className="space-y-2"><div className="curation-modes" role="group" aria-label="Режим кураторства"><button className={mode === 'mine' ? primary : button} aria-pressed={mode === 'mine'} aria-describedby="curation-mode-description" onClick={() => changeMode('mine')}>Мои группы</button><button className={mode === 'manage' ? primary : button} aria-pressed={mode === 'manage'} aria-describedby="curation-mode-description" onClick={() => changeMode('manage')}>Назначения</button></div><p id="curation-mode-description" className="text-sm text-[var(--color-text-secondary)]">{mode === 'mine' ? 'Ваши личные назначения куратором: только группы, на которые вы назначены.' : 'Группы университета: список кураторов по группе и управление их назначениями.'}</p></div>}
    {!context.canCurate && !context.canManage ? <p className="rounded-xl border bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">Кураторство пока не назначено вашему аккаунту. Декан факультета или администратор университета может назначить вас на группы; ваша основная роль и вход в кабинет при этом не меняются.</p> : <>
      <div className="curation-layout grid items-start gap-4 md:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] xl:gap-5">
        <section className="min-w-0 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm" aria-label="Выбор группы" aria-busy={groupsBusy}>{(query || groupsBusy || (groups && groups.meta.total > 10)) && <label className="block text-sm font-medium">Найти группу<input type="search" placeholder="Название группы" className={`${input} mt-2`} value={query} maxLength={100} onChange={event => { setGroupsBusy(true); setGroupsError(''); setQuery(event.target.value); setGroupPage(1); }} /></label>}
          {groupsError && <div role="alert" className="space-y-2 text-sm text-red-700"><p>{groupsError}</p><button className={button} disabled={groupsBusy} onClick={refresh}>Повторить загрузку групп</button></div>}
          {groupsBusy && <p role="status" className="text-sm text-[var(--color-text-secondary)]">Загружаем группы…</p>}
          {!groupsBusy && groups?.data.length === 0 && <p className="py-3 text-sm text-[var(--color-text-secondary)]">{emptyGroupsDescription}</p>}
          {Boolean(groups?.data.length) && <label className="block md:hidden"><span className="sr-only">Группа</span><select className={input} aria-label="Группа" value={selected?.id || ''} disabled={busy || groupsBusy} onChange={event => { const group = groups?.data.find(item => item.id === event.target.value); if (group) choose(group); }}><option value="" disabled>Выберите группу</option>{groups?.data.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
          <div className="curation-groups hidden gap-2 pb-1 md:flex md:flex-col">{groups?.data.map(group => <button key={group.id} aria-pressed={selected?.id === group.id} className={`${selected?.id === group.id ? primary : button} text-left`} onClick={() => choose(group)} disabled={busy || groupsBusy}>{group.name}</button>)}</div>
          {groups && <Pager page={groupPage} totalPages={groups.meta.totalPages} busy={groupsBusy} onChange={setGroupPage} />}
        </section>
        <section className="min-w-0 space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5" aria-label={selected ? `Группа ${selected.name}` : 'Содержимое группы'}>
          {!selected ? <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 text-center"><div><span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-blue-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></span><p className="mt-3 text-sm font-semibold text-[var(--color-text)]">Выберите группу</p><p className="mt-1 max-w-sm text-sm leading-6 text-[var(--color-text-secondary)]">Откройте обращения, студентов и расписание в пределах доступного вам назначения.</p></div></div> : <>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Выбранная группа</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2></div>{mode === 'mine' && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">Кураторское назначение</span>}</div>
            {focusedAbsence && mode === 'mine' && <button className={button} onClick={() => { setFocusedAbsence(''); setDetailPage(1); }}>Все обращения группы</button>}
            {notice && <p role="status" className="break-words rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
            {mode === 'mine' && <div className="curation-tabs" role="group" aria-label="Раздел выбранной группы">{([{ id: 'absences', label: 'Обращения' }, { id: 'students', label: 'Студенты' }, { id: 'lessons', label: 'Расписание' }] as const).map(item => {
              const count = showCounts && detail && tab === item.id ? detail.meta.total : null;
              return <button key={item.id} className={tab === item.id ? primary : button} aria-pressed={tab === item.id} disabled={busy} onClick={() => { setTab(item.id); setDetailPage(1); setDetail(null); setDecision(null); }}>{item.label}{count !== null && <span className="curation-tab-count" aria-label={`${count} записей`}>{count}</span>}</button>;
            })}</div>}
            {detailBusy && <p role="status" className="text-sm text-[var(--color-text-secondary)]">Загружаем…</p>}
            {detailError && <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{detailError}</p><button className={button} onClick={refresh}>Проверить доступ снова</button></div>}
            {mode === 'manage' ? <>
              <section className="rounded-xl border bg-[var(--color-surface)] p-4"><h3 className="font-semibold">Кураторы группы</h3>{curators && !curators.data.length && <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Пока никто не назначен.</p>}<ul className="divide-y">{curators?.data.map(person => <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{person.lastName} {person.firstName}</p><p className="break-all text-xs text-[var(--color-text-secondary)]">{roles[person.role || ''] || person.role} · {person.email}</p></div><button className={button} disabled={busy} onClick={() => setRemove(person)}>Снять</button></li>)}</ul>{curators && <Pager page={curatorPage} totalPages={curators.meta.totalPages} busy={detailBusy} onChange={setCuratorPage} />}
                {remove && <div className="mt-3 space-y-3 rounded-lg bg-amber-50 p-3"><p className="text-sm">Снять кураторство: {remove.lastName} {remove.firstName}?</p><div className="flex flex-wrap gap-2"><button className={primary} disabled={busy} onClick={() => void assign(remove, false)}>Снять кураторство</button><button className={button} disabled={busy} onClick={() => setRemove(null)}>Отмена</button></div></div>}
              </section>
              <section className="rounded-xl border bg-[var(--color-surface)] p-4"><h3 className="mb-3 font-semibold">Добавить куратора</h3><label className="block text-sm">Имя или email<input className={`${input} mt-2`} value={candidateQuery} maxLength={100} onChange={event => { setCandidateQuery(event.target.value); setCandidatePage(1); }} /></label>{candidateQuery.trim().length < 2 && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Введите хотя бы 2 символа.</p>}{candidateBusy && <p role="status" className="mt-3 text-sm text-[var(--color-text-secondary)]">Ищем аккаунты…</p>}{candidateError && <p role="alert" className="mt-3 text-sm text-red-700">{candidateError}</p>}{candidates?.data.length === 0 && <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Аккаунты не найдены.</p>}<ul className="divide-y">{candidates?.data.map(person => <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{person.lastName} {person.firstName}</p><p className="break-all text-xs text-[var(--color-text-secondary)]">{roles[person.role || ''] || person.role} · {person.email}</p></div><button className={button} disabled={busy || !!curators?.data.some(item => item.userId === person.id)} onClick={() => void assign(person, true)}>{curators?.data.some(item => item.userId === person.id) ? 'Назначен' : 'Назначить'}</button></li>)}</ul>{candidates && <Pager page={candidatePage} totalPages={candidates.meta.totalPages} busy={candidateBusy} onChange={setCandidatePage} />}</section>
            </> : detail && <>
              {!detail.data.length && <p className="rounded-xl border bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">{tab === 'absences' ? 'Нет обращений на рассмотрении.' : tab === 'lessons' ? 'На ближайшие 7 дней занятий нет.' : 'Студентов пока нет.'}</p>}
              <div className="divide-y rounded-xl border bg-[var(--color-surface)]">{detail.data.map(item => tab === 'students' ? <div key={item.id} className="break-words p-4 text-sm font-medium">{(item as Person).lastName} {(item as Person).firstName}</div> : tab === 'lessons' ? <div key={item.id} className="space-y-1 p-4"><p className="text-xs text-[var(--color-text-secondary)]">{date((item as Lesson).startDate)} · {time((item as Lesson).startTime)}–{time((item as Lesson).endTime)}</p><p className="break-words text-sm font-semibold">{(item as Lesson).subject}</p><LessonTypeBadge subjectType={(item as Lesson).subjectType} /><p className="text-xs text-[var(--color-text-secondary)]">{(item as Lesson).teacherName}{(item as Lesson).room ? ` · ауд. ${(item as Lesson).room}` : ''}</p></div> : (() => { const absence = item as Absence; return <article key={absence.id} className="space-y-3 p-4"><div><h3 className="text-sm font-semibold">{absence.student ? `${absence.student.lastName} ${absence.student.firstName}` : 'Студент'}</h3><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{date(absence.startDate)} — {date(absence.endDate)}</p></div>{absence.comment && <p className="whitespace-pre-wrap break-words text-sm">{absence.comment}</p>}{absence.canReview ? <div className="flex flex-wrap gap-2"><button className={primary} disabled={busy} onClick={event => { decisionTriggerRef.current = event.currentTarget; setDecision({ absence, status: 'confirm' }); setComment(''); }}>Подтвердить</button><button className={button} disabled={busy} onClick={event => { decisionTriggerRef.current = event.currentTarget; setDecision({ absence, status: 'reject' }); setComment(''); }}>Отклонить</button></div> : <p className="text-xs text-[var(--color-text-secondary)]">Ваше обращение рассматривает другой куратор или деканат.</p>}{decision?.absence.id === absence.id && <form className="space-y-3 rounded-lg bg-slate-50 p-3" onSubmit={event => { event.preventDefault(); void review(); }}><label className="block text-sm font-medium">{decision.status === 'reject' ? 'Причина отклонения' : 'Комментарий к решению'}<textarea ref={decisionRef} className={`${input} mt-2 min-h-24`} required={decision.status === 'reject'} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} /></label><div className="flex flex-wrap gap-2"><button className={primary} disabled={busy || (decision.status === 'reject' && !comment.trim())} type="submit">{busy ? 'Сохраняем…' : 'Сохранить решение'}</button><button className={button} disabled={busy} onClick={cancelDecision} type="button">Отмена</button></div></form>}</article>; })())}</div>
              <Pager page={detailPage} totalPages={detail.meta.totalPages} busy={detailBusy || busy} onChange={setDetailPage} />
            </>}
          </>}
        </section>
      </div>
    </>}
  </div>;
}
