import Link from 'next/link';
import { PublicNavigation, PublicFooter } from '@/components/navigation/PublicNavigation';

export default function Home() {
  return (
    <main className="min-h-screen"><PublicNavigation />
      <section className="relative overflow-hidden bg-[var(--color-background)] px-6 py-20 text-white sm:py-28">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Ccircle%20cx%3D%221%22%20cy%3D%221%22%20r%3D%221%22%20fill%3D%22rgba(255,255,255,0.04)%22/%3E%3C/svg%3E')] opacity-40" />
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-cyan-200 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse-dot" />
            Разработчик
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Консоль
            <br />
            <span className="text-cyan-300">
              разработчика
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-white/70">
            Мониторинг API, документация, архитектура системы и управление сессиями — всё в одном месте
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-black/25 transition-all hover:bg-slate-50 hover:shadow-xl"
            >
              Войти в панель
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-background)] px-6 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75" />
                  </svg>
                ),
                color: 'bg-cyan-400/10 text-cyan-300 group-hover:bg-cyan-400 group-hover:text-slate-950',
                ring: 'border-white/10 bg-white/[0.04] hover:border-cyan-300/40 hover:bg-white/[0.06]',
                title: 'API мониторинг',
                desc: 'Health check, uptime и статус эндпоинтов в реальном времени',
              },
              {
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                ),
                color: 'bg-indigo-400/10 text-indigo-300 group-hover:bg-indigo-400 group-hover:text-slate-950',
                ring: 'border-white/10 bg-white/[0.04] hover:border-indigo-300/40 hover:bg-white/[0.06]',
                title: 'Документация',
                desc: 'Swagger UI с полным описанием всех API-методов',
              },
              {
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                ),
                color: 'bg-emerald-400/10 text-emerald-300 group-hover:bg-emerald-400 group-hover:text-slate-950',
                ring: 'border-white/10 bg-white/[0.04] hover:border-emerald-300/40 hover:bg-white/[0.06]',
                title: 'Архитектура',
                desc: 'Визуальная схема инфраструктуры: Nginx, фронтенды, Backend, хранилища',
              },
            ].map((card) => (
              <div
                key={card.title}
                className={`group rounded-2xl border p-8 shadow-sm transition-all ${card.ring}`}
              >
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${card.color}`}>
                  {card.icon}
                </div>
                <h3 className="text-lg font-bold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
