'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { errorMessage, fieldClass, type Account } from './types';

export default function AdministratorStep({ organizationId, owner, users, reload }: { organizationId: string; owner: boolean; users: Account[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const admins = users.filter(user => user.role === 'university_admin' && user.isActive);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      await apiFetch(owner ? '/platform/accounts' : '/admin/users', { method: 'POST', body: JSON.stringify({ ...form, role: 'university_admin', ...(owner ? { organizationId } : {}) }) });
      setForm({ firstName: '', lastName: '', email: '', password: '' });
      setSuccess('Администратор создан. Пароль передайте ему защищённым способом; письмо автоматически не отправляется.');
      try { await reload(); }
      catch (cause) { setError(`Аккаунт создан, но список не обновился: ${errorMessage(cause)} Перечитайте данные перед повторной попыткой.`); }
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <Card><h2 className="text-xl font-bold text-slate-950">Первый администратор</h2>
    <p className="mt-2 text-sm text-slate-600">Действующих администраторов: {admins.length}. Учётная запись привязана к выбранному вузу.</p>
    <ul className="my-4 space-y-2 text-sm">{admins.map(user => <li key={user.id} className="break-words">{user.lastName} {user.firstName} · {user.email}</li>)}</ul>
    {error && <p role="alert" className="mb-4 text-red-800">{error}</p>}{success && <p role="status" className="mb-4 text-emerald-900">{success}</p>}
    {owner && !admins.length ? <form onSubmit={event => void create(event)} className="grid max-w-xl gap-4">
      {(['lastName', 'firstName', 'email', 'password'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-semibold">{{ lastName: 'Фамилия администратора', firstName: 'Имя администратора', email: 'Email администратора', password: 'Начальный пароль' }[key]}<input required type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} autoComplete={key === 'password' ? 'new-password' : 'off'} minLength={key === 'password' ? 6 : undefined} maxLength={key === 'password' ? 72 : key === 'email' ? 254 : 100} className={fieldClass} value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} /></label>)}
      <Button type="submit" loading={busy} disabled={busy}>Создать администратора</Button>
    </form> : !admins.length ? <p className="mt-4 text-amber-900">Создание первого администратора выполняет владелец платформы. Для восстановления доступа обратитесь к нему.</p> : null}
    {owner && admins.length > 0 && <div className="mt-5 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-950"><h3 className="font-bold">Передайте доступ администратору</h3><p className="mt-2">Передайте email и начальный пароль отдельно, защищённым способом. Письмо не отправляется, пароль мастер после создания не показывает и не сохраняет. Если сейчас открыт аккаунт владельца, администратору следует входить с отдельного устройства или профиля браузера.</p><div className="mt-4"><Link href="/login" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300">Общий экран входа</Link></div><p className="mt-3 text-sm">После входа администратор откроет мастер по адресу <code className="break-all rounded bg-white/80 px-1.5 py-0.5">/deanery/onboarding?step=3</code>, чтобы продолжить с импорта. Импорт и проверка выполняются в контексте его вуза; мастер не меняет текущую учётную запись владельца.</p></div>}
  </Card>;
}
