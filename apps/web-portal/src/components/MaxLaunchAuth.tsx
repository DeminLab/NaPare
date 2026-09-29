'use client';

import { FormEvent, useEffect, useState } from 'react';

type Workspace = 'student' | 'staff' | 'admin' | 'developer';
type MaxAuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { role: string };
};
type CurrentSession = {
  accessToken: string;
  label: string;
};
type CurrentSessionProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

declare global {
  interface Window {
    WebApp?: {
      initData?: string;
    };
    __naparePendingMaxInitData?: string;
  }
}

const destinations: Record<Workspace, string> = {
  student: '/student/today',
  staff: '/staff/today',
  admin: '/deanery/dashboard',
  developer: '/developer/api',
};

const MAX_RELAUNCH_MESSAGE = 'Данные запуска MAX недействительны или устарели. Закройте мини-приложение и откройте его снова кнопкой MAX-бота.';

function workspaceForRole(role: string): Workspace | null {
  if (role === 'student') return 'student';
  if (role === 'developer') return 'developer';
  if (['teacher', 'curator', 'faculty_dean', 'department_head'].includes(role)) return 'staff';
  if (['university_admin', 'superadmin'].includes(role)) return 'admin';
  return null;
}

export function MaxLaunchAuth({ captureOnly = false }: { captureOnly?: boolean }) {
  const [initData, setInitData] = useState('');
  const [linkRequired, setLinkRequired] = useState(false);
  const [sessionAccessToken, setSessionAccessToken] = useState('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsRelaunch, setNeedsRelaunch] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      // The Bridge is served by an external CDN and can arrive after hydration.
      // Give the CDN script time to load on slow mobile connections so the
      // one-time launch data is not missed during React hydration.
      for (let attempt = 0; attempt < 150 && active; attempt += 1) {
        const pendingData = window.__naparePendingMaxInitData?.trim();
        const bridgeData = window.WebApp?.initData?.trim();
        const hasFragmentLaunchData = window.location.hash.includes('WebAppData=');
        const launchData = pendingData || bridgeData || (hasFragmentLaunchData ? window.location.hash : '');
        if (launchData) {
          // MAX may place signed launch data in the URL fragment when the
          // Bridge CDN is unavailable. Keep the payload only in memory so it
          // is not left in the address bar or the current history entry.
          if (hasFragmentLaunchData) {
            window.history.replaceState(
              window.history.state,
              '',
              `${window.location.pathname}${window.location.search}`,
            );
          }
          if (captureOnly) {
            window.__naparePendingMaxInitData = launchData;
            return;
          }
          window.__naparePendingMaxInitData = undefined;
          setInitData(launchData);
          try {
            // A MAX identity may already belong to a different site account
            // than the one left in this browser's local storage. Let the API
            // resolve that identity before offering to link the current session.
            await authenticate(launchData);
          } catch (reason) {
            const code = (reason as { code?: string })?.code;
            if (code === 'MAX_INVALID_INIT_DATA') {
              if (active) {
                setNeedsRelaunch(true);
                setError(MAX_RELAUNCH_MESSAGE);
              }
              return;
            }
            if (code === 'MAX_ACCOUNT_NOT_LINKED') {
              let currentSession: CurrentSession | null = null;
              try {
                currentSession = await getCurrentSessionAccessToken();
              } catch {
                // Keep the credential form available if checking the saved
                // site session fails because the network is temporarily down.
              }
              if (active) {
                if (currentSession) {
                  setSessionAccessToken(currentSession.accessToken);
                  setSessionLabel(currentSession.label);
                }
                setLinkRequired(true);
              }
              return;
            }
            setError(reason instanceof Error ? reason.message : 'Не удалось войти через MAX.');
          }
          return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 100));
      }
      if (!captureOnly && active && (window.WebApp || window.location.hash.includes('WebAppData='))) {
        setError('Не удалось получить данные запуска MAX. Повторите открытие мини-приложения.');
      }
    })();
    return () => { active = false; };
  }, [captureOnly]);

  async function getCurrentSessionAccessToken(): Promise<CurrentSession | null> {
    let accessToken = window.localStorage.getItem('accessToken');
    if (!accessToken) return null;

    let profile = await fetch('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let profileUser = profile.ok
      ? await profile.json().catch(() => null) as CurrentSessionProfile | null
      : null;

    if (profile.status === 401) {
      const refreshToken = window.localStorage.getItem('refreshToken');
      if (refreshToken) {
        const refreshed = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const tokens = await refreshed.json().catch(() => null) as MaxAuthResponse | null;
        if (refreshed.ok && tokens?.accessToken && tokens.refreshToken) {
          accessToken = tokens.accessToken;
          window.localStorage.setItem('accessToken', tokens.accessToken);
          window.localStorage.setItem('refreshToken', tokens.refreshToken);
          profile = await fetch('/api/v1/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          profileUser = profile.ok
            ? await profile.json().catch(() => null) as CurrentSessionProfile | null
            : null;
        } else if (refreshed.status === 401) {
          window.localStorage.removeItem('accessToken');
          window.localStorage.removeItem('refreshToken');
        }
      }
    }

    if (!profile.ok || !profileUser) return null;
    const name = [profileUser.firstName, profileUser.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ');
    const label = [name, profileUser.email?.trim()]
      .filter((part): part is string => Boolean(part))
      .join(' · ') || 'аккаунт сайта';
    return { accessToken, label };
  }

  async function authenticate(data: string, credentials?: { email: string; password: string }, accessToken?: string) {
    const response = await fetch(accessToken ? '/api/v1/auth/max/link' : '/api/v1/auth/max', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ initData: data, ...credentials }),
    });
    const payload = await response.json().catch(() => null) as (MaxAuthResponse & { code?: string; message?: string }) | null;
    if (!response.ok) {
      const failure = new Error(payload?.message || `Не удалось выполнить вход (${response.status}).`) as Error & { code?: string };
      failure.code = payload?.code;
      throw failure;
    }
    if (!payload?.accessToken || !payload.refreshToken || !payload.user?.role) {
      throw new Error('Сервер вернул неполный ответ авторизации.');
    }

    const workspace = workspaceForRole(payload.user.role);
    if (!workspace) throw new Error('Для этой роли пока не настроен кабинет.');
    window.localStorage.setItem('accessToken', payload.accessToken);
    window.localStorage.setItem('refreshToken', payload.refreshToken);
    window.location.assign(destinations[workspace]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Введите email и пароль, выданные университетом.');
      return;
    }

    setBusy(true);
    try {
      await authenticate(initData, { email: email.trim().toLowerCase(), password });
    } catch (reason) {
      if ((reason as { code?: string })?.code === 'MAX_INVALID_INIT_DATA') {
        setNeedsRelaunch(true);
        setError(MAX_RELAUNCH_MESSAGE);
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Не удалось привязать аккаунт.');
    } finally {
      setBusy(false);
    }
  }

  async function linkCurrentAccount() {
    if (!sessionAccessToken) return;
    setError('');
    setBusy(true);
    try {
      await authenticate(initData, undefined, sessionAccessToken);
    } catch (reason) {
      if ((reason as { code?: string })?.code === 'MAX_INVALID_INIT_DATA') {
        setNeedsRelaunch(true);
        setError(MAX_RELAUNCH_MESSAGE);
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Не удалось привязать аккаунт.');
    } finally {
      setBusy(false);
    }
  }

  async function retryLaunch() {
    const retryData = window.WebApp?.initData?.trim() || initData;
    if (!retryData) {
      window.location.reload();
      return;
    }

    setError('');
    setBusy(true);
    try {
      await authenticate(retryData);
    } catch (reason) {
      const code = (reason as { code?: string })?.code;
      if (code === 'MAX_INVALID_INIT_DATA') {
        setNeedsRelaunch(true);
        setError(MAX_RELAUNCH_MESSAGE);
        return;
      }
      if (code === 'MAX_ACCOUNT_NOT_LINKED') {
        try {
          const currentSession = await getCurrentSessionAccessToken();
          if (currentSession) {
            setSessionAccessToken(currentSession.accessToken);
            setSessionLabel(currentSession.label);
          }
        } catch {
          // The credential form remains usable when the saved site session
          // cannot be checked because of a temporary network failure.
        }
        setInitData(retryData);
        setLinkRequired(true);
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Не удалось повторить вход через MAX.');
    } finally {
      setBusy(false);
    }
  }

  if (!linkRequired) {
    if (error) return (
      <aside className="max-launch-notice" role="alert">
        <span>{error}</span>
        {!needsRelaunch && <button type="button" onClick={() => void retryLaunch()} disabled={busy}>
          {busy ? 'Проверяем…' : initData ? 'Повторить вход через MAX' : 'Перезагрузить'}
        </button>}
      </aside>
    );
    if (initData) return <aside className="max-launch-notice" role="status">Открываем ваш кабинет…</aside>;
    return null;
  }

  return (
    <div className="max-launch-backdrop">
      <section className="max-launch-card" role="dialog" aria-modal="true" aria-labelledby="max-link-title">
        <p className="eyebrow">Первый вход через MAX</p>
        <h2 id="max-link-title">Привяжите аккаунт НаПаре</h2>
        <p>Свяжите MAX с аккаунтом, выданным университетом. Если в этом браузере уже выполнен вход, можно использовать его; иначе введите email и пароль.</p>
        {needsRelaunch && <p role="alert" className="error">{error}</p>}
        {!needsRelaunch && sessionAccessToken && (
          <div className="max-launch-current-session">
            <p>Сейчас открыт аккаунт: <strong>{sessionLabel}</strong></p>
            <button type="button" onClick={linkCurrentAccount} disabled={busy}>
              {busy ? 'Привязываем…' : 'Привязать MAX к этому аккаунту'}
            </button>
          </div>
        )}
        {!needsRelaunch && <form onSubmit={submit} className="max-launch-form">
          <label htmlFor="max-link-email">Email</label>
          <input id="max-link-email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="max-link-password">Пароль</label>
          <input id="max-link-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? 'Проверяем…' : 'Войти и привязать по email'}</button>
        </form>}
      </section>
    </div>
  );
}
