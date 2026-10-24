'use client';

import { FormEvent, useState } from 'react';
import type { DeletionPreview } from './types';
import styles from './account-data.module.css';

export default function AccountDeletionForm({ preview, busy, onSubmit }: {
  preview: DeletionPreview; busy: boolean; onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [retention, setRetention] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (confirmed && retention && !busy && !preview.blockers.length) await onSubmit(password);
  }
  return <section className={styles.section} aria-labelledby="account-delete-title">
    <h2 id="account-delete-title">Удалить аккаунт</h2>
    <p>Вход будет закрыт во всех сессиях. Восстановить этот аккаунт после подтверждения нельзя.</p>
    <h3>Что будет очищено</h3>
    <ul>{preview.removed.map(item => <li key={item}>{item}</li>)}</ul>
    <h3>Что сохранится</h3>
    <ul id="account-retention">{preview.retained.map(item => <li key={item}>{item}</li>)}</ul>
    <p>Копии на других устройствах не удаляются автоматически. Расписание и подписка уведомлений в этом браузере будут очищены после подтверждения сервера.</p>
    {preview.blockers.length > 0 ? <div className={styles.notice}>
      <h3>Сначала передайте обязанности</h3>
      <ul>{preview.blockers.map(item => <li key={item.code}>{item.message}</li>)}</ul>
      <p>После передачи обновите сведения на этой странице.</p>
    </div> : <form onSubmit={submit} className={styles.form}>
      <label htmlFor="delete-current-password">Текущий пароль для подтверждения</label>
      <input id="delete-current-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={busy} />
        <span>Подтверждаю удаление именно этого аккаунта и закрытие доступа.</span></label>
      <label className={styles.check}><input type="checkbox" checked={retention} onChange={event => setRetention(event.target.checked)} required disabled={busy} aria-describedby="account-retention" />
        <span>Я прочитал перечень выше и понимаю, что учебная история под кодом, платёжные и другие перечисленные записи сохранятся.</span></label>
      <button className={styles.danger} type="submit" disabled={busy || !confirmed || !retention || !password}>{busy ? 'Обрабатываем…' : 'Удалить мой аккаунт'}</button>
    </form>}
  </section>;
}
