'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, type PaginatedResponse } from '@/lib/api';
import { Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';
import { OfficeSettings } from './OfficeSettings';
import { RequestCard } from './RequestCard';
import { CreateRequest } from './CreateRequest';
import { DispatcherWorkspace } from './DispatcherWorkspace';
import { controlClass, dateLabel, nameOf, statusLabels, typeLabels, type OfficeContext, type RequestDetail, type RequestRow } from './types';

const blankFilters = { type: '', status: '', groupId: '', facultyId: '', assignedTo: '', overdue: '', q: '' };
export default function RequestsPage() {
  const [context, setContext] = useState<OfficeContext | null>(null), [rows, setRows] = useState<RequestRow[]>([]), [detail, setDetail] = useState<RequestDetail | null>(null);
  const [tab, setTab] = useState<'queue' | 'settings' | 'dispatch'>('queue'), [creating, setCreating] = useState(false), [filters, setFilters] = useState(blankFilters), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [detailLoading, setDetailLoading] = useState(false);
  const generation = useRef(0), detailGeneration = useRef(0);
  const loadContext = useCallback(async () => { setContext(await apiFetch<OfficeContext>('/requests/context')); }, []);
  const loadList = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError('');
    const query = new URLSearchParams({ page: String(page), limit: '20' }); for (const [key,value] of Object.entries(filters)) if (value) query.set(key,value);
    try { const result = await apiFetch<PaginatedResponse<RequestRow>>(`/requests?${query}`); if (current === generation.current) { setRows(result.data); setTotal(result.meta.total); } }
    catch (cause) { if (current === generation.current) { setRows([]); setTotal(0); setError(cause instanceof Error ? cause.message : 'Очередь недоступна.'); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [page, filters]);
  useEffect(() => { let active = true; loadContext().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Нет доступа к учебному офису.'); }); return () => { active = false; }; }, [loadContext]);
  useEffect(() => { void loadList(); return () => { generation.current++; }; }, [loadList]);
  async function open(id: string) {
    const current = ++detailGeneration.current; setDetailLoading(true); setError(''); setCreating(false);
    try { const result = await apiFetch<RequestDetail>(`/requests/${id}`); if (current === detailGeneration.current) setDetail(result); }
    catch (cause) { if (current === detailGeneration.current) { setDetail(null); setError(cause instanceof Error ? cause.message : 'Карточка недоступна.'); } }
    finally { if (current === detailGeneration.current) setDetailLoading(false); }
  }
  const canDispatch = !!context?.assignments.some(row => row.duty === 'dispatcher' && !row.revokedAt);
  async function refreshDetail() { if (detail) await open(detail.id); await loadList(); }
  function filter(key: keyof typeof blankFilters, value: string) { setPage(1); setFilters(current => ({ ...current, [key]: value })); }
  function report() {
    const cell = (value: string) => '"' + (/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
    const csv = [['Тип','Название','Состояние','Группа','Ответственный','Срок','Просрочено'], ...rows.map(row => [typeLabels[row.type], row.title, statusLabels[row.status], context?.groups.find(group => group.id === row.groupId)?.name || row.groupId, row.assignedTo ? (context?.assignees.find(person => person.id === row.assignedTo) ? nameOf(context.assignees.find(person => person.id === row.assignedTo)!) : 'Аккаунт недоступен') : 'Не назначен', dateLabel(row.dueAt), row.overdue ? 'Да' : 'Нет'])].map(row => row.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = 'Заявления-текущая-страница.csv'; link.click(); URL.revokeObjectURL(url);
  }
  const set = (label: string, key: keyof typeof blankFilters, options: { value: string; label: string }[]) => <label className="grid gap-2 text-sm font-semibold text-slate-800">{label}<select className={controlClass} value={filters[key]} onChange={event => filter(key,event.target.value)}><option value="">Все</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  return <div className="mx-auto max-w-[1400px] space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-700">Учебный офис</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Заявления и согласования</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Отсутствия, переводы и пересдачи: текущий этап, ответственный и история решения.</p></div>{context?.canCreateForStudents && <Button onClick={() => { setDetail(null); setCreating(true); setTab('queue'); }}>Новое заявление</Button>}</div>
    {context && (context.canManage || canDispatch) && <div className="flex flex-wrap gap-2" aria-label="Разделы учебного офиса"><Button variant={tab === 'queue' ? 'primary' : 'secondary'} aria-pressed={tab === 'queue'} onClick={() => setTab('queue')}>Очередь заявлений</Button>{context.canManage && <Button variant={tab === 'settings' ? 'primary' : 'secondary'} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Назначения и маршруты</Button>}{canDispatch && <Button variant={tab === 'dispatch' ? 'primary' : 'secondary'} aria-pressed={tab === 'dispatch'} onClick={() => setTab('dispatch')}>Рабочее место диспетчера</Button>}</div>}
    {error && <RequestState title="Не удалось загрузить данные" description={error} onRetry={() => { void loadContext().catch(() => undefined); void loadList(); }} />}
    {tab === 'dispatch' && context && canDispatch ? <DispatcherWorkspace context={context} /> : tab === 'settings' && context?.canManage ? <OfficeSettings context={context} onChange={loadContext} /> : <>
      {creating && context && <CreateRequest context={context} onCreated={id => void open(id)} onCancel={() => setCreating(false)} />}
      {detailLoading && !detail ? <Skeleton className="h-64 rounded-2xl" /> : detail ? <RequestCard key={detail.id} request={detail} onChange={refreshDetail} onBack={() => { detailGeneration.current++; setDetail(null); void loadList(); }} /> : !creating && <>
        <Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{set('Тип', 'type', Object.entries(typeLabels).map(([value,label]) => ({ value,label })))}{set('Состояние', 'status', Object.entries(statusLabels).map(([value,label]) => ({ value,label })))}{set('Факультет', 'facultyId', (context?.faculties || []).map(faculty => ({ value:faculty.id,label:faculty.name })))}{set('Ответственный', 'assignedTo', (context?.assignees || []).map(person => ({ value:person.id,label:nameOf(person) })))}{set('Группа', 'groupId', (context?.groups || []).filter(group => !filters.facultyId || group.facultyId === filters.facultyId).map(group => ({ value:group.id,label:group.name })))}<label className="grid gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">Поиск по названию<input className={controlClass} value={filters.q} onChange={event => filter('q',event.target.value)} /></label><label className="flex min-h-11 items-center gap-3 text-sm text-slate-800"><input type="checkbox" className="h-5 w-5" checked={!!filters.overdue} onChange={event => filter('overdue',event.target.checked ? '1' : '')} />Только просроченные</label><Button variant="secondary" onClick={() => { setFilters(blankFilters); setPage(1); }}>Сбросить фильтры</Button></div></Card>
        <Card><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-slate-600">Найдено: {total}. Страница {page}</p><Button variant="secondary" disabled={!rows.length || loading} onClick={report}>Скачать страницу CSV</Button></div>{loading ? <div className="mt-5 space-y-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div> : error ? <p className="mt-5 text-sm text-slate-600">Очередь обновится после повторной загрузки.</p> : rows.length ? <ul className="mt-4 divide-y divide-slate-200">{rows.map(row => <li key={row.id}><button type="button" onClick={() => void open(row.id)} className="flex min-h-24 w-full flex-col justify-between gap-3 rounded-xl px-2 py-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:flex-row sm:items-center"><span className="min-w-0"><span className="text-xs font-semibold text-indigo-800">{typeLabels[row.type]} · {context?.groups.find(group => group.id === row.groupId)?.name || 'Учебная группа'}</span><span className="mt-1 block break-words font-semibold text-slate-950">{row.title}</span><span className="mt-1 block text-sm text-slate-600">Срок: {dateLabel(row.dueAt)}</span></span><span className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${row.overdue ? 'bg-red-50 text-red-900' : 'bg-slate-100 text-slate-800'}`}>{row.overdue ? 'Просрочено · ' : ''}{statusLabels[row.status]}</span></button></li>)}</ul> : <EmptyState title="Заявлений по этим условиям нет" description="Проверьте фильтры или действующие назначения. Новые обращения появятся после подачи." />}<div className="mt-5 flex justify-between gap-3"><Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Назад</Button><Button variant="secondary" disabled={page * 20 >= total || loading} onClick={() => setPage(value => value + 1)}>Далее</Button></div></Card>
      </>}
      {context && <Card><h2 className="font-bold text-slate-950">Академические задолженности</h2><p className="mt-2 text-sm text-slate-600">{context.debtSource.message}</p></Card>}
    </>}
  </div>;
}
