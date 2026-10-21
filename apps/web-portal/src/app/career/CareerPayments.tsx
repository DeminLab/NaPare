'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { careerApi } from './api';
import s from './career.module.css';

type Payment = { id: string; idempotencyKey: string; amountMinor: number; currency: string; state: string; confirmationUrl: string | null; createdAt: string };
type Offer = { available: boolean; reason?: string; label?: string; amountMinor?: number; currency?: string };
const labels: Record<string, string> = { created: 'Создан', pending: 'Ожидает оплаты', unknown: 'Нужна сверка с банком', succeeded: 'Оплачен', canceled: 'Отменён', partially_refunded: 'Частичный возврат', refunded: 'Возвращён' };
const money = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount / 100);

export function CareerPayments({ companies }: { companies: { id: string; name: string }[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id || '');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestId = useRef(0);
  const keys = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    const request = ++requestId.current;
    if (!companyId) return;
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ companyId });
      const [options, items] = await Promise.all([
        careerApi<Offer>(`/career/payments/options?${query}`),
        careerApi<Payment[]>(`/career/payments?${query}`),
      ]);
      if (request === requestId.current) {
        setOffer(options); setPayments(items);
        let activeKey = keys.current.get(companyId);
        try { activeKey ||= sessionStorage.getItem(`napare:career-payment:${companyId}`) || undefined; } catch { /* Optional persistence. */ }
        if (activeKey && items.some(item => item.idempotencyKey === activeKey && ['succeeded', 'canceled', 'partially_refunded', 'refunded'].includes(item.state))) {
          keys.current.delete(companyId);
          try { sessionStorage.removeItem(`napare:career-payment:${companyId}`); } catch { /* Optional persistence. */ }
        }
      }
    } catch (reason) { if (request === requestId.current) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить платежи'); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [companyId]);
  useEffect(() => { setOffer(null); setPayments([]); setMessage(''); void load(); return () => { requestId.current++; }; }, [load]);
  const refresh = async (payment: Payment) => {
    setBusy(payment.id); setError(''); setMessage('');
    try {
      const result = await careerApi<Payment>(`/career/payments/${payment.id}/refresh`, { method: 'POST' });
      setPayments(items => items.map(item => item.id === result.id ? result : item));
      setMessage(`Состояние подтверждено банком: ${labels[result.state] || result.state}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сверить платёж'); }
    finally { setBusy(''); }
  };
  const create = async () => {
    if (!offer?.available || !companyId) return;
    setBusy('create'); setError(''); setMessage('');
    const storageKey = `napare:career-payment:${companyId}`;
    let key = keys.current.get(companyId);
    try { key ||= sessionStorage.getItem(storageKey) || undefined; } catch { /* Session storage may be unavailable. */ }
    key ||= crypto.randomUUID();
    keys.current.set(companyId, key);
    try { sessionStorage.setItem(storageKey, key); } catch { /* The component still retains the key. */ }
    try {
      const payment = await careerApi<Payment>('/career/payments', { method: 'POST', body: JSON.stringify({ companyId, product: 'career_access', idempotencyKey: key }) });
      await load();
      if (payment.confirmationUrl && payment.state === 'pending') {
        const url = new URL(payment.confirmationUrl);
        if (url.protocol !== 'https:' || !['securepay.tinkoff.ru', 'rest-api-test.tinkoff.ru'].includes(url.hostname)) throw new Error('Ссылка оплаты не прошла проверку');
        window.location.assign(url.href);
      } else setMessage(payment.state === 'succeeded' ? 'Услуга оплачена.' : 'Новый платёж не создавался повторно. Проверьте состояние заказа или обратитесь к оператору.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось открыть оплату'); }
    finally { setBusy(''); }
  };
  if (!companies.length) return null;
  const unresolved = payments.some(payment => ['created', 'pending', 'unknown'].includes(payment.state));
  return <section className={`${s.card} ${s.section} ${s.payments}`} aria-labelledby="career-payment-heading" aria-busy={loading || !!busy}>
    <h2 id="career-payment-heading">Оплата услуг платформы</h2>
    <label className={s.field}>Компания
      <select value={companyId} onChange={event => setCompanyId(event.target.value)} disabled={!!busy}>
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select>
    </label>
    {loading && <p role="status">Загружаем стоимость и платежи…</p>}
    {error && <p className={s.error} role="alert">{error} <button className={s.button} onClick={() => void load()} disabled={loading || !!busy}>Повторить загрузку</button></p>}
    {message && <p className={s.success} role="status">{message}</p>}
    {!loading && offer && <div className={s.section}>
      {offer.available && offer.amountMinor !== undefined ? <>
        <p>{offer.label} · <strong>{money(offer.amountMinor)}</strong></p>
        <button className={`${s.button} ${s.primary}`} disabled={!!busy || unresolved} onClick={() => void create()}>{busy === 'create' ? 'Готовим оплату…' : 'Перейти к оплате в Т-Кассе'}</button>
        {unresolved && <p>Сначала завершите или сверьте существующий платёж.</p>}
      </> : <p>{offer.reason}</p>}
    </div>}
    {!loading && !payments.length && !error && <p className={s.empty}>Платежей этой компании пока нет.</p>}
    {!!payments.length && <><h3>Последние платежи</h3><ul className={s.paymentList}>
      {payments.map(payment => <li key={payment.id}>
        <div><strong>{money(payment.amountMinor)}</strong> · {labels[payment.state] || payment.state}<br /><span className={s.muted}>{new Date(payment.createdAt).toLocaleString('ru-RU')}</span></div>
        <div className={s.row}>
          {payment.confirmationUrl && payment.state === 'pending' && <a className={s.button} href={payment.confirmationUrl} rel="noreferrer">Продолжить оплату</a>}
          {!['refunded', 'canceled'].includes(payment.state) && <button className={s.button} disabled={!!busy} onClick={() => void refresh(payment)}>{busy === payment.id ? 'Сверяем…' : 'Проверить в банке'}</button>}
        </div>
      </li>)}
    </ul></>}
  </section>;
}
