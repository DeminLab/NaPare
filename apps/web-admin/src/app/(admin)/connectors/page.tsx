'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

interface Connector {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  lastSyncAt?: string;
  config?: Record<string, unknown>;
}

const CONNECTOR_TYPES: Record<string, { label: string; variant: 'sky' | 'purple' | 'green' | 'amber' | 'red' | 'slate' }> = {
  bulletin: { label: 'Бюллетень', variant: 'sky' },
  isu: { label: 'ИСУ', variant: 'purple' },
  lms: { label: 'LMS', variant: 'green' },
  custom: { label: 'Свой', variant: 'amber' },
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState('');

  const load = async () => {
    try {
      setConnectors(await apiFetch<Connector[]>('/superadmin/connectors'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (c: Connector) => {
    setTogglingId(c.id);
    try {
      await apiFetch(`/superadmin/connectors/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка изменения');
    } finally {
      setTogglingId('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Коннекторы</h1>
        <p className="mt-1 text-sm text-slate-500">Интеграции с внешними системами</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {connectors.map((c) => {
          const typeInfo = CONNECTOR_TYPES[c.type] || CONNECTOR_TYPES.custom;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  c.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.686a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{c.name}</p>
                    <Badge variant={typeInfo.variant} size="sm">{typeInfo.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {c.lastSyncAt
                      ? `Последняя синхронизация: ${new Date(c.lastSyncAt).toLocaleString('ru-RU')}`
                      : 'Синхронизация не выполнялась'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={c.isActive ? 'green' : 'slate'} dot>
                  {c.isActive ? 'Активен' : 'Отключен'}
                </Badge>
                <Button
                  variant={c.isActive ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => toggleActive(c)}
                  loading={togglingId === c.id}
                >
                  {c.isActive ? 'Отключить' : 'Включить'}
                </Button>
              </div>
            </div>
          );
        })}

        {connectors.length === 0 && (
          <EmptyState
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.686a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            }
            title="Коннекторов пока нет"
            description="Подключите внешние системы для импорта данных"
          />
        )}
      </div>
    </div>
  );
}
