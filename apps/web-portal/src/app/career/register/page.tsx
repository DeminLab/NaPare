"use client";

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import s from '../career.module.css';

const fields = [
  { name: 'firstName', label: 'Имя', type: 'text', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Фамилия', type: 'text', autoComplete: 'family-name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Пароль, не менее 10 символов', type: 'password', autoComplete: 'new-password' },
];

export default function EmployerRegistration() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/v1/career/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(Array.isArray(result.message) ? result.message.join('. ') : result.message);
      }

      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      window.location.assign('/career');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось зарегистрироваться');
      setBusy(false);
    }
  }

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <Link className={s.brand} href="/">НаПаре</Link>
        <section className={s.card} style={{ maxWidth: 560, margin: '40px auto' }}>
          <h1>Аккаунт работодателя</h1>
          <ol className={s.composerSteps}>
            <li aria-current="step"><span>1</span>Аккаунт</li>
            <li><span>2</span>Компания</li>
            <li><span>3</span>Проверка</li>
            <li><span>4</span>Задача</li>
          </ol>
          <p>После регистрации добавьте компанию и отправьте её на проверку карьерному центру вуза.</p>
          {error && <p role="alert" className={s.error}>{error}</p>}

          <form className={s.form} onSubmit={event => void submit(event)} aria-busy={busy}>
            {fields.map(field => (
              <div key={field.name} className={s.field}>
                <label htmlFor={`employer-${field.name}`}>{field.label}</label>
                {field.name === 'password' ? (
                  <div className={s.passwordField}>
                    <input
                      id={`employer-${field.name}`}
                      required
                      disabled={busy}
                      name={field.name}
                      type={passwordVisible ? 'text' : 'password'}
                      minLength={10}
                      maxLength={128}
                      autoComplete={field.autoComplete}
                    />
                    <button
                      type="button"
                      className={s.passwordToggle}
                      aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                      aria-pressed={passwordVisible}
                      disabled={busy}
                      onClick={() => setPasswordVisible(visible => !visible)}
                    >
                      {passwordVisible ? 'Скрыть' : 'Показать'}
                    </button>
                  </div>
                ) : (
                  <input
                    id={`employer-${field.name}`}
                    required
                    disabled={busy}
                    name={field.name}
                    type={field.type}
                    minLength={1}
                    maxLength={254}
                    autoComplete={field.autoComplete}
                  />
                )}
              </div>
            ))}
            <button disabled={busy} className={`${s.button} ${s.primary}`}>
              {busy ? 'Создаём аккаунт…' : 'Создать аккаунт'}
            </button>
          </form>
          <p>Уже есть аккаунт? <Link href="/login">Войти</Link></p>
        </section>
      </div>
    </main>
  );
}
