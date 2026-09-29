'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { MaxLaunchAuth } from '../../components/MaxLaunchAuth';

type Workspace = 'student' | 'staff' | 'admin' | 'developer';
type LoginResponse = { accessToken: string; refreshToken: string; workspace: Workspace };

const destinations: Record<Workspace, string> = {
  student: '/student/today',
  staff: '/staff/today',
  admin: '/deanery/dashboard',
  developer: '/developer/api',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Введите email и пароль.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new Error('Неверный email или пароль. Используйте учётные данные, выданные университетом.');
        if (response.status === 403) throw new Error(payload?.message || 'Для этой роли пока не настроен доступ к кабинету.');
        throw new Error(payload?.message || `Не удалось выполнить вход (${response.status}).`);
      }

      const data = payload as LoginResponse;
      if (!data?.accessToken || !data.refreshToken || !data.workspace) throw new Error('Сервер вернул неполный ответ авторизации.');
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
      <section className="login-aside"><Link href="/" className="brand light"><Image src="/brand/np-mark.png" alt="" width={34} height={34} priority unoptimized />НаПаре</Link><div><p className="eyebrow">Единый вход</p><h1>Один аккаунт.<br />Свой кабинет.</h1><p>После входа НаПаре определит вашу роль и откроет нужное рабочее пространство.</p></div><small>Учётные данные выдаёт университет.</small></section>
      <section className="login-panel"><div className="login-card"><Link href="/" className="brand mobile-brand"><Image src="/brand/np-mark.png" alt="" width={34} height={34} priority unoptimized />НаПаре</Link><h2>С возвращением</h2>{showPasswordLogin ? <><p className="muted">Введите email и пароль, выданные университетом.</p><form onSubmit={submit} className="login-form" noValidate>{error && <p className="error" role="alert">{error}</p>}<label>Email<input name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Пароль<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit" disabled={loading}>{loading ? 'Входим…' : 'Войти'}</button></form><button className="login-method-back" type="button" onClick={() => { setError(''); setShowPasswordLogin(false); }}>← Выбрать другой способ входа</button></> : <><p className="muted">Выберите, как войти в аккаунт.</p><MaxLaunchAuth /><div className="login-method-divider"><span>или</span></div><button className="login-password-choice" type="button" onClick={() => setShowPasswordLogin(true)}>Войти по логину и паролю</button></>}<p className="support">Нет учётных данных? Обратитесь в учебную часть или к администратору университета.</p></div></section>
    </main>
  );
}
