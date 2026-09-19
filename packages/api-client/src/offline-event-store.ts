import type { EventEnvelope, InboxItem, Lesson, Notification, Homework } from './types';
import type { ApiClient } from './client';

export interface OfflineSnapshot {
  schedule: Lesson[];
  homework: Homework[];
  notifications: Notification[];
  inbox: InboxItem[];
  lastSyncedAt: string | null;
  status: 'offline' | 'syncing' | 'synced' | 'stale';
}

const STORAGE_KEY = 'napare.offline.snapshot.v1';
const EVENT_CURSOR_KEY = 'napare.offline.events.cursor.v1';

export function readOfflineSnapshot(): OfflineSnapshot | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value ? JSON.parse(value) as OfflineSnapshot : null;
}

export function writeOfflineSnapshot(snapshot: OfflineSnapshot): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function getEventCursor(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(EVENT_CURSOR_KEY);
}

export function applyEventCursor(event: EventEnvelope): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EVENT_CURSOR_KEY, event.timestamp);
}

export function startOfflineSync(
  client: Pick<ApiClient, 'getEventsSince' | 'subscribeToEvents'>,
  applyEvent: (event: EventEnvelope) => Promise<void> | void,
  onStatusChange?: (status: OfflineSnapshot['status']) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const appliedEventIds = new Set<string>();
  const applyOnce = async (event: EventEnvelope) => {
    if (appliedEventIds.has(event.id)) return;
    await applyEvent(event);
    appliedEventIds.add(event.id);
    applyEventCursor(event);
  };

  const replay = async () => {
    onStatusChange?.('syncing');
    try {
      const events = await client.getEventsSince(getEventCursor() ?? undefined);
      for (const event of events) {
        await applyOnce(event);
      }
      onStatusChange?.('synced');
    } catch {
      onStatusChange?.('stale');
    }
  };

  const stopStream = client.subscribeToEvents(async (event) => {
    await applyOnce(event);
    onStatusChange?.('synced');
  }, {
    since: getEventCursor() ?? undefined,
    onStatusChange: (status) => onStatusChange?.(status === 'offline' ? 'offline' : status === 'open' ? 'synced' : 'syncing'),
  });
  const onOnline = () => void replay();
  window.addEventListener('online', onOnline);
  void replay();

  return () => {
    stopStream();
    window.removeEventListener('online', onOnline);
  };
}
