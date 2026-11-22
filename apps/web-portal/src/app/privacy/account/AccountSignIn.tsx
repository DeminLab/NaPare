'use client';

import { FormEvent, useState } from 'react';
import styles from './account-data.module.css';

export default function AccountSignIn({ busy, onSubmit, submitLabel = 'Войти и посмотреть данные' }: { busy: boolean; onSubmit: (username: string, password: string) => Promise<void>; submitLabel?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(username.trim(), password);
  }
  return <section className={styles.section} aria-labelledby="account-login-title">
    <h2 id="account-login-title">Войдите в свой аккаунт</h2>
    <p>Сведения и действия доступны только владельцу аккаунта.</p>
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="account-username">Логин</label>
      <input id="account-username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={event => setUsername(event.target.value)} disabled={busy} />
      <label htmlFor="account-password">Пароль</label>
      <input id="account-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <button type="submit" disabled={busy}>{busy ? 'Входим…' : submitLabel}</button>
    </form>
  </section>;
}
