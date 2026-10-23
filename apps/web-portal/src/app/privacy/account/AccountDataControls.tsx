'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AccountSignIn from './AccountSignIn';
import AccountDeletionForm from './AccountDeletionForm';
import { AccountApiError, accountApi, clearAccountSession, currentSession, signIn, type Session } from './api';
import type { Account, DeletionPreview, DeletionReceipt } from './types';
import styles from './account-data.module.css';

type Details = { account: Account; preview: DeletionPreview; session: Session };
export default function AccountDataControls() {
  const [details, setDetails] = useState<Details | null>(null);
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (details || receipt) heading.current?.focus(); }, [details, receipt]);

  const load = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    const session = currentSession();
    setDetails(null); setError(''); setStatus(''); setGuest(!session); setBusy(!!session);
    if (!session) return;
    try {
      const [account, preview] = await Promise.all([
        accountApi<Account>('/users/me', session, next.signal),
        accountApi<DeletionPreview>('/users/me/deletion-preview', session, next.signal),
      ]);
      if (!account.id || account.id !== preview.accountId || preview.archiveModel !== 'pseudonymous' ||
        !Array.isArray(preview.removed) || !Array.isArray(preview.retained) || !Array.isArray(preview.blockers)) throw new Error('Не удалось подтвердить сведения аккаунта.');
      setDetails({ account, preview, session });
    } catch (failure) {
      if (next.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить сведения.');
      if (failure instanceof AccountApiError && failure.status === 401) setGuest(true);
    } finally { if (!next.signal.aborted) setBusy(false); }
  }, []);

  useEffect(() => {
    void load();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || ['accessToken', 'refreshToken'].includes(event.key)) {
        pending.current = false;
        setReceipt(null);
        void load();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { controller.current?.abort(); window.removeEventListener('storage', onStorage); };
  }, [load]);

  async function login(email: string, password: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const next = new AbortController(); controller.current = next;
    try { await signIn(email, password, next.signal); await load(); }
    catch (failure) { if (!next.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не удалось войти.'); }
    finally { pending.current = false; if (!next.signal.aborted) setBusy(false); }
  }

  async function download() {
    if (!details || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    const next = new AbortController(); controller.current = next;
    try {
      const data = await accountApi<{ format: string; version: number; complete: boolean; datasets: { users: Account[] } }>('/users/me/export', details.session, next.signal);
      if (data.format !== 'napare-personal-data' || data.version !== 1 || data.complete !== true ||
        data.datasets?.users?.length !== 1 || data.datasets.users[0].id !== details.account.id) throw new Error('Экспорт неполный или относится к другому аккаунту. Файл не подготовлен.');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `napare-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Файл подготовлен для скачивания. Проверьте загрузки браузера. Он содержит личные данные — храните его в безопасном месте.');
    } catch (failure) { if (!next.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не удалось скачать данные.'); }
    finally { pending.current = false; if (!next.signal.aborted) setBusy(false); }
  }

  async function erase(password: string) {
    if (!details || pending.current || details.preview.blockers.length) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    const next = new AbortController(); controller.current = next;
    try {
      const result = await accountApi<DeletionReceipt>('/users/me', details.session, next.signal, { method: 'DELETE',
        body: JSON.stringify({ expectedUserId: details.account.id, currentPassword: password, confirmed: true, acknowledgeRetention: true }) });
      if (result.success !== true || result.archiveCode !== details.account.id || !result.deletedAt || !Array.isArray(result.retained)) throw new Error('Сервер не подтвердил результат удаления.');
      setReceipt(result); setDetails(null);
      const cleared = await clearAccountSession(details.session);
      setStatus(cleared ? 'Сессия и локальный кэш расписания в этом браузере очищены.' : 'Удаление подтверждено, но очистку локального кэша проверить не удалось. Очистите данные сайта в настройках браузера.');
    } catch (failure) {
      if (!next.signal.aborted) setError(`${failure instanceof Error ? failure.message : 'Не удалось получить ответ сервера.'} Если связь прервалась, операция могла завершиться. Обновите сведения перед повторной попыткой.`);
    } finally { pending.current = false; if (!next.signal.aborted) setBusy(false); }
  }

  return <div aria-busy={busy}>
    <div role="status" aria-live="polite" className={styles.status}>{busy ? 'Обрабатываем запрос…' : status}</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {receipt ? <section className={styles.section}>
      <h2 ref={heading} tabIndex={-1}>Аккаунт удалён</h2>
      <p>Доступ закрыт. Учебная история сохраняется под кодом:</p>
      <p><strong>{receipt.archiveCode}</strong></p>
      <p>Время подтверждения: {new Date(receipt.deletedAt).toLocaleString('ru-RU')}.</p>
      <ul>{receipt.retained.map(item => <li key={item}>{item}</li>)}</ul>
    </section> : <>
      {guest && <AccountSignIn busy={busy} onSubmit={login} />}
      {details && <>
        <section className={styles.section}>
          <h2 ref={heading} tabIndex={-1}>Ваш аккаунт</h2>
          <div className={styles.identity}>
            <p><strong>{[details.account.firstName, details.account.lastName].filter(Boolean).join(' ') || 'Аккаунт НаПаре'}</strong></p>
            <p>{details.account.email}</p><p>Код аккаунта: {details.account.id}</p>
          </div>
        </section>
        <section className={styles.section} aria-labelledby="account-export-title">
          <h2 id="account-export-title">Скачать данные</h2>
          <p>JSON-файл включает собственные записи из доступных разделов. Данные внешних сервисов, файлы по ссылкам и резервные копии в него не входят. Ограничения перечислены внутри файла.</p>
          <button type="button" onClick={() => void download()} disabled={busy}>Скачать мои данные в JSON</button>
        </section>
        <AccountDeletionForm key={details.account.id} preview={details.preview} busy={busy} onSubmit={erase} />
      </>}
      {!guest && !details && !busy && !error && <p>Сведения аккаунта отсутствуют. Обновите их или войдите заново.</p>}
      {!busy && <button type="button" className={styles.secondary} onClick={() => void load()}>Обновить сведения</button>}
    </>}
  </div>;
}
