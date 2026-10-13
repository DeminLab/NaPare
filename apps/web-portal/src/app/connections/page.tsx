'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type LinkResponse = { botLink?: string; expiresAt?: string; message?: string };
type AuthResponse = { accessToken?: string; refreshToken?: string; message?: string; code?: string };

declare global {
  interface Window {
    WebApp?: { initData?: string };
    __naparePendingMaxInitData?: string;
  }
}

export default function ConnectionsPage() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [botLink, setBotLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxKnown, setMaxKnown] = useState(false);
  const [telegramKnown, setTelegramKnown] = useState(false);
  const [linked, setLinked] = useState(false);
  const [maxLinked, setMaxLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [maxBusy, setMaxBusy] = useState(false);
  const [error, setError] = useState('');
  const [maxError, setMaxError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [insideMax, setInsideMax] = useState(false);
  useEffect(() => { setInsideMax(Boolean(window.WebApp?.initData || window.__naparePendingMaxInitData)); }, []);
  useEffect(() => { if (!botLink) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [botLink]);
  const remainingSeconds = expiresAt && Number.isFinite(Date.parse(expiresAt)) ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)) : 0;


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
    const refreshStatus = async () => {
      const accessToken = window.localStorage.getItem('accessToken');
      if (!accessToken) return;
      try {
        const response = await fetch('/api/v1/auth/telegram/status', { headers: { Authorization: `Bearer ${accessToken}` } });
        if (response.ok) {
          const payload = await response.json() as { linked?: boolean };
          setLinked(payload.linked === true);
          setTelegramKnown(true);
          if (payload.linked) setBotLink('');
        }
      } catch {
        // Keep the page usable if status refresh is temporarily offline.
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshStatus(); };
    const onWindowFocus = () => { void refreshMaxStatus(); };
    void refreshMaxStatus().finally(() => { void refreshStatus().finally(() => setChecking(false)); });
    window.addEventListener('focus', onVisible);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
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

  async function createTelegramLink() {
    setBusy(true);
    setError('');
    setBotLink('');
    try {
      const accessToken = window.localStorage.getItem('accessToken');
      if (!accessToken) {
        setError('Сначала войдите в НаПаре по аккаунту, выданному университетом.');
        return;
      }
      const response = await fetch('/api/v1/auth/telegram/link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => null) as LinkResponse | null;
      if (!response.ok || !payload?.botLink || !payload.expiresAt) {
        setError(payload?.message || 'Не удалось создать ссылку. Проверьте вход и настройки Telegram-бота.');
        return;
      }
      setBotLink(payload.botLink);
      setExpiresAt(payload.expiresAt); setNow(Date.now());
    } catch {
      setError('Нет связи с сервером. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="connections-page">
      <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')} className="connections-back">← Назад в кабинет</button>
      <header className="connections-heading"><p className="connections-kicker">Подключения аккаунта</p><h1>MAX и Telegram</h1><p>Подключите удобный способ входа и канал для уведомлений к своему аккаунту НаПаре.</p></header>
      {checking ? <p role="status" className="connections-note">Проверяем подключения…</p> : !signedIn ? <div className="connections-note"><p>Чтобы управлять подключениями, войдите в аккаунт, выданный университетом.</p><Link href="/login" className="connections-button">Войти в НаПаре</Link></div> : null}
      <div className="connections-grid">
        <section className="connections-card"><div className="connections-card-heading"><h2>MAX · быстрый вход</h2><span>{checking ? "Проверяем…" : !signedIn ? "Нужен вход" : !maxKnown ? "Статус неизвестен" : maxLinked ? "Подключён" : "Не подключён"}</span></div><p>Вход в ваш кабинет из мини-приложения MAX.</p><p>{maxLinked ? "Подключение завершено. При следующем открытии внутри MAX используйте вход через MAX." : insideMax ? "Вы открыли страницу внутри MAX. Теперь можно связать его с вашим аккаунтом." : "Откройте НаПаре внутри MAX и войдите по университетскому аккаунту. Затем вернитесь к подключениям."}</p>{maxLinked ? <p className="connections-success" role="status">MAX связан с этим аккаунтом.</p> : <button type="button" onClick={() => void linkMaxAccount()} disabled={maxBusy || checking || !signedIn || !insideMax} className="connections-button">{maxBusy ? 'Связываем…' : 'Связать MAX'}</button>}{maxError && <p className="connections-error" role="alert">{maxError}</p>}</section>
        <section className="connections-card"><div className="connections-card-heading"><h2>Telegram · уведомления</h2><span>{checking ? "Проверяем…" : !signedIn ? "Нужен вход" : !telegramKnown ? "Статус неизвестен" : linked ? "Подключён" : "Не подключён"}</span></div><p>Уведомления об изменениях расписания и важных событиях.</p><p>{linked ? "Подключение завершено. Категории событий выберите в настройках кабинета." : botLink && remainingSeconds > 0 ? "Ссылка создана. Откройте бота и нажмите «Начать», затем вернитесь сюда." : "Создайте временную ссылку для подключения своего Telegram."}</p>{linked ? <p className="connections-success" role="status">Telegram связан с этим аккаунтом.</p> : (!botLink || remainingSeconds === 0) && <button type="button" onClick={() => void createTelegramLink()} disabled={busy || checking || !signedIn} className="connections-button">{busy ? 'Создаём ссылку…' : botLink ? 'Создать новую ссылку' : 'Создать ссылку Telegram'}</button>}{error && <p className="connections-error" role="alert">{error}</p>}{botLink && remainingSeconds > 0 && <div className="connections-success" role="status"><p aria-live="off">Ожидаем подключения. Ссылка действует ещё {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}.</p><a href={botLink} target="_blank" rel="noopener noreferrer" className="connections-button">Открыть бота ↗</a></div>}</section>
      </div><button type="button" className="connections-back" onClick={() => window.location.reload()}>Проверить статус подключений</button><p className="connections-footer">Пароль НаПаре не передаётся ботам. Каналы и типы уведомлений можно выбрать в настройках своего кабинета.</p>
    </main>
  );
}
