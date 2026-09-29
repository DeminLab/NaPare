'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  readStudentPreparationSubtasks,
  saveStudentPreparationProgress,
  type PreparationSubtask,
} from './preparation-progress-api';

const EMPTY_SUBTASKS: PreparationSubtask[] = [];

export function PreparationChecklist({
  preparationId,
  initialSubtasks,
}: {
  preparationId: string;
  initialSubtasks?: PreparationSubtask[];
}) {
  const baseline = initialSubtasks ?? EMPTY_SUBTASKS;
  const [subtasks, setSubtasks] = useState(baseline);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSubtasks(readStudentPreparationSubtasks(preparationId, baseline));
  }, [baseline, preparationId]);

  useEffect(() => {
    const handleSynced = (event: Event) => {
      if ((event as CustomEvent<{ homeworkId?: string }>).detail?.homeworkId === preparationId) setPending(false);
    };
    window.addEventListener('napare:preparation-progress-synced', handleSynced);
    return () => window.removeEventListener('napare:preparation-progress-synced', handleSynced);
  }, [preparationId]);

  async function save(next: PreparationSubtask[]) {
    const previous = subtasks;
    setSubtasks(next);
    setSaving(true);
    setError('');
    try {
      const result = await saveStudentPreparationProgress(preparationId, { subtasks: next });
      setPending(result.pending);
    } catch (reason) {
      setSubtasks(previous);
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить список.');
    } finally {
      setSaving(false);
    }
  }

  function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || saving || subtasks.length >= 20) return;
    setTitle('');
    void save([...subtasks, { id: crypto.randomUUID(), title: cleanTitle.slice(0, 160), done: false }]);
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-slate-600">Мои шаги ({subtasks.filter(item => item.done).length}/{subtasks.length})</p>
      {subtasks.length > 0 && <ul className="mt-2 space-y-2">
        {subtasks.map(item => <li key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.done}
            disabled={saving}
            aria-label={`Отметить шаг: ${item.title}`}
            onChange={event => void save(subtasks.map(current => current.id === item.id ? { ...current, done: event.target.checked } : current))}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className={`min-w-0 flex-1 text-sm ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.title}</span>
          <button type="button" disabled={saving} onClick={() => void save(subtasks.filter(current => current.id !== item.id))} aria-label={`Удалить шаг: ${item.title}`} className="min-h-9 min-w-9 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">×</button>
        </li>)}
      </ul>}
      {subtasks.length < 20 && <form onSubmit={addSubtask} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor={`subtask-${preparationId}`}>Новый шаг</label>
        <input id={`subtask-${preparationId}`} maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Добавить личный шаг" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        <button type="submit" disabled={saving || !title.trim()} className="min-h-10 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50">Добавить</button>
      </form>}
      {pending && <p className="mt-2 text-xs text-amber-700" role="status">Изменения сохранены офлайн; синхронизируем при подключении.</p>}
      {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
