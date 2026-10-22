'use client';

import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { errorMessage, fieldClass, type Account } from './types';

export default function AdministratorStep({ universityId, owner, users, reload }: { universityId: string; owner: boolean; users: Account[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const admins = users.filter(user => user.role === 'university_admin' && user.isActive);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      await apiFetch(owner ? '/platform/accounts' : '/admin/users', { method: 'POST', body: JSON.stringify({ ...form, role: 'university_admin', ...(owner ? { universityId } : {}) }) });
      setForm({ firstName: '', lastName: '', email: '', password: '' });
      setSuccess('Администратор создан. Пароль передайте ему защищённым способом; письмо автоматически не отправляется.');
      await reload();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <Card><h2 className="text-xl font-bold text-slate-950">Первый администратор</h2>
    <p className="mt-2 text-sm text-slate-600">Действующих администраторов: {admins.length}. Учётная запись привязана к выбранному вузу.</p>
    <ul className="my-4 space-y-2 text-sm">{admins.map(user => <li key={user.id} className="break-words">{user.lastName} {user.firstName} · {user.email}</li>)}</ul>
    {error && <p role="alert" className="mb-4 text-red-800">{error}</p>}{success && <p role="status" className="mb-4 text-emerald-900">{success}</p>}
    {owner && !admins.length ? <form onSubmit={event => void create(event)} className="grid max-w-xl gap-4">
      {(['lastName', 'firstName', 'email', 'password'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-semibold">{{ lastName: 'Фамилия администратора', firstName: 'Имя администратора', email: 'Email администратора', password: 'Начальный пароль' }[key]}<input required type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} autoComplete={key === 'password' ? 'new-password' : 'off'} minLength={key === 'password' ? 12 : undefined} maxLength={key === 'password' ? 72 : key === 'email' ? 254 : 100} className={fieldClass} value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} /></label>)}
      <Button type="submit" loading={busy} disabled={busy}>Создать администратора</Button>
    </form> : !admins.length ? <p className="mt-4 text-amber-900">Создание первого администратора выполняет владелец платформы. Для восстановления доступа обратитесь к нему.</p> : null}
    {owner && admins.length > 0 && <div className="mt-5 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-950"><p>Структура подготовлена. Дальше администратор входит в свой аккаунт и открывает <strong>/deanery/onboarding</strong>: импорт и проверка выполняются в контексте его вуза.</p><p className="mt-2">Мастер не меняет текущий аккаунт автоматически.</p></div>}
  </Card>;
}
