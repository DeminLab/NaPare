'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Неверные учетные данные');
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      router.push('/my-day');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8FC] px-4 py-10">
      <div className="w-full max-w-md space-y-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(17,27,52,0.06)] sm:p-8">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2.5 text-lg font-bold tracking-tight text-slate-950"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm text-white shadow-sm">Н</span>НаПаре</Link>
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Вход в НаПаре
        </h1>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              Электронная почта
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-indigo-600 bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </main>
  );
}
