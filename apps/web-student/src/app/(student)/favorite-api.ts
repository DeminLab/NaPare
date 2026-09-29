import { apiFetch } from '@/lib/api';

export interface StudentFavorite {
  id: string;
  kind: 'group' | 'teacher';
  externalId: string;
  label: string;
}

interface FavoriteChange {
  favorite: Omit<StudentFavorite, 'id'>;
  active: boolean;
}

const queueKey = (storageKey: string) => `${storageKey}:pending-sync`;
const queues = new Map<string, Promise<void>>();
const knownStorageKeys = new Set<string>();
let onlineListenerRegistered = false;

export async function getStudentFavorites(): Promise<StudentFavorite[]> {
  return apiFetch<StudentFavorite[]>('/users/me/favorites');
}

export async function saveStudentFavorite(favorite: Omit<StudentFavorite, 'id'>): Promise<void> {
  await apiFetch('/users/me/favorites', { method: 'POST', body: JSON.stringify(favorite) });
}

export async function removeStudentFavorite(favorite: Pick<StudentFavorite, 'kind' | 'externalId'>): Promise<void> {
  await apiFetch('/users/me/favorites', { method: 'DELETE', body: JSON.stringify(favorite) });
}

export async function syncStudentFavorite(storageKey: string, favorite: Omit<StudentFavorite, 'id'>, active: boolean): Promise<void> {
  knownStorageKeys.add(storageKey);
  registerOnlineListener();
  const key = queueKey(storageKey);
  const change: FavoriteChange = { favorite, active };
  try {
    const pending = readQueue(key).filter(item => !sameFavorite(item.favorite, favorite));
    window.localStorage.setItem(key, JSON.stringify([...pending, change]));
  } catch {
    if (active) await saveStudentFavorite(favorite);
    else await removeStudentFavorite(favorite);
    return;
  }
  await flushStudentFavoriteQueue(storageKey);
}

export async function flushStudentFavoriteQueue(storageKey: string): Promise<void> {
  knownStorageKeys.add(storageKey);
  registerOnlineListener();
  const previous = queues.get(storageKey) || Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const key = queueKey(storageKey);
    let pending = readQueue(key);
    while (pending.length) {
      const change = pending[0];
      if (change.active) await saveStudentFavorite(change.favorite);
      else await removeStudentFavorite(change.favorite);
      pending = readQueue(key);
      const completedIndex = pending.findIndex(item => sameChange(item, change));
      if (completedIndex >= 0) pending.splice(completedIndex, 1);
      window.localStorage.setItem(key, JSON.stringify(pending));
    }
  });
  queues.set(storageKey, current);
  try {
    await current;
  } finally {
    if (queues.get(storageKey) === current) queues.delete(storageKey);
  }
}

function registerOnlineListener(): void {
  if (onlineListenerRegistered || typeof window === 'undefined') return;
  onlineListenerRegistered = true;
  window.addEventListener('online', () => {
    for (const storageKey of knownStorageKeys) void flushStudentFavoriteQueue(storageKey).catch(() => undefined);
  });
}

function readQueue(key: string): FavoriteChange[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is FavoriteChange => item && typeof item === 'object'
      && typeof item.active === 'boolean'
      && item.favorite && typeof item.favorite === 'object'
      && (item.favorite.kind === 'group' || item.favorite.kind === 'teacher')
      && typeof item.favorite.externalId === 'string'
      && typeof item.favorite.label === 'string');
  } catch {
    return [];
  }
}

function sameFavorite(left: FavoriteChange['favorite'], right: FavoriteChange['favorite']): boolean {
  return left.kind === right.kind && left.externalId.trim().normalize('NFKC').toLocaleLowerCase('ru-RU')
    === right.externalId.trim().normalize('NFKC').toLocaleLowerCase('ru-RU');
}

function sameChange(left: FavoriteChange, right: FavoriteChange): boolean {
  return left.active === right.active && sameFavorite(left.favorite, right.favorite)
    && left.favorite.label === right.favorite.label;
}
