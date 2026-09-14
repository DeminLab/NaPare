'use client';

import { useState } from 'react';

const settings = ['Общие', 'Уведомления', 'Безопасность'];

export default function StaffSettingsPage() {
  const [active, setActive] = useState('Общие');
  return <div className="space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><span>НаПаре</span><span>/</span><span className="text-slate-900">Настройки</span></div><div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Настройки</h1><p className="mt-1 text-sm text-slate-500">Управление параметрами кабинета преподавателя</p></div><div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"><nav className="space-y-1" aria-label="Настройки"><p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Разделы</p>{settings.map((item) => <button key={item} type="button" onClick={() => setActive(item)} className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium ${active === item ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`}>{item}</button>)}</nav><section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-base font-bold text-slate-950">{active}</h2><p className="mt-3 text-sm leading-6 text-slate-500">Раздел готов для подключения настроек преподавателя. Навигация ведёт на существующую страницу без пустого маршрута.</p></section></div></div>;
}
