const API_BASE = '/api/v1';

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

export function isLoggedIn(): boolean {
  return !!getToken();
}

export interface StudentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  universityId: string;
  isActive: boolean;
  groupName?: string;
  universityName?: string;
}

export async function getUser(): Promise<StudentUser> {
  return apiFetch<StudentUser>('/users/me');
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      const retryResponse = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...init.headers,
        },
      });
      if (!retryResponse.ok) throw await toApiError(retryResponse);
      if (retryResponse.status === 204) return undefined as T;
      return (await retryResponse.json()) as T;
    }
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Сессия истекла');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const fallback = response.status === 403
      ? 'У вас нет доступа к этому разделу.'
      : response.status === 404
        ? 'Запрошенные данные не найдены или больше недоступны.'
        : `Не удалось выполнить запрос (${response.status}).`;
    throw new Error(data?.message || fallback);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function apiFetchList<T>(path: string, init: RequestInit = {}): Promise<T[]> {
  return (await apiFetch<PaginatedResponse<T>>(path, init)).data;
}

async function toApiError(response: Response): Promise<Error> {
  const data = await response.json().catch(() => null);
  return new Error(data?.message || `Не удалось выполнить запрос (${response.status}).`);
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    saveTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Неверный email или пароль');
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || 'Не удалось выполнить вход');
  }
  const data = await response.json();
  saveTokens(data.accessToken, data.refreshToken);
}

export async function register(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  universityId: string;
  groupId: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message || 'Ошибка регистрации');
  }
  const data = await response.json();
  saveTokens(data.accessToken, data.refreshToken);
}

export interface UniversityOption {
  id: string;
  name: string;
  city: string;
}

export async function getUniversities(): Promise<UniversityOption[]> {
  const response = await fetch(`${API_BASE}/auth/universities`);
  if (!response.ok) throw new Error('Не удалось загрузить данные СИБИТа');
  return response.json();
}

export interface RaspGroup {
  groupId: string;
  name: string;
  faculty: string;
  facultyId: number;
  course: number;
  academicYear: string;
}

export async function getRaspGroups(year?: string): Promise<RaspGroup[]> {
  const query = year ? `?year=${encodeURIComponent(year)}` : '';
  const response = await fetch(`${API_BASE}/auth/rasp-groups${query}`);
  if (!response.ok) {
    throw new Error('Не удалось загрузить группы с rasp.sano.ru');
  }
  return response.json();
}

export function logout(): void {
  clearTokens();
  if (typeof window !== 'undefined') window.location.href = '/login';
}

export async function getNotifications(): Promise<any[]> {
  return apiFetchList('/notifications');
}

export async function getUnreadCount(): Promise<number> {
  const data = await apiFetch<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllRead(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'POST' });
}
