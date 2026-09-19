'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

type Workspace = 'student' | 'staff' | 'admin';
type LoginResponse = { accessToken: string; refreshToken: string; workspace: Workspace };

const destinations: Record<Workspace, string> = {
  student: '/student/today',
  staff: '/staff/today',
  admin: '/deanery/dashboard',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Не удалось выполнить вход');
      }

      const data = payload as LoginResponse;
      window.localStorage.setItem('accessToken', data.accessToken);
      window.localStorage.setItem('refreshToken', data.refreshToken);
      window.location.assign(destinations[data.workspace]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось выполнить вход');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-aside"><Link href="/" className="brand light"><span>Н</span>НаПаре</Link><div><p className="eyebrow">Единый вход</p><h1>Один аккаунт.<br />Свой кабинет.</h1><p>После входа НаПаре определит вашу роль и откроет нужное рабочее пространство.</p></div><small>Учётные данные выдаёт университет.</small></section>
      <section className="login-panel"><div className="login-card"><Link href="/" className="brand mobile-brand"><span>Н</span>НаПаре</Link><h2>С возвращением</h2><p className="muted">Введите логин и пароль, выданные университетом.</p><form onSubmit={submit} className="login-form" noValidate>{error && <p className="error" role="alert">{error}</p>}<label>Логин или email<input name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Пароль<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit" disabled={loading}>{loading ? 'Входим…' : 'Войти'}</button></form><p className="support">Нет учётных данных? Обратитесь в учебную часть или к администратору университета.</p></div></section>
    </main>
  );
}
