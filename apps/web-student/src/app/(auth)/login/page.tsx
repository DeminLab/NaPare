'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';

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
      await login(email, password);
      router.push('/today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-indigo-700 p-10 text-white lg:flex">
          <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-bold text-indigo-700">Н</div><p className="mt-8 text-sm font-medium text-indigo-200">Университетская платформа</p><h2 className="mt-3 text-3xl font-bold leading-tight">Учебный день<br />в одном месте.</h2><p className="mt-4 max-w-xs text-sm leading-relaxed text-indigo-100">Расписание, пропуски и уведомления — спокойно и понятно.</p></div>
          <div className="space-y-3 text-sm text-indigo-100"><p>Расписание на каждый день</p><p>Актуальные изменения</p><p>Пространство пары</p></div>
        </div>
        <div className="p-8 sm:p-12">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white lg:hidden">Н</div>
            <h1 className="text-2xl font-bold text-slate-900">Вход в НаПаре</h1>
            <p className="mt-2 text-sm text-slate-400">Войдите, чтобы увидеть своё расписание</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.ru"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Пароль</label>
              <input
                id="password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:shadow-xl disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Вход...
                </span>
              ) : 'Войти'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 text-sm text-slate-500">
            <span>Забыли пароль?</span>
            <span>
            Нет аккаунта?{' '}
            <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">Зарегистрироваться</Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
