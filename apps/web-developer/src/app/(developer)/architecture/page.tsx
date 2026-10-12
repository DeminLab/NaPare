'use client';

import { useState } from 'react';

type NodeId = 'student' | 'staff' | 'admin' | 'developer' | 'backend' | 'database' | 'services' | 'integrations';

const nodes: Record<NodeId, { label: string; detail: string; tone: string }> = {
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
  { title: 'Веб-приложения', ids: ['student', 'staff', 'admin', 'developer'] },
  { title: 'Прикладной слой', ids: ['backend'] },
  { title: 'Данные и инфраструктура', ids: ['database', 'services', 'integrations'] },
];

const toneClasses: Record<string, string> = {
  sky: 'border-sky-400/30 bg-sky-400/[0.08] text-sky-200',
  violet: 'border-violet-400/30 bg-violet-400/[0.08] text-violet-200',
  emerald: 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200',
  indigo: 'border-indigo-400/30 bg-indigo-400/[0.08] text-indigo-200',
  amber: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200',
  cyan: 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200',
};

function NodeCard({ id, active, onSelect }: { id: NodeId; active: boolean; onSelect: (id: NodeId) => void }) {
  const node = nodes[id];
  return <button type="button" onClick={() => onSelect(id)} className={`group w-full rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-sky-300/60 ${toneClasses[node.tone]} ${active ? 'ring-2 ring-sky-300/50 ring-offset-2 ring-offset-[#0b0e14]' : ''}`}><span className="flex items-center justify-between gap-3"><span className="font-mono text-sm font-semibold">{node.label}</span><span className="h-2 w-2 rounded-full bg-current opacity-70 shadow-[0_0_12px_currentColor]" /></span><span className="mt-1 block text-[11px] text-white/40 group-hover:text-white/60">{node.detail}</span></button>;
}

function DownConnector() {
  return <div className="flex h-10 items-center justify-center"><svg className="h-10 w-5 text-white/20" viewBox="0 0 20 40" fill="none" aria-hidden="true"><path d="M10 0v31M4 26l6 8 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>;
}

export default function ArchitecturePage() {
  const [selected, setSelected] = useState<NodeId>('backend');
  const selectedNode = nodes[selected];

  return <div className="min-h-full bg-[#0b0e14] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-7xl space-y-7">
    <div className="flex items-center gap-2 text-xs text-white/40">Разработчик <span>/</span> <span className="text-white/80">Архитектура</span></div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Архитектура</h1><p className="mt-1 text-sm text-white/45">Как связаны продукты NaPare, API, данные и интеграции</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Карта системы</span></div>

    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/10 sm:p-7"><div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Визуальная схема</h2><p className="mt-1 text-xs text-white/35">Выберите узел, чтобы посмотреть его назначение</p></div><div className="font-mono text-[11px] text-white/30">поток запросов ↓</div></div><div className="mx-auto max-w-5xl">
      <div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">{layers[0].title}</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{layers[0].ids.map((id) => <NodeCard key={id} id={id} active={selected === id} onSelect={setSelected} />)}</div></div>
      <DownConnector />
      <div className="mx-auto max-w-sm"><p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">{layers[1].title}</p><NodeCard id="backend" active={selected === 'backend'} onSelect={setSelected} /></div>
      <DownConnector />
      <div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">{layers[2].title}</p><div className="grid gap-2 md:grid-cols-3">{layers[2].ids.map((id) => <NodeCard key={id} id={id} active={selected === id} onSelect={setSelected} />)}</div></div>
    </div><div className="mt-6 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-white/40">Выбранный компонент</span><span className="font-mono text-xs text-sky-200">{selectedNode.label} <span className="text-white/30">·</span> {selectedNode.detail}</span></div></section>

    <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-base font-semibold">Стек технологий</h2><div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm"><div><p className="text-xs text-white/35">Фронтенд</p><p className="mt-1 text-white/75">Next.js 15 · React 18</p></div><div><p className="text-xs text-white/35">Бэкенд</p><p className="mt-1 text-white/75">NestJS 10 · TypeORM</p></div><div><p className="text-xs text-white/35">База данных</p><p className="mt-1 text-white/75">PostgreSQL 16</p></div><div><p className="text-xs text-white/35">Среда выполнения</p><p className="mt-1 text-white/75">Node.js · pnpm · Turborepo</p></div></div></section><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-base font-semibold">Инфраструктура</h2><div className="mt-5 flex flex-wrap gap-2">{['Docker Compose', 'Nginx', 'Redis 7', 'OpenAPI'].map((item) => <span key={item} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">{item}</span>)}</div><p className="mt-4 text-sm leading-6 text-white/45">Контейнеры объединены общей сетью, а API выступает единым шлюзом для всех клиентских приложений.</p></section><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-base font-semibold">Аутентификация</h2><p className="mt-3 text-sm leading-6 text-white/45">JWT access и refresh tokens, Passport strategy и role-based guards защищают API и разделяют доступ студента, преподавателя, администратора и developer portal.</p><div className="mt-4 rounded-lg bg-black/20 px-3 py-2 font-mono text-xs text-violet-200">Authorization: Bearer &lt;access_token&gt;</div></section><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-base font-semibold">Поток данных</h2><ol className="mt-4 space-y-3 text-sm text-white/55"><li className="flex gap-3"><span className="font-mono text-xs text-sky-300">01</span><span>Клиент отправляет запрос в версионированный API NestJS.</span></li><li className="flex gap-3"><span className="font-mono text-xs text-sky-300">02</span><span>Гарды проверяют личность и права доступа.</span></li><li className="flex gap-3"><span className="font-mono text-xs text-sky-300">03</span><span>Модули читают и пишут данные в PostgreSQL и обращаются к настроенным внешним сервисам.</span></li></ol></section></div>
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-base font-semibold">Развёртывание</h2><p className="mt-1 text-sm text-white/45">Продакшн-топология описана в Docker Compose, маршрутизация выполняется через Nginx.</p></div><div className="flex items-center gap-3 text-xs text-white/40"><span className="h-2 w-2 rounded-full bg-emerald-400" />Поставка в контейнерах</div></div></section>
  </div></div>;
}
