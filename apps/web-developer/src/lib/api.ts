const API_BASE = "/api/v1";
const LOGIN_PATH = "/developer/login";
const USER_CACHE_KEY = "napare:developer-user-cache";

/* ── Token helpers ─────────────────────────────────────────── */

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("accessToken");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("refreshToken");
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem("accessToken", accessToken);
  window.localStorage.setItem("refreshToken", refreshToken);
  // A new session must never show the previous account's cached profile.
  window.localStorage.removeItem(USER_CACHE_KEY);
}

export function clearTokens(): void {
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
  window.localStorage.removeItem(USER_CACHE_KEY);
}

/* ── Token refresh ────────────────────────────────────────── */

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("Нет refresh-токена");

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      throw new Error("Сессия истекла");
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

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  let response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401 && getRefreshToken()) {
    try {
      token = await refreshAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } catch {
      clearTokens();
      window.location.href = LOGIN_PATH;
      throw new Error("Сессия истекла");
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const fallback =
      response.status === 403
        ? "У вас нет доступа к этому разделу."
        : response.status === 404
          ? "Запрошенные данные не найдены или больше недоступны."
          : `Не удалось выполнить запрос (${response.status}).`;
    throw new Error(body?.message || fallback);
  }

  if (response.status === 204) return undefined as T;
  const content = await response.text();
  return (content.trim() ? JSON.parse(content) : undefined) as T;
}

/* ── Auth ─────────────────────────────────────────────────── */

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("Неверные учётные данные");

  const data: LoginResponse = await res.json();
  saveTokens(data.accessToken, data.refreshToken);
}

export async function logout(): Promise<void> {
  const token = getToken();

  try {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Local token removal is still necessary if the network is unavailable.
  }

  clearTokens();
  window.location.href = LOGIN_PATH;
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

/** Last known profile so the workspace shell can paint before the network answers. */
export function readUserCache(): UserInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

let userInflight: Promise<UserInfo> | null = null;

export function getUser(): Promise<UserInfo> {
  // Concurrent callers (shell + page) share one request; the result is cached for the next paint.
  if (!userInflight) {
    userInflight = apiFetch<UserInfo>("/users/me").then((user) => {
      try { window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)); } catch { /* Cache is optional */ }
      return user;
    });
    const settle = () => { userInflight = null; };
    userInflight.then(settle, settle);
  }
  return userInflight;
}

export interface HealthInfo {
  status: string;
  database?: "ok" | "unavailable";
  timestamp: string;
  uptime?: number;
  version?: string;
}

export interface AppInfo {
  name: string;
  version: string;
  description?: string;
}

export async function getHealth(): Promise<HealthInfo> {
  return apiFetch<HealthInfo>("/health");
}

export async function getAppInfo(): Promise<AppInfo> {
  return apiFetch<AppInfo>("/app");
}
