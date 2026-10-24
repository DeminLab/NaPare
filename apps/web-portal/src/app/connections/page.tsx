'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MaxLaunchAuth } from '../../components/MaxLaunchAuth';

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
  const statusRequestId = useRef(0);
  const linking = useRef(false);
  const handleMaxLaunchCapture = useCallback(() => setInsideMax(true), []);
  useEffect(() => { setInsideMax(Boolean(window.WebApp?.initData || window.__naparePendingMaxInitData)); }, []);

  useEffect(() => {
    let active = true;
    const refreshMaxStatus = async (requestId: number) => {
      const isCurrent = () => active && requestId === statusRequestId.current && !linking.current;
      try {
        let accessToken = window.localStorage.getItem('accessToken');
        if (!accessToken) {
          if (isCurrent()) {
            setSignedIn(false);
            setMaxKnown(false);
            setMaxLinked(false);
          }
          return;
        }
        setSignedIn(true);
        let response = await fetch('/api/v1/auth/max/status', { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!isCurrent()) return;
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
          if (!isCurrent()) return;
          accessToken = tokens.accessToken;
          window.localStorage.setItem('accessToken', tokens.accessToken);
          window.localStorage.setItem('refreshToken', tokens.refreshToken);
          response = await fetch('/api/v1/auth/max/status', { headers: { Authorization: `Bearer ${accessToken}` } });
        }
        if (response.ok) {
          const payload = await response.json() as { linked?: boolean };
          if (!isCurrent()) return;
          setMaxLinked(payload.linked === true);
          setMaxKnown(true);
        }
      } catch {
        // Leave the connection controls available while the API is offline.
      }
    };
    const refresh = () => {
      if (linking.current) return;
      const requestId = ++statusRequestId.current;
      setChecking(true);
      void refreshMaxStatus(requestId).finally(() => {
        if (active && requestId === statusRequestId.current && !linking.current) setChecking(false);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      statusRequestId.current += 1;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  async function linkMaxAccount() {
    if (linking.current) return;
    linking.current = true;
    statusRequestId.current += 1;
    setChecking(false);
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
      setMaxKnown(true);
      setMaxLinked(true);
    } catch {
      setMaxError('Нет связи с сервером. Попробуйте ещё раз.');
    } finally {
      linking.current = false;
      setMaxBusy(false);
    }
  }

  return (
    <>
    <MaxLaunchAuth captureOnly onCapture={handleMaxLaunchCapture} />
    <div className="connections-shell">
      <header className="connections-topbar"><Link href="/" className="connections-brand"><span aria-hidden="true">Н</span>НаПаре</Link><button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')} className="connections-return">← Вернуться в кабинет</button></header>
      <main className="connections-page">
        <section className="connections-story">
          <p className="connections-kicker"><span aria-hidden="true">✧</span> Одна платформа — вся учёба</p>
          <h1>НаПаре —<br /><span>в вашем MAX</span></h1>
          <p className="connections-lead">Подключите аккаунт к MAX, чтобы пользоваться учебными сервисами там, где вам удобно.</p>
          <div className="connections-benefits"><span>✦ Единый аккаунт</span><span>◇ Учебные сервисы</span><span>✓ Защищённая привязка</span></div>
        </section>
        <section className="connections-card" aria-labelledby="connections-title">
          <div className="connections-card-heading"><span className="connections-max-mark" aria-hidden="true" /><span className={`connections-status ${maxLinked ? 'is-linked' : ''}`}>{checking ? 'Проверяем…' : !signedIn ? 'Нужен вход' : !maxKnown ? 'Статус неизвестен' : maxLinked ? 'Подключён' : 'Не подключён'}</span></div>
          <h2 id="connections-title">Подключить MAX</h2>
          <p>{maxLinked ? 'Аккаунт НаПаре подключён. Теперь вы можете входить через MAX.' : insideMax ? 'Свяжите MAX с аккаунтом НаПаре. Подтверждение произойдёт здесь, внутри приложения.' : 'Свяжите MAX с аккаунтом НаПаре. Для безопасности подключение подтверждается внутри приложения.'}</p>
          {!maxLinked && <ol className="connections-steps"><li><span>1</span><span>Откройте приложение <strong>MAX</strong> на телефоне или компьютере.</span></li><li><span>2</span><span>Запустите <strong>НаПаре</strong> внутри MAX и подтвердите подключение.</span></li><li><span>3</span><span>Вернитесь сюда и проверьте статус соединения.</span></li></ol>}
          {checking && <p role="status" className="connections-note">Проверяем подключение аккаунта…</p>}
          {!checking && !signedIn && <div className="connections-note"><p>Чтобы управлять подключениями, войдите в аккаунт, выданный университетом.</p><Link href="/login" className="connections-button">Войти в НаПаре</Link></div>}
          {maxLinked ? <span className="connections-success" role="status">Аккаунт подключён</span> : <button type="button" onClick={() => void linkMaxAccount()} disabled={maxBusy || checking || !signedIn || !insideMax} className="connections-button">{maxBusy ? 'Связываем…' : 'Связать MAX　→'}</button>}
          {maxError && <p className="connections-error" role="alert">{maxError}</p>}
          <button type="button" className="connections-refresh" onClick={() => window.location.reload()}>◌　Обновить статус</button>
          <p><Link href="/notifications/setup">Настроить уведомления этого браузера</Link></p>
          <p className="connections-secure">♢　Подключение выполняется в безопасном режиме</p>
        </section>
      </main>
      <footer className="connections-footer">© 2026 НаПаре · Образовательная система</footer>
    </div>
    </>
  );
}
