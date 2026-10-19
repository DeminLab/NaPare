'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="mb-7">
            <p className="mb-2 text-sm font-semibold text-[var(--color-brand)]">Кабинет преподавателя</p>
            <h1 className="ds-page-title">Вход в НаПаре</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">Войдите, чтобы открыть расписание, занятия и группы.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p role="alert" aria-live="assertive" className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Электронная почта</label>
              <input
                id="email" name="email" type="email" autoComplete="username" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@university.ru"
                className="ds-input block min-h-11 w-full px-3 py-2.5 text-base placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-role)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Пароль</label>
              <input
                id="password" name="password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ds-input block min-h-11 w-full px-3 py-2.5 text-base focus:border-[var(--color-role)] focus:outline-none"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="min-h-11 w-full rounded-[var(--radius-md)] bg-[var(--color-role)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg aria-hidden="true" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
                  </svg>
                  Входим…
                </span>
              ) : 'Войти'}
            </button>
          </form>
        </section>
        <p className="mt-5 text-center text-xs text-[var(--color-text-muted)]">НаПаре · для преподавателей и сотрудников</p>
      </div>
    </main>
  );
}
