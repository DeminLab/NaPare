'use client';

import { useEffect, useRef } from 'react';

const API_BASE = '/api/v1';
const BATCH_INTERVAL = 3_000;
const MAX_QUEUE = 25;
const STORAGE_KEY = 'napare:install_id';

interface TelemetryEvent {
  name: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

let installId: string | null = null;
let queue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function generateInstallId(): string {
  try {
    const raw = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(raw, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getInstallId(): string {
  if (!installId) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      installId = stored || generateInstallId();
      if (!stored) localStorage.setItem(STORAGE_KEY, installId);
    } catch {
      installId = generateInstallId();
    }
  }
  return installId;
}

function enqueue(event: TelemetryEvent): void {
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(event);
  if (!flushTimer) {
    flushTimer = setInterval(() => { void flush(); }, BATCH_INTERVAL);
    flushTimer.unref?.();
  }
}

async function flush(): Promise<void> {
  if (!queue.length) { flushTimer = null; return; }
  const batch = queue.splice(0, 10);
  flushTimer = null;
  try {
    await fetch(`${API_BASE}/telemetry/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch, installId: getInstallId(), app: 'portal' }),
      keepalive: true,
    });
  } catch { /* fire-and-forget */ }
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    enqueue({ name: 'page.view', path: window.location.pathname });
    const handleVisibility = () => { if (document.visibilityState === 'hidden') void flush(); };
    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      if (mounted.current) void flush();
    };
  }, []);

  return <>{children}</>;
}
