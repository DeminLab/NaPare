const API_BASE = "/api/v1";
const LOGIN_PATH = "/deanery/login";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("accessToken");
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem("accessToken", accessToken);
  window.localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens(): void {
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
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
  const refreshToken = window.localStorage.getItem("refreshToken");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  let res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
          "Content-Type": "application/json",
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...init.headers,
        },
      });
    } else {
      clearTokens();
      window.location.href = LOGIN_PATH;
      throw new Error("Сессия истекла");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const fallback =
      res.status === 403
        ? "У вас нет доступа к этому разделу."
        : res.status === 404
          ? "Запрошенные данные не найдены или больше недоступны."
          : `Не удалось выполнить запрос (${res.status}).`;
    throw new Error(body?.message || fallback);
  }

  if (res.status === 204) return undefined as T;
  const content = await res.text();
  return (content.trim() ? JSON.parse(content) : undefined) as T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function apiFetchList<T>(
  path: string,
  init: RequestInit = {},
): Promise<T[]> {
  return (await apiFetch<PaginatedResponse<T>>(path, init)).data;
}

function withPagination(path: string, page: number, limit: number): string {
  const [pathname, search = ""] = path.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return `${pathname}?${params.toString()}`;
}

/** Read every server page while retaining the existing client-side filter behavior. */
export async function apiFetchAllPages<T>(
  path: string,
  init: RequestInit = {},
): Promise<T[]> {
  const limit = 100;
  const firstPage = await apiFetch<PaginatedResponse<T>>(
    withPagination(path, 1, limit),
    init,
  );
  if (firstPage.meta.totalPages <= 1) return firstPage.data;

  const pages: T[] = [...firstPage.data];
  const batchSize = 4;
  for (let start = 2; start <= firstPage.meta.totalPages; start += batchSize) {
    const pageNumbers = Array.from(
      { length: Math.min(batchSize, firstPage.meta.totalPages - start + 1) },
      (_, index) => start + index,
    );
    const results = await Promise.all(
      pageNumbers.map((page) =>
        apiFetch<PaginatedResponse<T>>(withPagination(path, page, limit), init),
      ),
    );
    results.forEach((result) => pages.push(...result.data));
  }

  return pages;
}

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Не удалось связаться со службой входа. Проверьте подключение и повторите попытку.");
  }

  if (!res.ok) {
    if (res.status === 400) throw new Error("Проверьте формат электронной почты и заполнение обязательных полей.");
    if (res.status === 401) throw new Error("Неверная электронная почта или пароль.");
    if (res.status === 403) throw new Error("Эта учётная запись не имеет доступа к кабинету университета.");
    if (res.status === 429) throw new Error("Слишком много попыток входа. Подождите и попробуйте ещё раз.");
    if (res.status === 404) throw new Error("Служба входа недоступна по этому адресу. Повторите попытку позже.");
    if (res.status >= 500) throw new Error("Служба входа временно недоступна. Попробуйте позже.");
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : typeof body?.message === "string"
        ? body.message
        : "Не удалось войти. Проверьте данные и повторите попытку.";
    throw new Error(message);
  }

  const data = await res.json();
  saveTokens(data.accessToken, data.refreshToken);
  return data;
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

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  universityId?: string;
}

export async function getUser(): Promise<Me> {
  return apiFetch<Me>("/users/me");
}
