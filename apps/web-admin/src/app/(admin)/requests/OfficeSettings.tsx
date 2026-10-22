'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch, type PaginatedResponse } from '@/lib/api';
import { Button, Card, RequestState } from '@/components/ui';
import { controlClass, dutyLabels, nameOf, typeLabels, type Assignment, type OfficeContext, type Person, type Route } from './types';

export function OfficeSettings({ context, onChange }: { context: OfficeContext; onChange: () => Promise<void> }) {
  const [people, setPeople] = useState<Person[]>([]), [assignments, setAssignments] = useState<Assignment[]>([]), [routes, setRoutes] = useState<Route[]>([]);
  const [q, setQ] = useState(''), [personId, setPersonId] = useState(''), [duty, setDuty] = useState('office'), [groupIds, setGroupIds] = useState<string[]>([]), [facultyIds, setFacultyIds] = useState<string[]>([]), [onBehalf, setOnBehalf] = useState(false);
  const [routeGroup, setRouteGroup] = useState(''), [routeType, setRouteType] = useState<keyof typeof typeLabels>('absence'), [assignees, setAssignees] = useState(['', '', '']), [dueDays, setDueDays] = useState(5);
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try { const [grants, configured] = await Promise.all([apiFetch<Assignment[]>('/requests/assignments'), apiFetch<Route[]>('/requests/routes')]); if (current === generation.current) { setAssignments(grants); setRoutes(configured); } }
    catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Настройки недоступны.'); } finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { void apiFetch<PaginatedResponse<Person>>(`/requests/candidates?limit=100&q=${encodeURIComponent(q)}`, { signal: controller.signal }).then(staff => { if (!controller.signal.aborted) setPeople(current => [...new Map([...current, ...staff.data].map(person => [person.id, person])).values()]); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Список сотрудников недоступен.'); }); }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);
  useEffect(() => {
    const existing = routes.find(route => route.groupId === routeGroup && route.type === routeType);
    setAssignees(existing ? [...existing.assigneeIds, '', ''].slice(0, 3) : ['', '', '']); setDueDays(existing?.dueDays ?? 5);
  }, [routeGroup, routeType, routes]);
  async function mutate(path: string, method: string, body?: object) {
    setBusy(true); setError(''); setSuccess('');
    try { await apiFetch(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); setSuccess('Настройки сохранены. Действующие назначения обновлены.'); await load(); await onChange(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить настройки.'); } finally { setBusy(false); }
  }
  function grant(event: FormEvent) { event.preventDefault(); void mutate('/requests/assignments', 'POST', { userId: personId, duty, facultyIds, groupIds, canCreateForStudents: duty === 'office' && onBehalf }); }
  function route(event: FormEvent) { event.preventDefault(); const existing = routes.find(item => item.groupId === routeGroup && item.type === routeType); void mutate('/requests/routes', 'PUT', { groupId: routeGroup, type: routeType, assigneeIds: assignees.slice(0, routeType === 'absence' ? 2 : 3), dueDays, version: existing?.version ?? 0 }); }
  return <div className="space-y-5">
    {error && <RequestState title="Не удалось обновить настройки" description={error} onRetry={() => void load()} />}{success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>}
    <Card><h2 className="text-xl font-bold text-slate-950">Назначения сотрудников</h2><p className="mt-2 text-sm text-slate-600">Дополнительные обязанности сохраняют основную роль аккаунта. Выберите факультеты или группы; пустой список не даёт доступа.</p>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-800">Найти сотрудника<input className={controlClass} value={q} onChange={event => setQ(event.target.value)} placeholder="Фамилия или имя" /></label><p className="mt-1 text-xs text-slate-600">В списке до 100 совпадений. Уточните поиск, если нужного сотрудника нет.</p>
      <form onSubmit={grant} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Сотрудник<select required className={controlClass} value={personId} onChange={event => setPersonId(event.target.value)}><option value="">Выберите аккаунт</option>{people.filter(person => person.id === personId || nameOf(person).toLocaleLowerCase('ru-RU').includes(q.toLocaleLowerCase('ru-RU'))).map(person => <option key={person.id} value={person.id}>{nameOf(person)}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Обязанность<select className={controlClass} value={duty} onChange={event => setDuty(event.target.value)}>{['office','methodologist','dispatcher'].map(value => <option key={value} value={value}>{dutyLabels[value]}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Факультеты<select multiple className={`${controlClass} min-h-32`} value={facultyIds} onChange={event => setFacultyIds([...event.target.selectedOptions].map(option => option.value))}>{context.faculties.map(faculty => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Группы<select multiple className={`${controlClass} min-h-32`} value={groupIds} onChange={event => setGroupIds([...event.target.selectedOptions].map(option => option.value))}>{context.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <p className="text-xs text-slate-600 sm:col-span-2">Для нескольких значений используйте Ctrl/Cmd или Shift. Назначение действует в выбранных факультетах и отдельно выбранных группах.</p>
        {duty === 'office' && <label className="flex min-h-11 items-center gap-3 text-sm text-slate-800 sm:col-span-2"><input type="checkbox" className="h-5 w-5" checked={onBehalf} onChange={event => setOnBehalf(event.target.checked)} />Разрешить подачу от имени студента</label>}
        <div className="sm:col-span-2"><Button type="submit" loading={busy} disabled={!personId || loading}>Назначить обязанность</Button></div>
      </form>
      <ul className="mt-6 divide-y divide-slate-200">{assignments.filter(row => !row.revokedAt).map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-slate-900">{row.userName || 'Сотрудник'} · {dutyLabels[row.duty]}</p><p className="mt-1 text-sm text-slate-600">{[...row.facultyIds.map(id => context.faculties.find(faculty => faculty.id === id)?.name), ...row.groupIds.map(id => context.groups.find(group => group.id === id)?.name)].filter(Boolean).join(', ') || 'Подразделения не выбраны — доступа нет'}</p>{row.canCreateForStudents && <p className="mt-1 text-xs text-slate-600">Разрешена подача от имени студента</p>}</div><Button variant="secondary" disabled={busy} onClick={() => void mutate(`/requests/assignments/${row.id}`, 'DELETE')}>Отозвать</Button></li>)}</ul>{!loading && !assignments.some(row => !row.revokedAt) && <p className="mt-5 text-sm text-slate-600">Действующих назначений пока нет.</p>}
    </Card>
    <Card><h2 className="text-xl font-bold text-slate-950">Маршрут согласования</h2><p className="mt-2 text-sm text-slate-600">При отсутствии отдельного маршрута выбираются первые действующие назначения и декан факультета. Новая версия применяется к будущим заявлениям. Смена исполнителя в поданном заявлении оформляется в его карточке.</p>
      <form onSubmit={route} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Группа<select required className={controlClass} value={routeGroup} onChange={event => setRouteGroup(event.target.value)}><option value="">Выберите группу</option>{context.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Тип заявления<select className={controlClass} value={routeType} onChange={event => setRouteType(event.target.value as keyof typeof typeLabels)}>{Object.entries(typeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {(routeType === 'absence' ? ['office','curator_or_dean'] : ['office','methodologist','dean']).map((stage,index) => <label key={stage} className="grid gap-2 text-sm font-semibold text-slate-800">{index + 1}. {dutyLabels[stage]}<select required className={controlClass} value={assignees[index]} onChange={event => setAssignees(current => current.map((value,i) => i === index ? event.target.value : value))}><option value="">Выберите согласующего</option>{(stage === 'curator_or_dean' ? [...new Map([...people,...context.assignees].map(person => [person.id,person])).values()] : people).map(person => <option key={person.id} value={person.id}>{nameOf(person)}</option>)}</select></label>)}
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Календарных дней на этап<input type="number" min={1} max={90} required className={controlClass} value={dueDays} onChange={event => setDueDays(Number(event.target.value))} /></label><div className="sm:col-span-2"><Button type="submit" loading={busy} disabled={!routeGroup || loading}>Сохранить маршрут</Button></div>
      </form>
    </Card>
  </div>;
}
