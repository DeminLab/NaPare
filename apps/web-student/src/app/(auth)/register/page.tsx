'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', universityId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError('Пароли не совпадают'); return; }
    setLoading(true);
    setError('');
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        universityId: form.universityId,
      });
      router.push('/today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-white to-purple-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 text-sm font-bold text-white">НП</div>
            <h1 className="text-2xl font-bold text-slate-900">Регистрация</h1>
            <p className="mt-2 text-sm text-slate-400">Создайте аккаунт студента</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Имя</label>
                <input type="text" required value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Алексей"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Фамилия</label>
                <input type="text" required value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Иванов"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="student@university.ru"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">ID университета</label>
              <input type="text" required value={form.universityId} onChange={e => update('universityId', e.target.value)} placeholder="UUID университета"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Пароль</label>
              <input type="password" required value={form.password} onChange={e => update('password', e.target.value)} placeholder="Минимум 6 символов"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Повторите пароль</label>
              <input type="password" required value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="Ещё раз"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:from-sky-600 hover:to-sky-700 hover:shadow-xl disabled:opacity-50">
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-700">Войти</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">&copy; 2026 НаПаре</p>
      </div>
    </div>
  );
}
