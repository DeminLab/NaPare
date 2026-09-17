export interface MaxWebApp {
  initData?: string;
  ready?: () => void | Promise<void>;
  expand?: () => void;
  close?: () => void;
}

declare global {
  interface Window {
    WebApp?: MaxWebApp;
  }
}

export function getMaxWebApp(): MaxWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.WebApp ?? null;
}

export async function initializeMax(): Promise<MaxWebApp | null> {
  const app = getMaxWebApp();
  if (!app) return null;
  await app.ready?.();
  app.expand?.();
  return app;
}

/** Raw launch data only. It must be validated by the backend before authentication. */
export function getInitData(): string | null {
  return getMaxWebApp()?.initData || null;
}
