'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type LinkResponse = { botLink?: string; expiresAt?: string; message?: string };

export default function ConnectionsPage() {
  const [botLink, setBotLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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
    void refreshStatus();
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

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
      <Link href="/" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← НаПаре</Link>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">Подключения аккаунта</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Связать Telegram</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Войдите в НаПаре и создайте временную ссылку. Откройте её в личном чате официального бота — пароль боту не передаётся.
          MAX связывается отдельно при запуске сайта внутри MAX.
        </p>
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
      </section>
    </main>
  );
}
