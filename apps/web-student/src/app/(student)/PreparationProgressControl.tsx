'use client';

import { useEffect, useState } from 'react';
import { readStudentPreparationProgress, saveStudentPreparationProgress } from './preparation-progress-api';

export type PreparationProgress = 'todo' | 'in_progress' | 'done';

const nextState: Record<PreparationProgress, PreparationProgress> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

const stateLabel: Record<PreparationProgress, string> = {
  todo: 'В планах',
  in_progress: 'Делаю',
  done: 'Готово',
};

export function PreparationProgressControl({
  preparationId,
  initialState,
  onSaved,
}: {
  preparationId: string;
  initialState?: PreparationProgress;
  onSaved?: (state: PreparationProgress) => void;
}) {
  const [state, setState] = useState<PreparationProgress>(initialState ?? 'todo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setState(readStudentPreparationProgress(preparationId, initialState ?? 'todo'));
  }, [initialState, preparationId]);

  useEffect(() => {
    const handleSynced = (event: Event) => {
      if ((event as CustomEvent<{ homeworkId?: string }>).detail?.homeworkId === preparationId) setPending(false);
    };
    window.addEventListener('napare:preparation-progress-synced', handleSynced);
    return () => window.removeEventListener('napare:preparation-progress-synced', handleSynced);
  }, [preparationId]);

  async function advance() {
    if (busy) return;
    const stateToSave = nextState[state];
    setBusy(true);
    setError('');
    try {
      const result = await saveStudentPreparationProgress(preparationId, { state: stateToSave });
      if (result.state) {
        setState(result.state);
        onSaved?.(result.state);
      }
      setPending(result.pending);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить статус.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <span className={`text-xs font-semibold ${state === 'done' ? 'text-emerald-700' : state === 'in_progress' ? 'text-indigo-700' : 'text-slate-500'}`}>
        {stateLabel[state]}
      </span>
      <button
        type="button"
        disabled={busy}
        aria-pressed={state === 'done'}
        aria-label={`Изменить личный статус подготовки: ${stateLabel[state]}`}
        onClick={() => void advance()}
        className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? 'Сохраняем…' : state === 'todo' ? 'Начать' : state === 'in_progress' ? 'Готово' : 'Вернуть'}
      </button>
      {pending && <span className="max-w-32 text-right text-[11px] text-amber-700" role="status">Сохранено офлайн · ждёт сети</span>}
      {error && <span className="max-w-32 text-right text-[11px] text-rose-700" role="alert">{error}</span>}
    </div>
  );
}
