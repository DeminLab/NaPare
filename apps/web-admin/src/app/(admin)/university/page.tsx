'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface University {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
}

export default function UniversityPage() {
  const [uni, setUni] = useState<University | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch<University>('/admin/university')
      .then((data) => {
        setUni(data);
        setName(data.name || '');
        setCity(data.city || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await apiFetch<University>('/admin/university', {
        method: 'PATCH',
        body: JSON.stringify({ name, city }),
      });
      setUni(updated);
      setSuccess('Информация сохранена');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Университет</h1>
        <p className="mt-1 text-sm text-slate-500">Основная информация об университете</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-600">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-sky-600 text-xl font-bold text-white">
            {(name || 'У')[0]}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{name || 'Без названия'}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={uni?.isActive ? 'green' : 'slate'} dot>
                {uni?.isActive ? 'Активен' : 'Неактивен'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название университета"
          />
          <Input
            label="Город"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Город"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
