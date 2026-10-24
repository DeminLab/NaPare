export class AccountApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export type Session = { accessToken: string; refreshToken: string | null };
let refreshing: { token: string; promise: Promise<Session> } | undefined;
export function currentSession(): Session | null {
  const accessToken = localStorage.getItem('accessToken');
  return accessToken ? { accessToken, refreshToken: localStorage.getItem('refreshToken') } : null;
}

function assertSession(session: Session) {
  if (localStorage.getItem('accessToken') !== session.accessToken || localStorage.getItem('refreshToken') !== session.refreshToken) {
    throw new AccountApiError('Аккаунт изменился. Обновите сведения перед действием.', 409);
  }
}

async function read(response: Response): Promise<unknown> {
  let data: unknown;
  try { data = await response.json(); } catch { throw new AccountApiError('Не удалось прочитать подтверждение сервера. Проверьте состояние аккаунта.', response.status); }
  if (!response.ok) {
    const message = (data as { message?: unknown })?.message;
    throw new AccountApiError(typeof message === 'string' ? message : Array.isArray(message) ? message.join('. ') : `Не удалось выполнить действие (${response.status}).`, response.status);
  }
  return data;
}

export async function signIn(email: string, password: string, signal: AbortSignal): Promise<void> {
  const before = localStorage.getItem('accessToken');
  const data = await read(await fetch('/api/v1/auth/login', { method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })) as Session;
  if (!data.accessToken || !data.refreshToken) throw new Error('Сервер не подтвердил вход.');
  signal.throwIfAborted();
  if (localStorage.getItem('accessToken') !== before) throw new Error('Аккаунт изменился в другой вкладке. Обновите страницу.');
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
}

async function refresh(session: Session): Promise<Session> {
  if (!session.refreshToken) throw new AccountApiError('Войдите заново для управления данными.', 401);
  assertSession(session);
  if (!refreshing || refreshing.token !== session.refreshToken) {
    const token = session.refreshToken;
    const promise = (async () => {
      const next = await read(await fetch('/api/v1/auth/refresh', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token }), signal: AbortSignal.timeout(15000) })) as Session;
      assertSession(session);
      if (!next.accessToken || !next.refreshToken) throw new AccountApiError('Войдите заново.', 401);
      localStorage.setItem('accessToken', next.accessToken);
      localStorage.setItem('refreshToken', next.refreshToken);
      return next;
    })();
    refreshing = { token, promise };
    void promise.finally(() => { if (refreshing?.promise === promise) refreshing = undefined; }).catch(() => undefined);
  }
  return refreshing.promise;
}

export async function accountApi<T>(path: string, session: Session, signal: AbortSignal, options: RequestInit = {}, responseMode: 'json' | 'response' = 'json'): Promise<T> {
  assertSession(session);
  const send = (active: Session) => fetch('/api/v1' + path, { ...options, cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active.accessToken}` } });
  const sentToken = session.accessToken;
  let response = await send(session);
  if (response.status === 401 && session.refreshToken && (!options.method || options.method === 'GET')) {
    const next = session.accessToken === sentToken ? await refresh(session) : session;
    signal.throwIfAborted();
    Object.assign(session, next);
    response = await send(session);
  }
  if (response.ok && responseMode === 'response') {
    signal.throwIfAborted(); assertSession(session);
    return response as T;
  }
  const data = await read(response);
  signal.throwIfAborted();
  assertSession(session);
  return data as T;
}

export async function clearAccountSession(session: Session): Promise<boolean> {
  assertSession(session);
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  try {
    let complete = true;
    const registrations = await navigator.serviceWorker?.getRegistrations();
    if (localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')) return false;
    for (const registration of registrations || []) {
      if (new URL(registration.scope).pathname === '/student/') {
        for (const worker of [registration.active, registration.waiting, registration.installing]) worker?.postMessage({ type: 'NAPARE_CLEAR_OFFLINE' });
      }
      if (new URL(registration.scope).pathname === '/notifications/') {
        const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL;
        if (!script || new URL(script).pathname !== '/notifications/push-worker.js') { complete = false; continue; }
        const subscription = await registration.pushManager.getSubscription();
        if (localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')) return false;
        if (subscription && !await subscription.unsubscribe()) complete = false;
      }
    }
    if (localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')) return false;
    return (!('caches' in window) || await caches.delete('napare-student-schedule-v1').then(() => true)) && complete;
  } catch { return false; }
}
