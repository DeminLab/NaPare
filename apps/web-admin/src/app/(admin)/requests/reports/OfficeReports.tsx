'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, type PaginatedResponse } from '@/lib/api';
import { Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';
import { controlClass, type OfficeContext } from '../types';
import DebtImportForm from './DebtImportForm';

type Source = { available: boolean; source?: string | null; reference?: string; asOfDate?: string };
type GroupCount = { groupId: string; groupName: string; activeStudents: number; debtSource: Source };
type Contingent = PaginatedResponse<GroupCount> & { totalActiveStudents: number; unresolvedStudentGroups: number | null };
type Debt = { id: string; groupId: string; studentId: string; subject: string; period: string; basis: string; snapshotId: string };
type Debts = PaginatedResponse<Debt> & { sourceCoverage: (Source & { groupId: string })[]; limitations: string[] };
function download(rows: string[][], filename: string) {
  const cell = (value: string) => '"' + (/^\s*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
export default function OfficeReports() {
  const [context, setContext] = useState<OfficeContext | null>(null), [contingent, setContingent] = useState<Contingent | null>(null), [debts, setDebts] = useState<Debts | null>(null);
  const [groupId, setGroupId] = useState(''), [groupPage, setGroupPage] = useState(1), [debtPage, setDebtPage] = useState(1);
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [sessionChanged, setSessionChanged] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setContingent(null); setDebts(null);
    const query = groupId ? `&groupId=${encodeURIComponent(groupId)}` : '';
    try {
      const [office, counts, records] = await Promise.all([
        apiFetch<OfficeContext>('/requests/context', { signal: controller.signal, cache: 'no-store' }),
        apiFetch<Contingent>(`/requests/reports/contingent?page=${groupPage}&limit=20${query}`, { signal: controller.signal, cache: 'no-store' }),
        apiFetch<Debts>(`/requests/reports/debts?page=${debtPage}&limit=20${query}`, { signal: controller.signal, cache: 'no-store' }),
      ]);
      if (!controller.signal.aborted) { setContext(office); setContingent(counts); setDebts(records); }
    } catch (cause) { if (!controller.signal.aborted) { setContext(null); setError(cause instanceof Error ? cause.message : 'Не удалось загрузить отчёты.'); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [groupId, groupPage, debtPage]);
  useEffect(() => { if (!sessionChanged) void load(); return () => pending.current?.abort(); }, [load, sessionChanged]);
  useEffect(() => {
    const clear = (event: StorageEvent) => {
      if (event.key === null || ['accessToken', 'refreshToken'].includes(event.key)) {
        pending.current?.abort(); setSessionChanged(true); setBusy(false); setContext(null); setContingent(null); setDebts(null);
        setError('Сессия изменилась. Обновите страницу для получения данных текущего аккаунта.');
      }
    };
    window.addEventListener('storage', clear); return () => window.removeEventListener('storage', clear);
  }, []);
  const names = new Map(context?.groups.map(group => [group.id, group.name]) || []);
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <Link href="/requests" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-800 underline">← Заявления и согласования</Link>
    <section className="space-y-2"><p className="text-sm font-semibold text-indigo-800">Учебный офис · свой вуз</p><h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Контингент и задолженности</h1><p className="max-w-3xl text-sm text-slate-700">Текущие активные студенческие аккаунты платформы и записи подтверждённых реестров. История приказов о зачислении и отчислении сюда не входит.</p></section>
    {context && <Card><div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end"><label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold text-slate-900">Группа<select className={controlClass} value={groupId} onChange={event => { setGroupId(event.target.value); setGroupPage(1); setDebtPage(1); }}><option value="">Все доступные группы</option>{context.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><Button variant="secondary" disabled={busy || sessionChanged} onClick={() => void load()}>Обновить отчёты</Button></div></Card>}
    {error && <RequestState title="Отчёты недоступны" description={error} onRetry={sessionChanged ? () => window.location.reload() : () => void load()} />}
    {busy && <div role="status" aria-label="Загружаем отчёты"><Skeleton className="h-40 rounded-2xl" /></div>}
    {contingent && <Card><h2 className="text-xl font-bold text-slate-950">Контингент платформы</h2><p className="mt-2 text-sm text-slate-800">Активных студентов: <strong>{contingent.totalActiveStudents}</strong>. Групп: {contingent.meta.total}.</p>{contingent.unresolvedStudentGroups !== null && <p className="mt-2 text-sm text-slate-700">Аккаунтов без однозначной группы: {contingent.unresolvedStudentGroups}. Они не включены в суммы групп.</p>}
      {contingent.data.length ? <ul className="mt-4 divide-y divide-slate-200">{contingent.data.map(row => <li key={row.groupId} className="grid gap-2 py-4 sm:grid-cols-2"><div><h3 className="break-words font-semibold text-slate-950">{row.groupName}</h3><p className="mt-1 text-sm text-slate-700">Активных студентов: {row.activeStudents}</p></div><div className="break-words text-sm text-slate-700">{row.debtSource.available ? <><p className="font-semibold text-emerald-900">Реестр подтверждён</p><p>{row.debtSource.source} · {row.debtSource.reference}</p><p>Дата источника: {row.debtSource.asOfDate}</p></> : <p>Подтверждённого реестра задолженностей нет.</p>}</div></li>)}</ul> : <EmptyState title="Групп нет" description="Проверьте назначения и фильтр." />}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" disabled={groupPage <= 1 || busy} onClick={() => setGroupPage(page => page - 1)}>Предыдущие группы</Button><p role="status" className="text-sm text-slate-700">Страница {groupPage} из {Math.max(1, contingent.meta.totalPages)}</p><Button variant="secondary" disabled={groupPage >= contingent.meta.totalPages || busy} onClick={() => setGroupPage(page => page + 1)}>Следующие группы</Button></div>
      <Button className="mt-4" variant="secondary" disabled={!contingent.data.length} onClick={() => download([['Группа','Активные студенты','Источник задолженностей','Дата источника'], ...contingent.data.map(row => [row.groupName, String(row.activeStudents), row.debtSource.available ? row.debtSource.source || '' : 'Не подключён', row.debtSource.asOfDate || ''])], 'Контингент-страница.csv')}>Скачать страницу контингента CSV</Button>
    </Card>}
    {debts && <Card><h2 className="text-xl font-bold text-slate-950">Задолженности</h2><p className="mt-2 text-sm text-slate-700">Записей: {debts.meta.total}. Групп без подтверждённого источника: {debts.sourceCoverage.filter(source => !source.available).length} из {debts.sourceCoverage.length}. Студенты указаны под кодами аккаунтов.</p>
      {debts.data.length ? <ul className="mt-4 divide-y divide-slate-200">{debts.data.map(row => <li key={row.id} className="space-y-1 break-words py-4"><h3 className="font-semibold text-slate-950">{row.subject} · {row.period}</h3><p className="text-sm text-slate-700">{names.get(row.groupId) || row.groupId} · Код студента: <span className="break-all">{row.studentId}</span></p><p className="text-sm text-slate-700">Основание: {row.basis}</p></li>)}</ul> : <EmptyState title="Записей в текущей выборке нет" description={debts.sourceCoverage.some(source => !source.available) ? 'Часть групп не имеет подтверждённого источника. Пустой список не означает отсутствие задолженностей.' : 'В подтверждённых снимках нет записей текущих активных студентов. Более поздние изменения не проверены.'} />}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" disabled={debtPage <= 1 || busy} onClick={() => setDebtPage(page => page - 1)}>Предыдущие записи</Button><p role="status" className="text-sm text-slate-700">Страница {debtPage} из {Math.max(1, debts.meta.totalPages)}</p><Button variant="secondary" disabled={debtPage >= debts.meta.totalPages || busy} onClick={() => setDebtPage(page => page + 1)}>Следующие записи</Button></div>
      <Button className="mt-4" variant="secondary" disabled={!debts.data.length} onClick={() => download([['Код студента','Группа','Дисциплина','Период','Основание','Код снимка'], ...debts.data.map(row => [row.studentId, names.get(row.groupId) || row.groupId, row.subject, row.period, row.basis, row.snapshotId])], 'Задолженности-страница.csv')}>Скачать страницу задолженностей CSV</Button>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">{debts.limitations.map(text => <li key={text}>{text}</li>)}</ul>
    </Card>}
    {context?.canManage && !sessionChanged && <Card><DebtImportForm groups={context.groups} onSaved={() => void load()} /></Card>}
  </div>;
}
