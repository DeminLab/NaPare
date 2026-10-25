export const PUSH_SCOPE = '/notifications/';
export const PUSH_WORKER = '/notifications/push-worker.js';
export function supportsPush() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export async function ownRegistration() {
  const registration = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
  if (!registration || new URL(registration.scope).pathname !== PUSH_SCOPE) return null;
  const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL;
  if (!script || new URL(script).pathname !== PUSH_WORKER) throw new Error('Для этого раздела уже установлен другой обработчик. Обратитесь к администратору.');
  return registration;
}
export function publicKey(value: string): ArrayBuffer {
  const text = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(text, character => character.charCodeAt(0)).buffer;
}
export async function endpointHash(subscription: PushSubscription) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function registerWorker(signal: AbortSignal) {
  await ownRegistration(); signal.throwIfAborted();
  const registration = await navigator.serviceWorker.register(PUSH_WORKER, { scope: PUSH_SCOPE, updateViaCache: 'none' });
  if (registration.active) return registration;
  const worker = registration.installing || registration.waiting;
  if (!worker) throw new Error('Обработчик уведомлений не установлен. Повторите подключение.');
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => { clearTimeout(timer); worker.removeEventListener('statechange', state); signal.removeEventListener('abort', aborted); error ? reject(error) : resolve(); };
    const state = () => { if (worker.state === 'activated') finish(); else if (worker.state === 'redundant') finish(new Error('Обработчик уведомлений не активирован.')); };
    const aborted = () => finish(new Error('Действие прервано.'));
    const timer = setTimeout(() => finish(new Error('Обработчик не запустился. Повторите подключение.')), 15000);
    worker.addEventListener('statechange', state); signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted(); else state();
  });
  return registration;
}
