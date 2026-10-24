'use client';

import { FormEvent, useState } from 'react';
import styles from './account-data.module.css';

export default function AccountSignIn({ busy, onSubmit, submitLabel = 'Войти и посмотреть данные' }: { busy: boolean; onSubmit: (email: string, password: string) => Promise<void>; submitLabel?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(email, password);
  }
  return <section className={styles.section} aria-labelledby="account-login-title">
    <h2 id="account-login-title">Войдите в свой аккаунт</h2>
    <p>Сведения и действия доступны только владельцу аккаунта.</p>
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="account-email">Электронная почта</label>
      <input id="account-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      <label htmlFor="account-password">Пароль</label>
      <input id="account-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <button type="submit" disabled={busy}>{busy ? 'Входим…' : submitLabel}</button>
    </form>
  </section>;
}
