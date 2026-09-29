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
  const [botLink, setBotLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [linked, setLinked] = useState(false);
  const [maxLinked, setMaxLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [maxBusy, setMaxBusy] = useState(false);
  const [error, setError] = useState('');
  const [maxError, setMaxError] = useState('');

  useEffect(() => {
    const refreshMaxStatus = async () => {
      try {
        let accessToken = window.localStorage.getItem('accessToken');
        if (!accessToken) return;
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
          if (payload.linked) setBotLink('');
        }
      } catch {
        // Keep the page usable if status refresh is temporarily offline.
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshStatus(); };
    const onWindowFocus = () => { void refreshMaxStatus(); };
    void refreshMaxStatus();
    void refreshStatus();
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
      setExpiresAt(payload.expiresAt);
    } catch {
      setError('Нет связи с сервером. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
      <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← Назад в кабинет</button>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">Подключения аккаунта</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Связи аккаунта</h1>
        <div className="mt-6 rounded-xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">MAX</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Свяжите MAX с текущим аккаунтом НаПаре, чтобы потом входить в этот кабинет одним нажатием.</p>
          {maxLinked ? <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">MAX уже связан с этим аккаунтом.</p> : <button type="button" onClick={() => void linkMaxAccount()} disabled={maxBusy} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">{maxBusy ? 'Связываем…' : 'Связать MAX с этим аккаунтом'}</button>}
          {maxError && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">{maxError}</p>}
          {!maxLinked && <p className="mt-3 text-xs leading-5 text-slate-500">Откройте эту страницу внутри MAX и войдите в НаПаре по университетскому email и паролю перед привязкой.</p>}
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <h2 className="text-lg font-semibold text-slate-900">Telegram</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Создайте временную ссылку и откройте её в личном чате официального бота. Пароль боту не передаётся.</p>
        {linked ? <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">Telegram уже связан с этим аккаунтом.</p> : <button type="button" onClick={() => void createTelegramLink()} disabled={busy} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">
          {busy ? 'Создаём ссылку…' : 'Создать ссылку Telegram'}
        </button>}
        {error && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">{error}{error.startsWith('Сначала войдите') && <> <Link className="font-semibold underline" href="/login">Войти</Link></>}</p>}
        {botLink && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
          <p className="text-sm font-semibold text-emerald-950">Ссылка готова и действует 10 минут.</p>
          <p className="mt-1 text-xs text-emerald-800">Истекает: {new Date(expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}. Создание новой ссылки сразу аннулирует предыдущую.</p>
          <a href={botLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100">Открыть Telegram-бота</a>
        </div>}
        <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Не пересылайте эту ссылку другим людям. Уже привязанный Telegram не заменяется автоматически; обратитесь к администратору НаПаре.</p>
        </div>
      </section>
    </main>
  );
}
