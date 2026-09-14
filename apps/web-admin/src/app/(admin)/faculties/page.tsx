'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RequestState } from '@/components/ui/RequestState';

interface Faculty {
  id: string;
  name: string;
  abbreviation?: string;
  universityId: string;
}

export default function FacultiesPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [formName, setFormName] = useState('');
  const [formAbbr, setFormAbbr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setFaculties(await apiFetchList<Faculty>('/admin/faculties'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormAbbr('');
    setModalOpen(true);
  };

  const openEdit = (f: Faculty) => {
    setEditing(f);
    setFormName(f.name);
    setFormAbbr(f.abbreviation || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await apiFetch(`/admin/faculties/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: formName, abbreviation: formAbbr }),
        });
      } else {
        await apiFetch('/admin/faculties', {
          method: 'POST',
          body: JSON.stringify({ name: formName, abbreviation: formAbbr }),
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  if (error && faculties.length === 0) {
    return <RequestState title="Не удалось загрузить факультеты" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Факультеты</h1>
          <p className="mt-1 text-sm text-slate-500">{faculties.length} факультетов</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Добавить
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {faculties.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:p-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                {f.abbreviation?.slice(0, 3) || f.name[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{f.name}</p>
                {f.abbreviation && (
                  <p className="text-xs text-slate-400">{f.abbreviation}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => openEdit(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Редактировать
            </button>
          </div>
        ))}

        {faculties.length === 0 && (
          <EmptyState
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            }
            title="Факультетов пока нет"
            description="Добавьте первый факультет"
            action={<Button onClick={openCreate}>Добавить факультет</Button>}
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Редактировать факультет' : 'Новый факультет'}>
        <div className="space-y-4">
          <Input
            label="Название"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Факультет информатики"
            error={modalOpen && !formName.trim() ? 'Укажите название факультета' : undefined}
          />
          <Input
            label="Аббревиатура"
            value={formAbbr}
            onChange={(e) => setFormAbbr(e.target.value)}
            placeholder="ФИ"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!formName.trim()}>
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
