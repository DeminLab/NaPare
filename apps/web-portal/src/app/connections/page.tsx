'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AuthResponse = { accessToken?: string; refreshToken?: string; message?: string; code?: string };

declare global {
  interface Window {
    WebApp?: { initData?: string };
    __naparePendingMaxInitData?: string;
  }
}

export default function ConnectionsPage() {
  const [maxKnown, setMaxKnown] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [maxLinked, setMaxLinked] = useState(false);
  const [maxBusy, setMaxBusy] = useState(false);
  const [maxError, setMaxError] = useState('');
  const [insideMax, setInsideMax] = useState(false);
  useEffect(() => { setInsideMax(Boolean(window.WebApp?.initData || window.__naparePendingMaxInitData)); }, []);

  useEffect(() => {
    const refreshMaxStatus = async () => {
      try {
        let accessToken = window.localStorage.getItem('accessToken');
        if (!accessToken) return;
        setSignedIn(true);
        let response = await fetch('/api/v1/auth/max/status', { headers: { Authorization: `Bearer ${accessToken}` } });
        if (response.status === 401) {
          const refreshToken = window.localStorage.getItem('refreshToken');
          if (!refreshToken) return;
          const refreshed = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const tokens = await refreshed.json().catch(() => null) as AuthResponse | null;
          if (!refreshed.ok || !tokens?.accessToken || !tokens.refreshToken) return;
          accessToken = tokens.accessToken;
          window.localStorage.setItem('accessToken', tokens.accessToken);
          window.localStorage.setItem('refreshToken', tokens.refreshToken);
          response = await fetch('/api/v1/auth/max/status', { headers: { Authorization: `Bearer ${accessToken}` } });
        }
        if (response.ok) {
          const payload = await response.json() as { linked?: boolean };
          setMaxLinked(payload.linked === true);
          setMaxKnown(true);
        }
      } catch {
        // Leave the connection controls available while the API is offline.
      }
    };
    const refresh = () => { void refreshMaxStatus().finally(() => setChecking(false)); };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  async function linkMaxAccount() {
    setMaxBusy(true);
    setMaxError('');
    try {
      const initData = window.WebApp?.initData?.trim() || window.__naparePendingMaxInitData?.trim();
      if (!initData) {
        setMaxError('Откройте НаПаре внутри MAX и повторите привязку.');
        return;
      }
      const accessToken = window.localStorage.getItem('accessToken');
      if (!accessToken) {
        setMaxError('Сначала войдите в аккаунт НаПаре по email и паролю.');
        return;
      }
      let response = await fetch('/api/v1/auth/max/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ initData }),
      });
      let payload = await response.json().catch(() => null) as AuthResponse | null;
      if (response.status === 401 && payload?.code !== 'MAX_INVALID_INIT_DATA') {
        const refreshToken = window.localStorage.getItem('refreshToken');
        if (refreshToken) {
          const refreshed = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const tokens = await refreshed.json().catch(() => null) as AuthResponse | null;
          if (refreshed.ok && tokens?.accessToken && tokens.refreshToken) {
            window.localStorage.setItem('accessToken', tokens.accessToken);
            window.localStorage.setItem('refreshToken', tokens.refreshToken);
            response = await fetch('/api/v1/auth/max/link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
              body: JSON.stringify({ initData }),
            });
            payload = await response.json().catch(() => null) as AuthResponse | null;
          }
        }
      }
      if (!response.ok) {
        setMaxError(payload?.message || 'Не удалось связать MAX с этим аккаунтом. Проверьте, что MAX не привязан к другому аккаунту.');
        return;
      }
      if (payload?.accessToken && payload.refreshToken) {
        window.localStorage.setItem('accessToken', payload.accessToken);
        window.localStorage.setItem('refreshToken', payload.refreshToken);
      }
      setMaxLinked(true);
    } catch {
      setMaxError('Нет связи с сервером. Попробуйте ещё раз.');
    } finally {
      setMaxBusy(false);
    }
  }

  return (
    <main className="connections-page">
      <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')} className="connections-back">← Назад в кабинет</button>
      <header className="connections-heading"><p className="connections-kicker">Подключения аккаунта</p><h1>Вход через MAX</h1><p>Подключите MAX для быстрого входа в свой аккаунт НаПаре. Уведомления доступны на сайте.</p></header>
      {checking ? <p role="status" className="connections-note">Проверяем подключения…</p> : !signedIn ? <div className="connections-note"><p>Чтобы управлять подключениями, войдите в аккаунт, выданный университетом.</p><Link href="/login" className="connections-button">Войти в НаПаре</Link></div> : null}
      <div className="connections-grid">
        <section className="connections-card"><div className="connections-card-heading"><h2>MAX · быстрый вход</h2><span>{checking ? "Проверяем…" : !signedIn ? "Нужен вход" : !maxKnown ? "Статус неизвестен" : maxLinked ? "Подключён" : "Не подключён"}</span></div><p>Вход в ваш кабинет из мини-приложения MAX.</p><p>{maxLinked ? "Подключение завершено. При следующем открытии внутри MAX используйте вход через MAX." : insideMax ? "Вы открыли страницу внутри MAX. Теперь можно связать его с вашим аккаунтом." : "Откройте НаПаре внутри MAX и войдите по университетскому аккаунту. Затем вернитесь к подключениям."}</p>{maxLinked ? <p className="connections-success" role="status">MAX связан с этим аккаунтом.</p> : <button type="button" onClick={() => void linkMaxAccount()} disabled={maxBusy || checking || !signedIn || !insideMax} className="connections-button">{maxBusy ? 'Связываем…' : 'Связать MAX'}</button>}{maxError && <p className="connections-error" role="alert">{maxError}</p>}</section>
      </div><button type="button" className="connections-back" onClick={() => window.location.reload()}>Проверить статус подключений</button><p className="connections-footer">Подключение MAX выполняется после входа в свой аккаунт NaPare.</p>
    </main>
  );
}
