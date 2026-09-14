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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-indigo-700 p-10 text-white lg:flex">
          <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-bold text-indigo-700">Н</div><p className="mt-8 text-sm font-medium text-indigo-200">Университетская платформа</p><h2 className="mt-3 text-3xl font-bold leading-tight">Начни с понятного<br />учебного дня.</h2><p className="mt-4 max-w-xs text-sm leading-relaxed text-indigo-100">Зарегистрируйся, чтобы собрать расписание и быть в курсе изменений.</p></div>
          <div className="space-y-3 text-sm text-indigo-100"><p>Личные уведомления</p><p>Пространство каждой пары</p><p>Контроль посещаемости</p></div>
        </div>
        <div className="p-8 sm:p-12">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white lg:hidden">Н</div>
            <h1 className="text-2xl font-bold text-slate-900">Создать аккаунт</h1>
            <p className="mt-2 text-sm text-slate-400">Заполните данные студента</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Имя</label>
                <input type="text" required value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Алексей"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Фамилия</label>
                <input type="text" required value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Иванов"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="student@university.ru"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Код университета</label>
              <input type="text" required value={form.universityId} onChange={e => update('universityId', e.target.value)} placeholder="Код из приглашения вуза" aria-describedby="university-code-help"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100" />
              <p id="university-code-help" className="mt-1.5 text-xs leading-5 text-slate-500">Его выдаёт университет или куратор. Если кода нет, обратитесь в учебную часть.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Пароль</label>
              <input type="password" required value={form.password} onChange={e => update('password', e.target.value)} placeholder="Минимум 6 символов"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Повторите пароль</label>
              <input type="password" required value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="Ещё раз"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:shadow-xl disabled:opacity-50">
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Войти</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
