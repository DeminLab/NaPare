const API_BASE = '/api/v1';

/* ── Token helpers ─────────────────────────────────────────── */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('refreshToken');
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem('accessToken', accessToken);
  window.localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens(): void {
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
}

/* ── Token refresh ────────────────────────────────────────── */

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('Нет refresh-токена');

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      throw new Error('Сессия истекла');
    }

    const data = await res.json();
    saveTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/* ── Core fetch ───────────────────────────────────────────── */

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  let response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401 && getRefreshToken()) {
    try {
      token = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } catch {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Сессия истекла');
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const fallback = response.status === 403
      ? 'У вас нет доступа к этому разделу.'
      : response.status === 404
        ? 'Запрошенные данные не найдены или больше недоступны.'
        : `Не удалось выполнить запрос (${response.status}).`;
    throw new Error(body?.message || fallback);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/* ── Auth ─────────────────────────────────────────────────── */

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error('Неверные учётные данные');

  const data: LoginResponse = await res.json();
  saveTokens(data.accessToken, data.refreshToken);
}

export function logout(): void {
  clearTokens();
  window.location.href = '/login';
}

/* ── Typed helpers ────────────────────────────────────────── */

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  universityId?: string;
}

export interface HealthInfo {
  status: string;
  timestamp: string;
  uptime?: number;
  version?: string;
}

export interface AppInfo {
  name: string;
  version: string;
  description?: string;
}

export async function getUser(): Promise<UserInfo> {
  return apiFetch<UserInfo>('/users/me');
}

export async function getHealth(): Promise<HealthInfo> {
  return apiFetch<HealthInfo>('/health');
}

export async function getAppInfo(): Promise<AppInfo> {
  return apiFetch<AppInfo>('/app');
}
