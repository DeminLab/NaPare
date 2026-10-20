'use client';

import { useState } from 'react';

type NodeId = 'portal' | 'proxy' | 'max' | 'student' | 'staff' | 'admin' | 'developer' | 'backend' | 'database' | 'services' | 'integrations';

const nodes: Record<NodeId, { label: string; detail: string; tone: string }> = {
  portal: { label: 'web-portal', detail: 'Публичный сайт · единый вход · карьерный модуль', tone: 'sky' },
  proxy: { label: 'Nginx', detail: 'Единый домен · маршрутизация кабинетов и /api/v1', tone: 'violet' },
  max: { label: 'MAX', detail: 'Открывает портал · проверка данных запуска на сервере', tone: 'cyan' },
  student: { label: 'web-student', detail: 'Next.js App Router · маршрут /student', tone: 'sky' },
  staff: { label: 'web-staff', detail: 'Next.js App Router · маршрут /staff', tone: 'sky' },
  admin: { label: 'web-admin', detail: 'Next.js App Router · маршрут /deanery', tone: 'sky' },
  developer: { label: 'web-developer', detail: 'Next.js App Router · маршрут /developer', tone: 'violet' },
  backend: { label: 'backend', detail: 'NestJS модульный монолит · REST /api/v1', tone: 'emerald' },
  database: { label: 'database', detail: 'PostgreSQL 16 · основное хранилище', tone: 'indigo' },
  services: { label: 'services', detail: 'Redis 7 · инфраструктурный сервис', tone: 'amber' },
  integrations: { label: 'integrations', detail: 'Внешние сервисы · при наличии конфигурации', tone: 'cyan' },
};

const layers: Array<{ title: string; ids: NodeId[] }> = [
  { title: 'Веб-приложения', ids: ['portal', 'student', 'staff', 'admin', 'developer'] },
  { title: 'Прикладной слой', ids: ['backend'] },
  { title: 'Данные и инфраструктура', ids: ['database', 'services', 'integrations'] },
];

const toneClasses: Record<string, string> = {
  sky: 'border-blue-200 bg-blue-50 text-blue-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
};

function NodeCard({ id, active, onSelect }: { id: NodeId; active: boolean; onSelect: (id: NodeId) => void }) {
  const node = nodes[id];
  return <button type="button" aria-pressed={active} onClick={() => onSelect(id)} className={`group w-full rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/50 hover:border-sky-300/60 ${toneClasses[node.tone]} ${active ? 'ring-2 ring-sky-300/50 ring-offset-2 ring-offset-[#0b0e14]' : ''}`}><span className="flex items-center justify-between gap-3"><span className="font-mono text-sm font-semibold">{node.label}</span><span className="h-2 w-2 rounded-full bg-current opacity-70 shadow-[0_0_12px_currentColor]" /></span><span className="mt-1 block text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-secondary)]">{node.detail}</span></button>;
}

function DownConnector() {
  return <div className="flex h-10 items-center justify-center"><svg className="h-10 w-5 text-slate-300" viewBox="0 0 20 40" fill="none" aria-hidden="true"><path d="M10 0v31M4 26l6 8 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>;
}

export default function ArchitecturePage() {
  const [selected, setSelected] = useState<NodeId>('backend');
  const selectedNode = nodes[selected];
  const connections:Record<NodeId,NodeId[]>={portal:['proxy','max'],max:['portal'],proxy:['portal','student','staff','admin','developer','backend'],student:['proxy'],staff:['proxy'],admin:['proxy'],developer:['proxy'],backend:['proxy','database','services','integrations'],database:['backend'],services:['backend'],integrations:['backend']};

  return <div className="min-h-full px-4 py-6 text-[var(--color-text)] sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-7xl space-y-7">
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">Разработчик <span>/</span> <span className="text-[var(--color-text)]">Архитектура</span></div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Архитектура</h1><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Как связаны продукты NaPare, API, данные и интеграции</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Карта системы</span></div>

    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl shadow-black/10 sm:p-7"><div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Визуальная схема</h2><p className="mt-1 text-xs text-[var(--color-text-secondary)]">Выберите узел, чтобы посмотреть его назначение</p></div><div className="font-mono text-xs text-[var(--color-text-secondary)]">поток запросов ↓</div></div><div className="mx-auto max-w-5xl">
      <div className="mb-5 grid gap-3 sm:grid-cols-[220px_1fr]"><NodeCard id="max" active={selected === 'max'} onSelect={setSelected} /><p className="self-center text-sm leading-6 text-[var(--color-text-secondary)]">MAX открывает публичный портал. Вход и проверка данных запуска выполняются через API; остальные кабинеты также доступны напрямую в браузере.</p></div><div className="rounded-xl border border-[var(--color-border)] bg-slate-50 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{layers[0].title}</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{layers[0].ids.map((id) => <NodeCard key={id} id={id} active={selected === id} onSelect={setSelected} />)}</div></div>
      <DownConnector />
      <div className="mx-auto max-w-sm"><NodeCard id="proxy" active={selected === 'proxy'} onSelect={setSelected} /></div>
      <DownConnector />
      <div className="mx-auto max-w-sm"><p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{layers[1].title}</p><NodeCard id="backend" active={selected === 'backend'} onSelect={setSelected} /></div>
      <DownConnector />
      <div className="rounded-xl border border-[var(--color-border)] bg-slate-50 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{layers[2].title}</p><div className="grid gap-2 md:grid-cols-3">{layers[2].ids.map((id) => <NodeCard key={id} id={id} active={selected === id} onSelect={setSelected} />)}</div></div>
    </div><div className="mt-6 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-[var(--color-text-secondary)]">Выбранный компонент</span><span className="font-mono text-xs text-blue-700">{selectedNode.label} <span className="text-[var(--color-text-secondary)]">·</span> {selectedNode.detail}</span></div><div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite"><span className="text-xs text-[var(--color-text-secondary)]">Связанные компоненты:</span>{connections[selected].map(id=><button key={id} type="button" onClick={()=>setSelected(id)} className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-xs text-blue-700 hover:bg-[var(--color-brand-soft)]">{nodes[id].label}</button>)}</div></section>

    <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-6"><h2 className="text-base font-semibold">Стек технологий</h2><div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm"><div><p className="text-xs text-[var(--color-text-secondary)]">Фронтенд</p><p className="mt-1 text-[var(--color-text)]">Next.js 15 · React 18</p></div><div><p className="text-xs text-[var(--color-text-secondary)]">Бэкенд</p><p className="mt-1 text-[var(--color-text)]">NestJS 10 · TypeORM</p></div><div><p className="text-xs text-[var(--color-text-secondary)]">База данных</p><p className="mt-1 text-[var(--color-text)]">PostgreSQL 16</p></div><div><p className="text-xs text-[var(--color-text-secondary)]">Среда выполнения</p><p className="mt-1 text-[var(--color-text)]">Node.js · pnpm · Turborepo</p></div></div></section><section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-6"><h2 className="text-base font-semibold">Инфраструктура</h2><div className="mt-5 flex flex-wrap gap-2">{['Docker Compose', 'Nginx', 'Redis 7', 'OpenAPI'].map((item) => <span key={item} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">{item}</span>)}</div><p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">Контейнеры объединены общей сетью, а API выступает единым шлюзом для всех клиентских приложений.</p></section><section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-6"><h2 className="text-base font-semibold">Аутентификация</h2><p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">JWT access и refresh tokens, Passport strategy и role-based guards защищают API и разделяют доступ студента, преподавателя, администратора и developer portal.</p><div className="mt-4 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-violet-700">Authorization: Bearer &lt;access_token&gt;</div></section><section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-6"><h2 className="text-base font-semibold">Поток данных</h2><ol className="mt-4 space-y-3 text-sm text-[var(--color-text-secondary)]"><li className="flex gap-3"><span className="font-mono text-xs text-[var(--color-brand)]">01</span><span>Клиент отправляет запрос в версионированный API NestJS.</span></li><li className="flex gap-3"><span className="font-mono text-xs text-[var(--color-brand)]">02</span><span>Гарды проверяют личность и права доступа.</span></li><li className="flex gap-3"><span className="font-mono text-xs text-[var(--color-brand)]">03</span><span>Модули читают и пишут данные в PostgreSQL и обращаются к настроенным внешним сервисам.</span></li></ol></section></div>
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-base font-semibold">Развёртывание</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Продакшн-топология описана в Docker Compose, маршрутизация выполняется через Nginx.</p></div><div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]"><span className="h-2 w-2 rounded-full bg-emerald-400" />Поставка в контейнерах</div></div></section>
  </div></div>;
}
