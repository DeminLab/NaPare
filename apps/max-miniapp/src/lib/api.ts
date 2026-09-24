const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const API_BASE = viteEnv.VITE_API_BASE ?? '/api/v1';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface ProfileUser extends AuthUser {
  groupId?: string | null;
  universityId: string;
  isActive: boolean;
}

export interface Lesson {
  id: string;
  subject: string;
  subjectType?: string;
  room?: string;
  teacherName?: string;
  startTime: string;
  endTime: string;
  pairNumber?: number;
  startDate?: string;
  endDate?: string;
  groupName?: string;
  isChanged?: boolean;
  changeDescription?: string;
}

export interface Absence {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  comment?: string | null;
}

export interface MyDayResponse {
  date: string;
  lessons: Lesson[];
  absences: Absence[];
  notifications: { unreadCount: number };
  summary: { totalLessons: number; changedLessons: number; totalAbsences: number };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  type: string;
  createdAt: string;
}

export interface PairSpace {
  id: string;
  subject: string;
  date: string;
  pairNumber: number;
  teacherName?: string | null;
  room?: string | null;
  announcements: Array<{ id: string; text: string; isPinned: boolean; createdAt: string }>;
  homeworks: Array<{
    id: string;
    title: string;
    description?: string | null;
    deadline?: string | null;
    isCompleted: boolean;
  }>;
  files: Array<{ id: string; fileName: string; fileUrl: string; fileType: string; size: number }>;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AbsenceInput {
  type: string;
  startDate: string;
  endDate: string;
  comment?: string;
}

const memoryStore = new Map<string, string>();

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // fall through to in-memory storage (tests, restricted contexts)
  }
  return {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, value) => {
      memoryStore.set(key, value);
    },
    removeItem: (key) => {
      memoryStore.delete(key);
    },
  };
}

export function getAccessToken(): string | null {
  return storage().getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return storage().getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(tokens: { accessToken: string; refreshToken: string }): void {
  storage().setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage().setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  storage().removeItem(ACCESS_TOKEN_KEY);
  storage().removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = `Ошибка запроса (${response.status})`;
  try {
    const body = (await response.json()) as { code?: string; message?: string | string[] };
    if (typeof body.code === 'string' && body.code) code = body.code;
    if (typeof body.message === 'string') message = body.message;
    else if (Array.isArray(body.message)) message = body.message.join(', ');
  } catch {
    // non-JSON body keeps the defaults above
  }
  return new ApiError(message, response.status, code);
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
    if (!response.ok) {
      if (response.status === 401 || response.status === 400) clearTokens();
      return false;
    }
    const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
    saveTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Сервер недоступен. Проверьте соединение.', 0, 'NETWORK_ERROR');
  }

  if (response.status === 401 && allowRefresh && getRefreshToken() && (await tryRefresh())) {
    return request<T>(path, options, false);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function loginWithMax(
  initData: string,
  credentials?: { email: string; password: string },
): Promise<AuthResponse> {
  const payload = await request<AuthResponse>(
    '/auth/max',
    { method: 'POST', body: JSON.stringify({ initData, ...credentials }) },
    false,
  );
  saveTokens(payload);
  return payload;
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResponse> {
  const payload = await request<AuthResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  );
  saveTokens(payload);
  return payload;
}

export function logout(): void {
  clearTokens();
}

export const getProfile = () => request<ProfileUser>('/users/me');

export const getMyDay = () => request<MyDayResponse>('/my-day');

export const getWeekSchedule = (startDate: string, endDate: string) =>
  request<Paginated<Lesson>>(`/schedule/my?startDate=${startDate}&endDate=${endDate}`);

export const getNotifications = () => request<Paginated<NotificationItem>>('/notifications?limit=50');

export const getPairSpace = (lessonId: string) =>
  request<PairSpace>(`/pair-spaces/${encodeURIComponent(lessonId)}`);

export const createAbsence = (input: AbsenceInput) =>
  request<Absence>('/absences', { method: 'POST', body: JSON.stringify(input) });
