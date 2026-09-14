'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { RequestState } from '@/components/ui/RequestState';

interface Faculty {
  id: string;
  name: string;
  abbreviation?: string;
}

interface Group {
  id: string;
  name: string;
  course: number;
  facultyId: string;
  faculty?: Faculty;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [formName, setFormName] = useState('');
  const [formCourse, setFormCourse] = useState('1');
  const [formFacultyId, setFormFacultyId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [g, f] = await Promise.all([
        apiFetchList<Group>('/admin/groups'),
        apiFetchList<Faculty>('/admin/faculties'),
      ]);
      setGroups(g);
      setFaculties(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = facultyFilter === 'all' ? groups : groups.filter((g) => g.facultyId === facultyFilter);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormCourse('1');
    setFormFacultyId(faculties[0]?.id || '');
    setModalOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditing(g);
    setFormName(g.name);
    setFormCourse(String(g.course));
    setFormFacultyId(g.facultyId);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        name: formName,
        course: Number(formCourse),
        facultyId: formFacultyId,
      };
      if (editing) {
        await apiFetch(`/admin/groups/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/admin/groups', { method: 'POST', body: JSON.stringify(body) });
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
        <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  if (error && groups.length === 0) {
    return <RequestState title="Не удалось загрузить группы" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Группы</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} из {groups.length} групп</p>
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

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFacultyFilter('all')}
          className={`min-h-11 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            facultyFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Все
        </button>
        {faculties.map((f) => (
          <button
            key={f.id}
            onClick={() => setFacultyFilter(f.id)}
            className={`min-h-11 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              facultyFilter === f.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.abbreviation || f.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((g) => (
          <div
            key={g.id}
            className="flex flex-col items-stretch gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                {g.name.slice(0, 3)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{g.name}</p>
                <p className="text-xs text-slate-400">
                  {g.course} курс{g.faculty ? ` · ${g.faculty.name}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge variant="sky" size="sm">{g.course} курс</Badge>
              <button
                onClick={() => openEdit(g)}
                className="min-h-11 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Редактировать
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <EmptyState
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            }
            title="Групп пока нет"
            description="Добавьте первую группу"
            action={<Button onClick={openCreate}>Добавить группу</Button>}
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Редактировать группу' : 'Новая группа'}>
        <div className="space-y-4">
          <Input
            label="Название"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="ИТ-21-1"
            error={modalOpen && !formName.trim() ? 'Укажите название группы' : undefined}
          />
          <Input
            label="Курс"
            type="number"
            min={1}
            max={6}
            value={formCourse}
            onChange={(e) => setFormCourse(e.target.value)}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Факультет</label>
            <select
              value={formFacultyId}
              onChange={(e) => setFormFacultyId(e.target.value)}
              className="block min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!formName.trim() || !formFacultyId}>
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
