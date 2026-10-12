'use client';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { NotificationSettings } from './NotificationSettings';

export default function StaffSettingsPage() {
  return <div className="mx-auto max-w-4xl space-y-6">
    <header><h1 className="text-3xl font-bold tracking-tight text-slate-950">Настройки</h1><p className="mt-2 text-sm text-slate-600">Выберите нужные события и подключите свой аккаунт к мессенджерам.</p></header>
    <NotificationSettings />
    <Card><h2 className="text-lg font-semibold text-slate-900">Аккаунт и доступ</h2><p className="mt-2 text-sm text-slate-600">MAX используется для быстрого входа, Telegram — для дополнительной доставки уведомлений. Если вы забыли пароль, обратитесь к администратору университета.</p><div className="mt-4 flex flex-wrap gap-3"><a href="/connections" className="inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800">Подключения аккаунта</a><Link href="/profile" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Мой профиль</Link></div></Card>
  </div>;
}
