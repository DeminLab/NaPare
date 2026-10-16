'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch, getUser } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Absence {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  comment?: string | null;
  student?: { firstName: string; lastName: string } | null;
}
interface QueueResponse { data: Absence[]; meta?: { total: number; totalPages: number } }
const reviewers = new Set(['curator', 'faculty_dean', 'department_head', 'university_admin', 'superadmin']);
const reasons: Record<string, string> = { sick: 'Болезнь', learning: 'Учебная причина', work: 'Работа', other_city: 'Другой город', other: 'Другая причина' };
const dateLabel = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export default function AbsencesPage() {
  const params = useSearchParams();
  const requestedId = params.get('absence');
  const [items, setItems] = useState<Absence[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [invalidId, setInvalidId] = useState('');
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true); setError('');
    try {
      const user = await getUser();
      if (request.signal.aborted) return;
      const canReview = reviewers.has(user.role);
      setAllowed(canReview);
      if (!canReview) return;
      const response = await apiFetch<QueueResponse>(`/absences/pending?page=${page}&limit=50`, { signal: request.signal });
      if (request.signal.aborted) return;
      setItems(response.data); setTotal(response.meta?.total ?? response.data.length); setPages(response.meta?.totalPages ?? 1);
    } catch (reason) {
      if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить обращения.');
    } finally { if (!request.signal.aborted) setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  useEffect(() => {
    if (!loading && requestedId) document.getElementById('absence-' + requestedId)?.scrollIntoView({ block: 'center' });
  }, [loading, requestedId]);

  const decide = async (item: Absence, decision: 'confirm' | 'reject') => {
    if (busyId) return;
    const comment = comments[item.id]?.trim();
    if (decision === 'reject' && !comment) { setInvalidId(item.id); document.getElementById('reason-' + item.id)?.focus(); return; }
    setInvalidId(''); setBusyId(item.id); setError(''); setStatus('');
    try {
      await apiFetch(`/curator/absences/${item.id}/${decision}`, { method: 'PATCH', body: JSON.stringify(decision === 'reject' ? { reason: comment } : { comment }) });
      setStatus(decision === 'confirm' ? 'Отсутствие подтверждено.' : 'Обращение отклонено.');
      setItems(previous => previous.filter(record => record.id !== item.id));
      setTotal(previous => Math.max(0, previous - 1));
      if (items.length === 1 && page > 1) setPage(value => value - 1); else await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить решение.'); }
    finally { setBusyId(''); }
  };

  if (allowed === false) return <RequestState kind="forbidden" title="Обращения рассматривает куратор" description="Посещаемость своих занятий доступна в разделе «Посещаемость»." />;
  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="ds-page-title">Обращения об отсутствии</h1>{!loading && <p className="mt-2 text-sm text-slate-500">Ожидают решения: {total}</p>}</div><Button variant="secondary" disabled={Boolean(busyId)} onClick={() => void load()}>Обновить</Button></header>
    {status && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p>}
    {error && <RequestState title="Не удалось выполнить действие" description={error} onRetry={() => void load()} />}
    {!loading && !error && requestedId && items.length > 0 && !items.some(item => item.id === requestedId) && <p role="status" className="text-sm text-slate-500">Обращения нет на этой странице очереди. Проверьте следующие страницы; оно также могло быть уже рассмотрено.</p>}
    {loading ? <div aria-busy="true" className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : !error && !items.length ? <EmptyState title="Все обращения рассмотрены" /> : items.map(item => <Card key={item.id} padding="sm" id={'absence-' + item.id} className={requestedId === item.id ? 'scroll-mt-24 border-sky-300 ring-2 ring-sky-100' : ''}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{item.student ? `${item.student.lastName} ${item.student.firstName}` : 'Студент · имя недоступно'}</h2><Badge variant="warning">{reasons[item.type] || 'Другая причина'}</Badge></div>
      <p className="mt-2 text-sm text-slate-500">{dateLabel(item.startDate)} — {dateLabel(item.endDate)}</p>
      {item.comment && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.comment}</p>}
      <details className="mt-3" open={requestedId === item.id || items.length === 1 || invalidId === item.id}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-sky-700">Рассмотреть обращение</summary>
        <label htmlFor={'reason-' + item.id} className="block text-sm text-slate-600">Комментарий к решению<textarea id={'reason-' + item.id} value={comments[item.id] || ''} onChange={event => { setInvalidId(''); setComments(previous => ({ ...previous, [item.id]: event.target.value })); }} maxLength={2000} rows={2} disabled={Boolean(busyId)} aria-invalid={invalidId === item.id} aria-describedby={invalidId === item.id ? 'error-' + item.id : undefined} className="mt-2 w-full rounded-xl border bg-white p-3 text-sm" /></label>
        {invalidId === item.id && <p id={'error-' + item.id} role="alert" className="mt-2 text-sm text-red-700">Укажите причину отказа.</p>}
        <div className="mt-3 flex flex-wrap gap-2"><Button loading={busyId === item.id} disabled={Boolean(busyId)} onClick={() => void decide(item, 'confirm')}>Подтвердить</Button><Button variant="secondary" disabled={Boolean(busyId)} onClick={() => void decide(item, 'reject')}>Отклонить</Button></div>
      </details>
    </Card>)}
    {pages > 1 && <nav aria-label="Страницы обращений" className="flex items-center justify-between gap-3"><Button variant="secondary" disabled={loading || Boolean(busyId) || page === 1} onClick={() => setPage(value => value - 1)}>Назад</Button><span className="text-sm text-slate-500">{page} из {pages}</span><Button variant="secondary" disabled={loading || Boolean(busyId) || page >= pages} onClick={() => setPage(value => value + 1)}>Далее</Button></nav>}
  </div>;
}
