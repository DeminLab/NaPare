'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Card, Badge, Button, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Absence { id: string; date: string; subject: string; pairNumber: number; status: string; reason: string; confirmationRequired: boolean; }

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  confirmed: { label: 'Подтверждён', variant: 'success' }, pending: { label: 'Ожидает', variant: 'warning' },
  absent: { label: 'Пропуск', variant: 'danger' }, excused: { label: 'Уважительный', variant: 'neutral' }, late: { label: 'Опоздал', variant: 'neutral' },
};
const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState('');

  const loadAbsences = () => { setLoading(true); setError(''); apiFetchList<Absence>('/absences/my').then(setAbsences).catch(err => setError(err instanceof Error ? err.message : 'Не удалось загрузить пропуски.')).finally(() => setLoading(false)); };
  useEffect(() => { loadAbsences(); }, []);

  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    try { await apiFetch(`/absences/${id}/confirm`, { method: 'POST' }); setAbsences(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed', confirmationRequired: false } : a)); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Не удалось подтвердить пропуск.'); } finally { setConfirmingId(''); }
  };

  const stats = {
    total: absences.length,
    confirmed: absences.filter(a => a.status === 'confirmed').length,
    pending: absences.filter(a => a.status === 'pending').length,
    excused: absences.filter(a => a.status === 'excused').length,
  };
  const subjectStats = useMemo(() => {
    const counts = absences.reduce<Record<string, number>>((result, absence) => { result[absence.subject] = (result[absence.subject] || 0) + 1; return result; }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [absences]);
  const maxSubjectCount = subjectStats[0]?.[1] || 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div><h1 className="ds-page-title text-slate-900">Посещаемость</h1><p className="ds-body mt-1 text-slate-500">Контроль пропусков и учебной нагрузки</p></div>
      <Card className="flex flex-col items-center justify-center bg-indigo-50/40 py-8 text-center"><p className="text-5xl font-extrabold tracking-tight text-indigo-700">—</p><p className="mt-2 text-lg font-semibold text-slate-900">Посещаемость</p><p className="mt-1 text-sm text-slate-500">Процент появится, когда API будет отдавать посещённые занятия</p></Card>
      {!loading && <section className="grid gap-4 sm:grid-cols-3"><Card padding="sm"><p className="text-2xl font-bold text-slate-900">{stats.total}</p><p className="mt-1 text-sm text-slate-500">Всего пропусков</p></Card><Card padding="sm"><p className="text-2xl font-bold text-emerald-600">{stats.confirmed}</p><p className="mt-1 text-sm text-slate-500">Подтверждено</p></Card><Card padding="sm"><p className="text-2xl font-bold text-slate-700">{stats.excused}</p><p className="mt-1 text-sm text-slate-500">Уважительных</p></Card></section>}
      {!loading && subjectStats.length > 0 && <section><h2 className="mb-3 text-lg font-bold text-slate-900">Пропуски по предметам</h2><Card padding="sm" className="divide-y divide-slate-100">{subjectStats.map(([subject, count]) => <div key={subject} className="py-4 first:pt-1 last:pb-1"><div className="flex items-center justify-between gap-4"><span className="truncate text-sm font-medium text-slate-800">{subject}</span><span className="shrink-0 text-sm font-semibold text-slate-500">{count} {count === 1 ? 'пропуск' : 'пропуска'}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(12, (count / maxSubjectCount) * 100)}%` }} /></div></div>)}</Card></section>}
      <section><h2 className="mb-3 text-lg font-bold text-slate-900">Список пропусков</h2>{loading ? <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i}><Skeleton className="h-16" /></Card>)}</div> : error ? <RequestState title="Не удалось загрузить пропуски" description={error} onRetry={loadAbsences} /> : absences.length === 0 ? <EmptyState title="Нет пропусков" description="Отлично! У вас нет пропусков занятий" /> : <div className="space-y-2">{absences.map(a => { const config = statusConfig[a.status] || statusConfig.pending; return <Card key={a.id} padding="sm"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate font-medium text-slate-900">{a.subject}</p><p className="mt-1 text-xs text-slate-500">{formatDate(a.date)} · Пара #{a.pairNumber}</p></div><div className="flex shrink-0 items-center gap-2"><Badge variant={config.variant} dot>{config.label}</Badge>{a.confirmationRequired && a.status === 'pending' && <Button size="sm" variant="secondary" loading={confirmingId === a.id} onClick={() => handleConfirm(a.id)}>Подтвердить</Button>}</div></div></Card>; })}</div>}</section>
    </div>
  );
}
