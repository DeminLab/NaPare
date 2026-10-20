'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';
import { ListPagination } from '@/components/ListPagination';
import { apiFetch, type PaginatedResponse } from '@/lib/api';

interface Absence { id: string; type: string; startDate: string; endDate: string; comment?: string | null; confirmationRequired: boolean; student?: { id: string; firstName: string; lastName: string; groupId?: string | null } | null; }

const typeLabels: Record<string, string> = { sick: 'Болезнь', learning: 'Учебная причина', work: 'Работа', other_city: 'Другой город', other: 'Другая причина' };

export default function UniversityAbsencesPage() {
  const params = useSearchParams();
  const [items, setItems] = useState<Absence[]>([]); const [page, setPage] = useState(1); const [meta, setMeta] = useState<PaginatedResponse<Absence>['meta'] | null>(null); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(''); const [error, setError] = useState(''); const [deepLinkMessage, setDeepLinkMessage] = useState(''); const [savingId, setSavingId] = useState(''); const [reasons, setReasons] = useState<Record<string, string>>({}); const [success, setSuccess] = useState(''); const [invalidId, setInvalidId] = useState(''); const [selectedId, setSelectedId] = useState('');
  const pageSize = 50;
  const load = async (requestedPage = page, locateDeepLink = false) => {
    setLoading(true); setLoadError(''); setError(''); setDeepLinkMessage('');
    try {
      const absenceId = locateDeepLink ? params.get('absence') : null;
      let firstPage = absenceId ? 1 : Math.max(1, requestedPage);
      let first = await apiFetch<PaginatedResponse<Absence>>(`/absences/pending?page=${firstPage}&limit=${pageSize}`);
      if (first.meta.totalPages > 0 && firstPage > first.meta.totalPages) {
        firstPage = first.meta.totalPages;
        first = await apiFetch<PaginatedResponse<Absence>>(`/absences/pending?page=${firstPage}&limit=${pageSize}`);
      }
      let result = first;
      if (absenceId && !first.data.some((item) => item.id === absenceId)) {
        let found: PaginatedResponse<Absence> | undefined;
        for (let start = firstPage + 1; start <= first.meta.totalPages && !found; start += 4) {
          const pages = Array.from({ length: Math.min(4, first.meta.totalPages - start + 1) }, (_, index) => start + index);
          const candidates = await Promise.all(pages.map((pageNumber) => apiFetch<PaginatedResponse<Absence>>(`/absences/pending?page=${pageNumber}&limit=${pageSize}`)));
          found = candidates.find((candidate) => candidate.data.some((item) => item.id === absenceId));
        }
        if (found) result = found;
        else setDeepLinkMessage('Обращение по ссылке не найдено в текущей очереди. Возможно, его уже рассмотрели.');
      }
      setItems(result.data); setMeta(result.meta); setPage(result.meta.page);
    } catch (err) {
      setMeta(null); setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить обращения.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(1, true); }, []);
  useEffect(() => {
    if (!items.length) { setSelectedId(''); return; }
    if (!items.some(item => item.id === selectedId)) {
      const linkedId = params.get('absence');
      setSelectedId(items.some(item => item.id === linkedId) ? linkedId! : items[0].id);
    }
  }, [items, selectedId, params]);
  const decide = async (id: string, action: () => Promise<unknown>) => { setSavingId(id); setError(''); setSuccess(''); try { await action(); setSuccess('Решение сохранено. Можно перейти к следующему обращению.'); if (items.length === 1 && page > 1) await load(page - 1); else await load(page); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить решение.'); } finally { setSavingId(''); } };
  const confirm = (id: string) => decide(id, () => apiFetch(`/absences/${id}/confirm`, { method: 'POST' }));
  const reject = (id: string) => { const reason = reasons[id]?.trim(); if (!reason) { setInvalidId(id); return; } setInvalidId(''); return decide(id, () => apiFetch(`/absences/${id}/excuse`, { method: 'POST', body: JSON.stringify({ reason }) })); };
  const selected = items.find(item => item.id === selectedId);
  const formatDate = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">Кабинет ВУЗа</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Обращения об отсутствии</h1><p className="mt-2 text-sm text-slate-500 sm:text-base">Заявления студентов, ожидающие решения деканата.</p></div><Button variant="secondary" loading={loading} onClick={() => load(page, Boolean(params.get('absence')))}>Обновить очередь</Button></header>
    {deepLinkMessage && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{deepLinkMessage}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    {error && <RequestState title="Не удалось выполнить действие" description={error} />}
    {loadError && <RequestState title="Не удалось загрузить очередь" description={loadError} onRetry={() => load(page, Boolean(params.get('absence')))} />}
    {loading ? <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.38fr)_minmax(0,1fr)]" aria-busy="true"><Skeleton className="h-[30rem]" /><Skeleton className="h-[30rem]" /></div> : loadError ? null : !items.length ? <EmptyState title="Все обращения рассмотрены" description="Новые заявления студентов появятся в этой очереди." /> : <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.38fr)_minmax(0,1fr)]">
      <Card className="!p-0 overflow-hidden" padding="sm"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-950">Очередь обращений</h2><p className="mt-1 text-sm text-slate-500">Выберите заявление для просмотра</p></div>{meta && <Badge variant="warning">{meta.total}</Badge>}</div><div className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">{items.map(item => { const active = selectedId === item.id; return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-pressed={active} className={`w-full border-l-4 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] ${active ? 'border-[var(--color-brand)] bg-indigo-50/70' : 'border-transparent hover:bg-slate-50'}`}><span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate font-semibold text-slate-950">{item.student ? `${item.student.lastName} ${item.student.firstName}` : 'Студент · имя недоступно'}</span><span className="mt-1 block text-sm text-slate-500">{typeLabels[item.type] || 'Другая причина'}</span><span className="mt-1 block text-xs text-slate-400">{formatDate(item.startDate)} — {formatDate(item.endDate)}</span></span><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" aria-label="Ожидает решения" /></span></button>; })}</div></Card>
      {selected && <Card className="!p-0 min-w-0" padding="sm"><div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:px-7"><div className="flex min-w-0 items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 font-bold text-indigo-600" aria-hidden="true">{selected.student?.firstName?.[0] || 'С'}{selected.student?.lastName?.[0] || ''}</div><div className="min-w-0"><h2 className="break-words text-xl font-bold text-slate-950">{selected.student ? `${selected.student.lastName} ${selected.student.firstName}` : 'Студент · имя недоступно'}</h2><p className="mt-1 text-sm text-slate-500">Студент · заявление об отсутствии</p><div className="mt-3"><Badge variant="warning" dot>Ожидает решения</Badge></div></div></div><p className="shrink-0 text-sm text-slate-500">{selected.confirmationRequired ? 'Требует подтверждения' : 'Информация об отсутствии'}</p></div>
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2"><section aria-labelledby="absence-info-title"><h3 id="absence-info-title" className="text-base font-bold text-slate-950">Информация о заявлении</h3><dl className="mt-4 space-y-3"><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Причина</dt><dd className="mt-1 font-medium text-slate-900">{typeLabels[selected.type] || 'Другая причина'}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Период отсутствия</dt><dd className="mt-1 font-medium text-slate-900">{formatDate(selected.startDate)} — {formatDate(selected.endDate)}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Комментарий студента</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{selected.comment || 'Дополнительный комментарий не оставлен.'}</dd></div></dl></section>
          <section aria-labelledby="absence-decision-title" className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 id="absence-decision-title" className="text-base font-bold text-slate-950">Рассмотреть обращение</h3><label className="mt-4 block text-sm font-medium text-slate-700">Комментарий при отказе <span className="font-normal text-slate-400">(обязателен)</span><textarea value={reasons[selected.id] || ''} onChange={event => { setInvalidId(''); setReasons(current => ({ ...current, [selected.id]: event.target.value })); }} maxLength={2000} aria-invalid={invalidId === selected.id} aria-describedby={invalidId === selected.id ? `reason-error-${selected.id}` : undefined} placeholder="Укажите причину отказа, чтобы студент понял решение…" className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]" /></label>{invalidId === selected.id && <p id={`reason-error-${selected.id}`} role="alert" className="mt-2 text-sm text-[var(--color-danger)]">Укажите причину отказа, чтобы студент понял решение.</p>}<p className="mt-1 text-right text-xs text-slate-400">{(reasons[selected.id] || '').length}/2000</p><div className="mt-4 grid gap-2"><Button loading={savingId === selected.id} disabled={Boolean(savingId)} onClick={() => void confirm(selected.id)}>Подтвердить отсутствие</Button><Button variant="secondary" disabled={Boolean(savingId)} onClick={() => void reject(selected.id)}>Не подтверждать</Button></div></section>
        </div></Card>}
    </div>}{!loading && !loadError && meta && meta.totalPages > 1 && <ListPagination page={meta.page} pageSize={meta.limit} total={meta.total} onChange={load} />}
  </div>;
}
