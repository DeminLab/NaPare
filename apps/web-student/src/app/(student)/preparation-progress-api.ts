import { apiFetch } from '@/lib/api';
import type { PreparationProgress } from './PreparationProgressControl';

export interface PreparationSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface PreparationProgressPatch {
  state?: PreparationProgress;
  subtasks?: PreparationSubtask[];
}

interface QueuedProgress extends PreparationProgressPatch {
  homeworkId: string;
}

const validStates: PreparationProgress[] = ['todo', 'in_progress', 'done'];
const queues = new Map<string, Promise<void>>();
const knownScopes = new Set<string>();
let onlineListenerRegistered = false;

export function readStudentPreparationProgress(homeworkId: string, serverState: PreparationProgress): PreparationProgress {
  return readPending(homeworkId)?.state ?? serverState;
}

export function readStudentPreparationSubtasks(homeworkId: string, serverSubtasks: PreparationSubtask[]): PreparationSubtask[] {
  return readPending(homeworkId)?.subtasks ?? serverSubtasks;
}

export async function saveStudentPreparationProgress(
  homeworkId: string,
  patch: PreparationProgressPatch,
): Promise<{ state?: PreparationProgress; subtasks?: PreparationSubtask[]; pending: boolean }> {
  const scope = accountScope();
  if (!scope) throw new Error('Не удалось определить аккаунт для сохранения статуса.');
  if (patch.state === undefined && patch.subtasks === undefined) throw new Error('Нет изменений для сохранения.');
  knownScopes.add(scope);
  registerOnlineListener();
  const queueKey = `${scope}:pending-sync`;
  const old = readQueue(queueKey).find(item => item.homeworkId === homeworkId);
  const change: QueuedProgress = { homeworkId, ...old, ...patch };
  const pendingQueue = readQueue(queueKey).filter(item => item.homeworkId !== homeworkId);
  pendingQueue.push(change);
  window.localStorage.setItem(queueKey, JSON.stringify(pendingQueue));

  if (!navigator.onLine) return { ...change, pending: true };
  try {
    await flushStudentPreparationProgress(scope);
    return { ...change, pending: false };
  } catch (reason) {
    if (reason instanceof TypeError || !navigator.onLine) return { ...change, pending: true };
    const remaining = readQueue(queueKey).flatMap(item => {
      if (item.homeworkId !== homeworkId) return [item];
      const rest: QueuedProgress = { ...item };
      if (patch.state !== undefined && rest.state === patch.state) delete rest.state;
      if (patch.subtasks !== undefined && JSON.stringify(rest.subtasks) === JSON.stringify(patch.subtasks)) delete rest.subtasks;
      return rest.state !== undefined || rest.subtasks !== undefined ? [rest] : [];
    });
    window.localStorage.setItem(queueKey, JSON.stringify(remaining));
    throw reason;
  }
}

export async function flushStudentPreparationProgress(scope: string): Promise<void> {
  knownScopes.add(scope);
  registerOnlineListener();
  const previous = queues.get(scope) || Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const queueKey = `${scope}:pending-sync`;
    let pending = readQueue(queueKey);
    while (pending.length) {
      const change = pending[0];
      await apiFetch(`/pair-spaces/homeworks/${encodeURIComponent(change.homeworkId)}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ ...(change.state !== undefined ? { state: change.state } : {}), ...(change.subtasks !== undefined ? { subtasks: change.subtasks } : {}) }),
      });
      pending = readQueue(queueKey);
      const index = pending.findIndex(item => sameChange(item, change));
      if (index >= 0) {
        pending.splice(index, 1);
        window.dispatchEvent(new CustomEvent('napare:preparation-progress-synced', { detail: { homeworkId: change.homeworkId } }));
      }
      window.localStorage.setItem(queueKey, JSON.stringify(pending));
    }
  });
  queues.set(scope, current);
  try {
    await current;
  } finally {
    if (queues.get(scope) === current) queues.delete(scope);
  }
}

function readPending(homeworkId: string): QueuedProgress | undefined {
  const scope = accountScope();
  if (!scope) return undefined;
  knownScopes.add(scope);
  registerOnlineListener();
  const queue = readQueue(`${scope}:pending-sync`);
  if (navigator.onLine && queue.length) void flushStudentPreparationProgress(scope).catch(() => undefined);
  return queue.find(item => item.homeworkId === homeworkId);
}

function accountScope(): string | null {
  try {
    const encoded = window.localStorage.getItem('accessToken')?.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; universityId?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.universityId !== 'string') return null;
    return `napare:preparation-progress:${encodeURIComponent(claims.universityId)}:${encodeURIComponent(claims.sub)}`;
  } catch {
    return null;
  }
}

function readQueue(key: string): QueuedProgress[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is QueuedProgress => item && typeof item === 'object'
      && typeof item.homeworkId === 'string'
      && (item.state === undefined || validStates.includes(item.state))
      && (item.subtasks === undefined || (Array.isArray(item.subtasks) && item.subtasks.every(isSubtask)))
      && (item.state !== undefined || item.subtasks !== undefined));
  } catch {
    return [];
  }
}

function isSubtask(value: unknown): value is PreparationSubtask {
  return !!value && typeof value === 'object'
    && typeof (value as PreparationSubtask).id === 'string'
    && typeof (value as PreparationSubtask).title === 'string'
    && typeof (value as PreparationSubtask).done === 'boolean';
}

function sameChange(left: QueuedProgress, right: QueuedProgress): boolean {
  return left.homeworkId === right.homeworkId
    && left.state === right.state
    && JSON.stringify(left.subtasks) === JSON.stringify(right.subtasks);
}

function registerOnlineListener(): void {
  if (onlineListenerRegistered || typeof window === 'undefined') return;
  onlineListenerRegistered = true;
  window.addEventListener('online', () => {
    for (const scope of knownScopes) void flushStudentPreparationProgress(scope).catch(() => undefined);
  });
}
