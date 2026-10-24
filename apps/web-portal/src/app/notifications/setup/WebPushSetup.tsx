'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AccountSignIn from '../../privacy/account/AccountSignIn';
import { AccountApiError, accountApi, currentSession, signIn, type Session } from '../../privacy/account/api';
import type { Account } from '../../privacy/account/types';
import styles from '../../privacy/account/account-data.module.css';
import pushStyles from './push-setup.module.css';
import { endpointHash, ownRegistration, publicKey, registerWorker, supportsPush } from './browser-push';

type Configuration = { accountId: string; available: boolean; deliveryEnabled: boolean; publicKey: string | null; consentVersion: string; registeredEndpoints: string[] };
type Details = { account: Account; configuration: Configuration; session: Session };
const errorText = (cause: unknown, fallback: string) => cause instanceof TypeError && /fetch|network|load failed/i.test(cause.message)
  ? 'Не удалось связаться с сервером. Проверьте соединение и повторите действие.' : cause instanceof Error ? cause.message : fallback;
export default function WebPushSetup() {
  const [details, setDetails] = useState<Details | null>(null), [guest, setGuest] = useState(false), [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(true), [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false), [linked, setLinked] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [sessionChanged, setSessionChanged] = useState(false);
  const pending = useRef<AbortController | null>(null), acting = useRef(false), identityGeneration = useRef(0);
  const load = useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const session = currentSession(), supported = supportsPush();
    setSupported(supported); setPermission(supported ? Notification.permission : 'default'); setGuest(!session); setBusy(!!session); setDetails(null); setLinked(false); setSubscribed(false); setError(''); setNotice(''); setConfirmed(false);
    if (!session) return;
    try {
      const [account, configuration, registration] = await Promise.all([
        accountApi<Account>('/users/me', session, controller.signal), accountApi<Configuration>('/devices/webpush', session, controller.signal), supported ? ownRegistration() : null,
      ]);
      if (account.id !== configuration.accountId) throw new Error('Не удалось подтвердить аккаунт. Обновите страницу.');
      const subscription = await registration?.pushManager.getSubscription();
      const hash = subscription ? await endpointHash(subscription) : null; controller.signal.throwIfAborted();
      const existingKey = subscription?.options.applicationServerKey;
      const matchesKey = !!existingKey && !!configuration.publicKey && Array.from(new Uint8Array(existingKey)).join(',') === Array.from(new Uint8Array(publicKey(configuration.publicKey))).join(',');
      setDetails({ account, configuration, session }); setSubscribed(!!subscription); setLinked(!!hash && matchesKey && configuration.registeredEndpoints.includes(hash));
    } catch (cause) { if (!controller.signal.aborted) { setError(errorText(cause, 'Не удалось проверить уведомления.')); if (cause instanceof AccountApiError && cause.status === 401) setGuest(true); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, []);
  useEffect(() => { void load(); return () => { identityGeneration.current++; pending.current?.abort(); }; }, [load]);
  useEffect(() => {
    const clear = (event: StorageEvent) => {
      if (event.key === null || ['accessToken','refreshToken'].includes(event.key)) {
        identityGeneration.current++; pending.current?.abort(); setSessionChanged(true); setDetails(null); setGuest(false); setBusy(false); setConfirmed(false); setLinked(false); setSubscribed(false);
        setNotice(''); setError('Аккаунт изменился. Обновите страницу перед настройкой уведомлений.');
      }
    };
    window.addEventListener('storage', clear); return () => window.removeEventListener('storage', clear);
  }, []);
  async function login(email: string, password: string) {
    if (acting.current) return; acting.current = true; setBusy(true); setError('');
    const controller = new AbortController(); pending.current = controller;
    try { await signIn(email, password, controller.signal); await load(); }
    catch (cause) { if (!controller.signal.aborted) { setError(errorText(cause, 'Не удалось войти.')); setBusy(false); } }
    finally { acting.current = false; }
  }
  async function enable() {
    if (!details || !confirmed || !supported || !details.configuration.publicKey || acting.current || sessionChanged) return;
    acting.current = true; setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); pending.current = controller;
    const generation = identityGeneration.current;
    let created: PushSubscription | null = null, saved = false;
    try {
      // Permission is requested directly in the user's click handler, before network/worker awaits.
      const permission = await Notification.requestPermission(); controller.signal.throwIfAborted(); setPermission(permission);
      if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Браузер запретил уведомления. Измените разрешение в настройках сайта, если хотите подключить их.' : 'Разрешение не выдано. Подписка не подключена.');
      const registration = await registerWorker(controller.signal); controller.signal.throwIfAborted();
      let subscription = await registration.pushManager.getSubscription();
      const key = publicKey(details.configuration.publicKey);
      if (subscription) {
        const existing = subscription.options.applicationServerKey;
        if (!existing || Array.from(new Uint8Array(existing)).join(',') !== Array.from(new Uint8Array(key)).join(',')) throw new Error('Ключ подписки изменился. Сначала отключите прежнюю подписку браузера.');
      } else { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); created = subscription; }
      controller.signal.throwIfAborted();
      const result = await accountApi<{ registered: boolean }>('/devices/webpush', details.session, controller.signal, { method: 'POST', body: JSON.stringify({ token: JSON.stringify(subscription.toJSON()), confirmed: true, version: details.configuration.consentVersion }) });
      if (!result.registered) throw new Error('Сервер не подтвердил подключение.'); saved = true;
      await load(); if (generation === identityGeneration.current) setNotice(details.configuration.deliveryEnabled ? 'Подписка браузера подключена. Фактическая доставка зависит от браузера и сервиса уведомлений.' : 'Подписка сохранена. Отправка уведомлений пока выключена администратором.');
    } catch (cause) {
      if (created && !saved) await created.unsubscribe().catch(() => false);
      if (!controller.signal.aborted) setError(errorText(cause, 'Не удалось подключить уведомления.'));
    } finally { acting.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  async function disable() {
    if (!details || !supported || acting.current || sessionChanged) return;
    acting.current = true; setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); pending.current = controller;
    const generation = identityGeneration.current;
    try {
      const subscription = await (await ownRegistration())?.pushManager.getSubscription(); controller.signal.throwIfAborted();
      if (!subscription) { await load(); if (generation === identityGeneration.current) setNotice('У этого браузера нет подписки.'); return; }
      let serverError = '';
      try { await accountApi('/devices/webpush', details.session, controller.signal, { method: 'DELETE', body: JSON.stringify({ token: JSON.stringify(subscription.toJSON()) }) }); }
      catch (cause) { serverError = errorText(cause, 'Сервер не подтвердил отключение.'); }
      controller.signal.throwIfAborted();
      if (!await subscription.unsubscribe()) throw new Error('Браузер не подтвердил удаление подписки. Проверьте разрешение сайта и повторите действие.');
      await load(); if (generation === identityGeneration.current) setNotice(serverError ? 'Подписка браузера отключена. Удаление связи на сервере не подтверждено; при необходимости повторите проверку после восстановления сети.' : 'Подписка браузера отключена, разрешение на сервере отозвано.');
    } catch (cause) { if (!controller.signal.aborted) setError(errorText(cause, 'Не удалось отключить уведомления.')); }
    finally { acting.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  return <>
    {busy && <p role="status">Проверяем настройки…</p>}
    {error && <div role="alert" className={styles.error}><p>{error}</p><button type="button" disabled={busy} onClick={() => sessionChanged ? window.location.reload() : void load()}>Повторить проверку</button></div>}
    {notice && <p role="status" className={styles.status}>{notice}</p>}
    {guest && <AccountSignIn busy={busy} onSubmit={login} submitLabel="Войти и настроить уведомления" />}
    {details && <section className={styles.section} aria-labelledby="push-account-title"><h2 id="push-account-title">Настройки этого браузера</h2>
      <div className={styles.identity}><p>{details.account.lastName} {details.account.firstName}</p><p>{details.account.email}</p></div>
      {!supported ? <p className={styles.notice}>Этот браузер не поддерживает WebPush в текущем режиме. Попробуйте поддерживаемый браузер или установленную PWA. HTTPS обязателен, кроме локальной разработки.</p> : <>
        <p>Разрешение браузера: {permission === 'granted' ? 'выдано' : permission === 'denied' ? 'запрещено' : 'ещё не запрошено'}. Подписка: {linked ? 'связана с этим аккаунтом' : subscribed ? 'есть в браузере, связь с этим аккаунтом не подтверждена' : 'не создана'}.</p>
        {!details.configuration.available && <p className={styles.notice}>Администратор ещё не настроил WebPush. Запрос разрешения и подключение недоступны.</p>}
        {details.configuration.available && !details.configuration.deliveryEnabled && <p className={styles.notice}>Подписку можно подготовить, но отправка сейчас выключена администратором.</p>}
        <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy || !details.configuration.available || sessionChanged} onChange={event => setConfirmed(event.target.checked)} /><span>Разрешаю НаПаре показывать нейтральные уведомления в этом браузере. Условия обновлений и тихие часы задаются в кабинете. Отключить подписку можно здесь.</span></label>
        <div className={pushStyles.actions}><button type="button" disabled={busy || !confirmed || !details.configuration.available || permission === 'denied' || sessionChanged} onClick={() => void enable()}>{linked ? 'Обновить разрешение и подписку' : 'Подключить уведомления браузера'}</button>
        {subscribed && <button type="button" disabled={busy || sessionChanged} onClick={() => void disable()}>Отключить подписку браузера</button>}</div>
        <p>Выход из аккаунта с подтверждением сервера отзывает его WebPush-подписки. При выходе без сети отключите подписку вручную на общем устройстве. На экране блокировки показывается только нейтральное сообщение.</p>
      </>}
      <button className={styles.secondary} type="button" disabled={busy || sessionChanged} onClick={() => void load()}>Обновить состояние</button>
    </section>}
  </>;
}
