'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, Badge, Button, EmptyState, Skeleton } from '@/components/ui';

interface Absence {
  id: string;
  date: string;
  subject: string;
  pairNumber: number;
  status: string;
  reason: string;
  confirmationRequired: boolean;
}

const statusConfig: Record<string, { label: string; variant: 'green' | 'amber' | 'red' | 'purple' | 'slate'; icon: string }> = {
  confirmed: { label: 'Подтверждён', variant: 'green', icon: '✅' },
  pending: { label: 'Ожидает', variant: 'amber', icon: '⏳' },
  absent: { label: 'Пропуск', variant: 'red', icon: '❌' },
  excused: { label: 'Уважительный', variant: 'purple', icon: '📋' },
  late: { label: 'Опоздал', variant: 'slate', icon: '⏰' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Absence[]>('/absences/my')
      .then(data => setAbsences(data))
      .catch(() => setAbsences([]))
      .finally(() => setLoading(false));
  }, []);

  const handleConfirm = async (id: string) => {
    try {
      await apiFetch(`/absences/${id}/confirm`, { method: 'POST' });
      setAbsences(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed', confirmationRequired: false } : a));
    } catch {}
  };

  const stats = {
    total: absences.length,
    confirmed: absences.filter(a => a.status === 'confirmed').length,
    pending: absences.filter(a => a.status === 'pending').length,
    excused: absences.filter(a => a.status === 'excused').length,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Мои пропуски</h1>

      {!loading && absences.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Card padding="sm" className="text-center">
            <p className="text-xl font-extrabold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Всего</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-xl font-extrabold text-emerald-600">{stats.confirmed}</p>
            <p className="text-xs text-slate-500">Подтв.</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-xl font-extrabold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-slate-500">Ожидает</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-xl font-extrabold text-purple-600">{stats.excused}</p>
            <p className="text-xs text-slate-500">Уважит.</p>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i}><Skeleton className="h-16" /></Card>)}
        </div>
      ) : absences.length === 0 ? (
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="Нет пропусков"
          description="Отлично! У вас нет пропусков занятий"
        />
      ) : (
        <div className="space-y-2">
          {absences.map((a) => {
            const config = statusConfig[a.status] || statusConfig.pending;
            return (
              <Card key={a.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-center w-12">
                      <p className="text-sm font-bold text-slate-900">{formatDate(a.date)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{a.subject}</p>
                      <p className="text-xs text-slate-500">Пара #{a.pairNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.variant} dot>{config.label}</Badge>
                    {a.confirmationRequired && a.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => handleConfirm(a.id)}>Подтвердить</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
