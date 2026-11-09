export type Granularity = 'day' | 'week' | 'month';

export interface AnalyticsRange {
  from: string;
  to: string;
  granularity: Granularity;
}

export interface AnalyticsSeriesPoint {
  bucket: string;
  registrations: number;
  logins: number;
  failedLogins: number;
  activeUsers: number;
  events: number;
  errors: number;
}

export interface BreakdownRow {
  key: string;
  sessions?: number;
  users?: number;
  events?: number;
  requests?: number;
  errors?: number;
}

export interface AnalyticsOverview {
  version: string;
  generatedAt: string;
  range: AnalyticsRange;
  collectionStartedAt: string | null;
  totals: {
    users: { total: number; active: number; blocked: number; new: number };
    sessions: { total: number; users: number; activeNow: number };
    auth: { logins: number; failedLogins: number; logouts: number; loginUsers: number; successRate: number | null };
    events: { total: number; errors: number; requests: number; avgDurationMs: number };
    mobile: { installs: number; appOpens: number; users: number };
  };
  series: AnalyticsSeriesPoint[];
  breakdowns: {
    clients: BreakdownRow[];
    devices: BreakdownRow[];
    os: BreakdownRow[];
    browsers: BreakdownRow[];
    roles: BreakdownRow[];
    universities: Array<{ id: string; name: string; city: string; users: number; sessions: number; lastSeenAt: string | null }>;
    features: BreakdownRow[];
    paths: BreakdownRow[];
    categories: BreakdownRow[];
  };
  funnel: {
    cohort: number;
    steps: Array<{ key: string; label: string; value: number; rate: number | null }>;
    retention: { cohort: number; retained: number; rate: number | null; available: boolean };
  };
  availability: Array<{ key: string; available: boolean; reason: string | null }>;
  limitations: string[];
  scope: { universityIds: string[] | null };
}

export interface TelemetryEvent {
  id: string;
  source: string;
  category: string;
  name: string;
  severity: string;
  userId: string | null;
  universityId: string | null;
  sessionId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  durationMs: number | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; role: string } | null;
}

export interface EventPage {
  data: TelemetryEvent[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface EventFacets {
  categories: Array<{ key: string; count: number }>;
  sources: Array<{ key: string; count: number }>;
  severities: Array<{ key: string; count: number }>;
  names: Array<{ key: string; count: number }>;
}

export interface MonitoredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  universityId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  university: { name: string; city: string } | null;
  lastSeenAt: string | null;
  lastAuthAt: string | null;
  activeSessions: number;
  sessionCount: number;
  loginCount: number;
}

export interface UserPage {
  data: MonitoredUser[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface UserSession {
  id: string;
  userId?: string;
  client: string;
  device: string;
  os: string;
  browser: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  user?: { id: string; email: string; firstName: string; lastName: string; role: string } | null;
}

export interface SessionPage {
  data: UserSession[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface UserActivity {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: string;
    universityId: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
    university: { name: string; city: string } | null;
  };
  summary: {
    sessions: number;
    activeSessions: number;
    logins: number;
    failedLogins: number;
    events: number;
    errors: number;
    lastActivity: string | null;
  };
  sessions: UserSession[];
  authEvents: Array<{
    id: string;
    type: string;
    client: string;
    ip: string | null;
    userAgent: string | null;
    sessionId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    source: string;
    category: string;
    name: string;
    severity: string;
    method: string | null;
    path: string | null;
    statusCode: number | null;
    durationMs: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    actorId: string;
    createdAt: string;
    oldValues: Record<string, unknown> | null;
    newValues: Record<string, unknown> | null;
  }>;
}

const numberFormat = new Intl.NumberFormat('ru-RU');

export const formatNumber = (value: number | null | undefined): string =>
  numberFormat.format(Number(value ?? 0));

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

export function formatDate(value?: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Нет данных';
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDay(value?: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function relativeTime(value?: string | null): string {
  if (!value) return 'Нет данных';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Нет данных';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'только что';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;
  return formatDay(value);
}

export function formatDuration(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  if (value < 1000) return `${Math.round(value)} мс`;
  return `${(value / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} с`;
}

export function overviewPath(days: number, granularity: Granularity, universityId?: string): string {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    granularity,
  });
  if (universityId) params.set('universityId', universityId);
  return `/platform/analytics/overview?${params.toString()}`;
}

export function eventPath(filters: {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  source?: string;
  severity?: string;
  userId?: string;
  universityId?: string;
  days?: number;
}): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  params.set('limit', String(filters.limit ?? 25));
  for (const key of ['q', 'category', 'source', 'severity', 'userId', 'universityId'] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (filters.days) {
    const to = new Date();
    const from = new Date(to.getTime() - (filters.days - 1) * 86_400_000);
    params.set('from', from.toISOString());
    params.set('to', to.toISOString());
  }
  return `/platform/events?${params.toString()}`;
}

export const categoryLabels: Record<string, string> = {
  auth: 'Авторизация',
  request: 'Запрос',
  error: 'Ошибка',
  ui: 'Интерфейс',
  admin: 'Администрирование',
  system: 'Система',
  feature: 'Функция',
};

export const sourceLabels: Record<string, string> = {
  backend: 'Backend',
  web: 'Web',
  android: 'Android',
  max: 'MAX',
  api: 'API',
};

export const severityLabels: Record<string, string> = {
  debug: 'Отладка',
  info: 'Информация',
  warning: 'Предупреждение',
  error: 'Ошибка',
  critical: 'Критично',
};

export const clientLabels: Record<string, string> = {
  web: 'Веб-браузер',
  android: 'Android',
  max: 'MAX Mini App',
  api: 'API-клиент',
  backend: 'Сервер',
  unknown: 'Неизвестно',
};

export const authTypeLabels: Record<string, string> = {
  login_success: 'Успешный вход',
  login_failed: 'Неудачный вход',
  logout: 'Выход',
  logout_all: 'Выход на всех устройствах',
};
