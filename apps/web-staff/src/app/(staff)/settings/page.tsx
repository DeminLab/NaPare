'use client';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { NotificationSettings } from './NotificationSettings';

export default function StaffSettingsPage() {
  return <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-sm font-semibold text-[var(--role-accent)]">Общие настройки аккаунта</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Настройки</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Настройки относятся к вашему единому аккаунту. Выберите, о каких событиях NaPare будет сообщать, и откройте параметры безопасности и подключений.</p>
    </header>
    <NotificationSettings />
    <Card padding="sm" className="overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--role-accent)]">Аккаунт</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Доступ и подключённые сервисы</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Подключения аккаунта управляются отдельно. Для смены пароля обратитесь к администратору университета.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <a href="/connections" className="role-link role-link-primary w-full sm:w-auto">Подключения аккаунта</a>
          <Link href="/profile" className="role-link role-link-secondary w-full sm:w-auto">Мой профиль</Link>
        </div>
      </div>
    </Card>
  </div>;
}
