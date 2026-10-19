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
  const [items, setItems] = useState<Absence[]>([]); const [page, setPage] = useState(1); const [meta, setMeta] = useState<PaginatedResponse<Absence>['meta'] | null>(null); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(''); const [error, setError] = useState(''); const [deepLinkMessage, setDeepLinkMessage] = useState(''); const [savingId, setSavingId] = useState(''); const [reasons, setReasons] = useState<Record<string, string>>({}); const [success, setSuccess] = useState(''); const [invalidId, setInvalidId] = useState('');
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
  const decide = async (id: string, action: () => Promise<unknown>) => { setSavingId(id); setError(''); setSuccess(''); try { await action(); setSuccess('Решение сохранено. Можно перейти к следующему обращению.'); if (items.length === 1 && page > 1) await load(page - 1); else await load(page); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить решение.'); } finally { setSavingId(''); } };
  const confirm = (id: string) => decide(id, () => apiFetch(`/absences/${id}/confirm`, { method: 'POST' }));
  const reject = (id: string) => { const reason = reasons[id]?.trim(); if (!reason) { setInvalidId(id); return; } setInvalidId(''); return decide(id, () => apiFetch(`/absences/${id}/excuse`, { method: 'POST', body: JSON.stringify({ reason }) })); };
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Обращения об отсутствии</h1></div>
    <div className="flex flex-wrap items-center justify-between gap-3">{meta && <Badge variant="warning">{meta.total} ожидают решения</Badge>}<Button variant="secondary" loading={loading} onClick={() => load(page, Boolean(params.get('absence')))}>Обновить очередь</Button></div>
    {deepLinkMessage && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{deepLinkMessage}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    {loadError && <RequestState title="Не удалось загрузить очередь" description={loadError} onRetry={() => load(page, Boolean(params.get('absence')))} />}
    {error && <RequestState title="Не удалось выполнить действие" description={error} />}
    {loading ? <div className="space-y-3" aria-busy="true"><Skeleton className="h-48" /><Skeleton className="h-48" /></div> : loadError ? null : !items.length && !error ? <EmptyState title="Все обращения рассмотрены" description="Новые сообщения студентов появятся в этой очереди." /> : <div className="space-y-3">{items.map(item => <Card key={item.id} padding="sm" className={params.get('absence') === item.id ? 'border-amber-300 ring-2 ring-amber-100' : ''}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{item.student ? `${item.student.lastName} ${item.student.firstName}` : 'Студент · имя недоступно'}</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-[var(--color-text-secondary)]">Причина</dt><dd className="mt-1 text-sm font-medium">{typeLabels[item.type] || 'Другая причина'}</dd></div><div><dt className="text-xs text-[var(--color-text-secondary)]">Период отсутствия</dt><dd className="mt-1 text-sm font-medium">{new Date(item.startDate).toLocaleDateString('ru-RU')} — {new Date(item.endDate).toLocaleDateString('ru-RU')}</dd></div></dl><div className="mt-4 rounded-xl bg-[var(--color-surface-secondary)] p-4"><h3 className="text-xs font-semibold text-[var(--color-text-secondary)]">Комментарий студента</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.comment || 'Дополнительный комментарий не оставлен.'}</p></div></div>
      <details open={items.length === 1 || params.get("absence") === item.id || invalidId === item.id} className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Рассмотреть обращение</summary><label className="mt-3 block text-sm text-[var(--color-text-secondary)]">Комментарий при отказе<textarea value={reasons[item.id] || ''} onChange={event => { setInvalidId(''); setReasons(current => ({ ...current, [item.id]: event.target.value })); }} maxLength={2000} aria-invalid={invalidId === item.id} aria-describedby={invalidId === item.id ? `reason-error-${item.id}` : undefined} className="mt-2 min-h-24 w-full resize-y rounded-xl border bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]" /></label>{invalidId === item.id && <p id={`reason-error-${item.id}`} role="alert" className="mt-2 text-sm text-[var(--color-danger)]">Укажите причину отказа, чтобы студент понял решение.</p>}<div className="mt-4 flex flex-col gap-2"><Button loading={savingId === item.id} disabled={Boolean(savingId)} onClick={() => void confirm(item.id)}>Подтвердить отсутствие</Button><Button variant="secondary" disabled={Boolean(savingId)} onClick={() => void reject(item.id)}>Не подтвердить</Button></div></details></div>
</Card>)}</div>}{!loading && !loadError && meta && meta.totalPages > 1 && <ListPagination page={meta.page} pageSize={meta.limit} total={meta.total} onChange={load} />}
  </div>;
}
