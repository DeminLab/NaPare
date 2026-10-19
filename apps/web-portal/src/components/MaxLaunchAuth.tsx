'use client';

import { useEffect, useState } from 'react';

type Workspace = 'student' | 'staff' | 'admin' | 'developer' | 'career';
type MaxAuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { role: string };
};

declare global {
  interface Window {
    WebApp?: { initData?: string };
    __naparePendingMaxInitData?: string;
  }
}

const destinations: Record<Workspace, string> = {
  career: '/career',
  student: '/student/today',
  staff: '/staff/today',
  admin: '/deanery/dashboard',
  developer: '/developer/api',
};

const MAX_RELAUNCH_MESSAGE = 'Данные MAX устарели или недействительны. Закройте приложение и откройте его снова кнопкой MAX-бота.';

function workspaceForRole(role: string): Workspace | null {
  if (role === 'student') return 'student';
  if (role === 'developer') return 'developer';
  if (['employer', 'career_staff', 'career_admin'].includes(role)) return 'career';
  if (['teacher', 'curator', 'faculty_dean', 'department_head'].includes(role)) return 'staff';
  if (['university_admin', 'superadmin'].includes(role)) return 'admin';
  return null;
}

function getLaunchData(): string {
  const pendingData = window.__naparePendingMaxInitData?.trim();
  const bridgeData = window.WebApp?.initData?.trim();
  const hasFragmentLaunchData = window.location.hash.includes('WebAppData=');
  const fragmentData = hasFragmentLaunchData ? window.location.hash : '';
  const launchData = pendingData || bridgeData || fragmentData;

  if (hasFragmentLaunchData) {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }
  window.__naparePendingMaxInitData = undefined;
  return launchData;
}

export function MaxLaunchAuth({
  captureOnly = false,
  onCapture,
}: {
  captureOnly?: boolean;
  onCapture?: (data: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [launchData, setLaunchData] = useState('');

  useEffect(() => {
    if (!captureOnly) return;
    let active = true;
    void (async () => {
      for (let attempt = 0; attempt < 150 && active; attempt += 1) {
        const data = getLaunchData();
        if (data) {
          window.__naparePendingMaxInitData = data;
          onCapture?.(data);
          return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 100));
      }
    })();
    return () => { active = false; };
  }, [captureOnly, onCapture]);

  async function signInWithMax(data?: string) {
    setBusy(true);
    setError('');
    setRetryAvailable(false);
    try {
      let initData = data || getLaunchData();
      if (!initData && !window.WebApp && !window.location.hash.includes('WebAppData=')) {
        setError('Для входа через MAX откройте НаПаре внутри MAX. В обычном браузере выберите вход по логину и паролю.');
        return;
      }
      for (let attempt = 0; !initData && attempt < 150; attempt += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 100));
        initData = getLaunchData();
      }
      if (!initData) {
        setError('Для входа через MAX откройте НаПаре внутри MAX. В обычном браузере выберите вход по логину и паролю.');
        return;
      }

      setLaunchData(initData);
      const response = await fetch('/api/v1/auth/max', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const payload = await response.json().catch(() => null) as (MaxAuthResponse & { code?: string; message?: string }) | null;
      if (!response.ok) {
        const code = payload?.code;
        if (code === 'MAX_ACCOUNT_NOT_LINKED') {
          setError('Этот аккаунт MAX ещё не связан с НаПаре. Войдите по email и паролю, затем откройте Настройки → Подключения аккаунта, чтобы связать его.');
          return;
        }
        if (code === 'MAX_INVALID_INIT_DATA') {
          setError(MAX_RELAUNCH_MESSAGE);
          return;
        }
        setRetryAvailable(true);
        setError(payload?.message || `Не удалось войти через MAX (${response.status}).`);
        return;
      }

      if (!payload?.accessToken || !payload.refreshToken || !payload.user?.role) {
        setRetryAvailable(true);
        setError('Сервер вернул неполный ответ авторизации.');
        return;
      }
      const workspace = workspaceForRole(payload.user.role);
      if (!workspace) {
        setError('Для этой роли пока не настроен кабинет.');
        return;
      }
      window.localStorage.setItem('accessToken', payload.accessToken);
      window.localStorage.setItem('refreshToken', payload.refreshToken);
      window.location.assign(destinations[workspace]);
    } catch (reason) {
      setRetryAvailable(true);
      setError(reason instanceof Error ? reason.message : 'Не удалось войти через MAX.');
    } finally {
      setBusy(false);
    }
  }

  if (captureOnly) return null;

  return (
    <section className="max-login-choice" aria-labelledby="max-login-title">
      <p className="eyebrow">Быстрый вход</p>
      <h2 id="max-login-title">Войти через MAX</h2>
      <p>Если ваш аккаунт уже связан с MAX, вы сразу попадёте в свой кабинет.</p>
      <button type="button" onClick={() => void signInWithMax()} disabled={busy}>
        {busy ? 'Проверяем MAX…' : 'Продолжить через MAX'}
      </button>
      {error && <p className="max-login-error" role="alert">{error}</p>}
      {retryAvailable && launchData && <button className="max-login-retry" type="button" onClick={() => void signInWithMax(launchData)} disabled={busy}>Повторить вход через MAX</button>}
    </section>
  );
}
