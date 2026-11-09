/**
 * NaPare Client Telemetry Beacon — web-student
 *
 * Sends lightweight, anonymised events to /api/v1/telemetry/events.
 * Never stores credentials, personal data or request bodies.
 *
 * Android WebView support:
 *   The beacon works identically — the web content runs inside the WebView
 *   and POSTs to the same endpoint. For app-launch tracking, Android should
 *   inject a small JS snippet via evaluateJavascript that sets installId
 *   and fires the app.open event (see Android docs below).
 */

import { useCallback, useEffect, useRef } from 'react';

const API_BASE = '/api/v1';
const BATCH_INTERVAL = 3_000;
const MAX_QUEUE = 25;
const STORAGE_KEY = 'napare:install_id';
const X_NAPARE_CLIENT = 'x-napare-client';

type ClientApp = 'portal' | 'student' | 'staff' | 'admin' | 'developer' | 'android' | 'max';

interface TelemetryEvent {
  name: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

let installId: string | null = null;

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

let queue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function enqueue(event: TelemetryEvent): void {
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(event);
  if (!flushTimer) {
    flushTimer = setInterval(() => { void flush(); }, BATCH_INTERVAL);
    flushTimer.unref?.();
  }
}

async function flush(): Promise<void> {
  if (!queue.length) {
    flushTimer = null;
    return;
  }
  const batch = queue.splice(0, 10);
  flushTimer = null;
  try {
    await fetch(`${API_BASE}/telemetry/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: batch,
        installId: getInstallId(),
        app: 'student',
      }),
      keepalive: true,
    });
  } catch {
    /* Beacon is fire-and-forget; failures are silently dropped. */
  }
}

/** Track a single telemetry event. */
export function track(name: string, metadata?: Record<string, unknown>, path?: string): void {
  enqueue({ name, path: path ?? window.location.pathname, metadata });
}

/** React hook that records page views and flushes periodically. */
export function useTelemetry(): void {
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const { pathname } = window.location;
    track('page.view', { url: pathname });

    // Flush on page hide / unload
    const handleVisibility = () => { if (document.visibilityState === 'hidden') void flush(); };
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      void flush();
      mounted.current = false;
    };
  }, []);
}

/**
 * Android WebView integration snippet.
 *
 * Add this to MainActivity.java onAppCreate or onPageFinished:
 *
 *   String js = "(function(){ "
 *     + "var id = localStorage.getItem('napare:install_id'); "
 *     + "if (!id) { "
 *     + "  var bytes = new Uint8Array(16); "
 *     + "  window.crypto.getRandomValues(bytes); "
 *     + "  id = Array.from(bytes, b=>b.toString(16).padStart(2,'0')).join(''); "
 *     + "  localStorage.setItem('napare:install_id', id); "
 *     + "} "
 *     + "if (sessionStorage.getItem('napare:app_opened') !== '1') { "
 *     + "  sessionStorage.setItem('napare:app_opened', '1'); "
 *     + "  fetch('/api/v1/telemetry/events', { "
 *     + "    method:'POST', "
 *     + "    headers:{'Content-Type':'application/json'}, "
 *     + "    body:JSON.stringify({events:[{name:'app.open',metadata:{installId:id}}],installId:id,app:'student'}) "
 *     + "  }); "
 *     + "} "
 *     + "})();";
 *   webView.evaluateJavascript(js, null);
 *
 * This ensures installId is generated and the app.open event is sent on every
 * Android launch, even when offline (the beacon will be delivered on next
 * connection because the web app's flush timer persists the queue).
 */
