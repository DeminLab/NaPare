const API_BASE = '/api/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('accessToken');
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem('accessToken', accessToken);
  window.localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens(): void {
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshTokens();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = window.localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    saveTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...init.headers,
        },
      });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Сессия истекла');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const fallback = res.status === 403
      ? 'У вас нет доступа к этому разделу.'
      : res.status === 404
        ? 'Запрошенные данные не найдены или больше недоступны.'
        : `Не удалось выполнить запрос (${res.status}).`;
    throw new Error(body?.message || fallback);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function apiFetchList<T>(path: string, init: RequestInit = {}): Promise<T[]> {
  return (await apiFetch<PaginatedResponse<T>>(path, init)).data;
}

export async function login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error('Неверные учетные данные');
  }

  const data = await res.json();
  saveTokens(data.accessToken, data.refreshToken);
  return data;
}

export function logout(): void {
  clearTokens();
  window.location.href = '/login';
}

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  universityId?: string;
}

export async function getUser(): Promise<Me> {
  return apiFetch<Me>('/users/me');
}
