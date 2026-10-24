'use client';

import { FormEvent, useState } from 'react';
import styles from './career.module.css';

export type CompanyRegistryFields = {
  inn?: string | null; registryStatus?: string; registryCheckedAt?: string | null;
  registryRequestedAt?: string | null; registryLegalName?: string | null; registryOgrn?: string | null;
};
const statuses: Record<string, string> = {
  not_checked: 'Проверка ещё не проводилась', checking: 'Проверка начата', disabled: 'Автоматическая проверка пока недоступна',
  unavailable: 'Не удалось получить результат проверки', captcha_required: 'Для проверки ФНС требуется CAPTCHA',
  not_found: 'Запись с этим ИНН не найдена', ambiguous: 'Однозначное совпадение не найдено',
  matched: 'Найдено точное совпадение в реестре', inactive: 'В реестре указано прекращение деятельности или недействительность регистрации',
};
export function CompanyRegistryPanel({ company, owner, busy, onRecheck }: {
  company: CompanyRegistryFields; owner: boolean; busy: boolean; onRecheck: (inn?: string) => Promise<unknown>;
}) {
  const [inn, setInn] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); if (!busy) await onRecheck(company.inn ? undefined : inn.trim()); }
  return <section aria-label="Проверка компании по ИНН">
    <h3>Проверка по реестру ФНС</h3>
    <p><strong>{statuses[company.registryStatus || 'not_checked'] || 'Статус проверки неизвестен'}</strong></p>
    {company.inn && <p>ИНН: {company.inn}</p>}
    {company.registryLegalName && <p>Имя в реестре: {company.registryLegalName}</p>}
    {company.registryOgrn && <p>{company.inn?.length === 12 ? 'ОГРНИП' : 'ОГРН'}: {company.registryOgrn}</p>}
    {company.registryCheckedAt && <p>Последняя попытка: {new Date(company.registryCheckedAt).toLocaleString('ru-RU')}.</p>}
    <p>Совпадение в реестре не подтверждает принадлежность аккаунта компании. Решение о партнёрстве принимает карьерный центр отдельно.</p>
    <p><a href="https://egrul.nalog.ru/" target="_blank" rel="noopener noreferrer">Открыть публичный реестр ФНС</a></p>
    {owner && <form className={styles.form} onSubmit={submit}>
      {!company.inn && <label className={styles.field}>ИНН для первоначальной проверки
        <input value={inn} onChange={event => setInn(event.target.value)} inputMode="numeric" pattern="(?:[0-9]{10}|[0-9]{12})" maxLength={12} required disabled={busy} />
      </label>}
      <p>ИНН отправляется в сервис ФНС для поиска записи. Повторная проверка доступна через минуту. Закреплённый ИНН исправляет оператор.</p>
      <button className={styles.button} type="submit" disabled={busy}>{busy ? 'Обрабатываем…' : company.inn ? 'Проверить ИНН повторно' : 'Проверить и сохранить ИНН'}</button>
    </form>}
  </section>;
}
