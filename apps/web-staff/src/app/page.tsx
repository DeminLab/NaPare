import Link from "next/link";
import {
  PublicNavigation,
  PublicFooter,
} from "@/components/navigation/PublicNavigation";

const features = [
  {
    number: "01",
    title: "Расписание без лишних поисков",
    description:
      "Занятия, изменения и аудитории собраны в удобном календаре преподавателя.",
    tone: "bg-indigo-50 text-indigo-600",
  },
  {
    number: "02",
    title: "Группы и посещаемость",
    description:
      "Открывайте списки студентов и отмечайте посещаемость прямо из занятия.",
    tone: "bg-sky-50 text-sky-600",
  },
  {
    number: "03",
    title: "Материалы в контексте пары",
    description:
      "Объявления, задания и файлы связаны с конкретной группой и занятием.",
    tone: "bg-emerald-50 text-emerald-600",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fc] text-[#111b34]">
      <PublicNavigation />

      <section className="relative isolate overflow-hidden border-b border-slate-200/80 bg-white">
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full bg-indigo-100/70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-52 left-[-8rem] -z-10 h-[28rem] w-[28rem] rounded-full bg-blue-50 blur-3xl"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:px-12 lg:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-3.5 py-2 text-sm font-semibold text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Кабинет преподавателя
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-[-0.045em] text-[#111b34] sm:text-6xl sm:leading-[1.08]">
              Учебный день —
              <span className="block text-[#5146e8]">в одном месте</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Расписание, группы, посещаемость и материалы к занятиям в едином
              рабочем пространстве НаПаре.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5146e8] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5 hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
              >
                Войти в кабинет
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
              <a
                href="#possibilities"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
              >
                Возможности кабинета
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Войдите с учётной записью, выданной вашим учебным заведением.
            </p>
          </div>

          <div className="mx-auto w-full max-w-xl lg:ml-auto">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_-36px_rgba(48,45,120,.35)] sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-600">
                    НаПаре
                  </p>
                  <p className="mt-1 text-lg font-bold">Рабочий день</p>
                </div>
                <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  Кабинет преподавателя
                </span>
              </div>
              <div className="space-y-3 py-5">
                {[
                  { time: "08:30", title: "Расписание и изменения", meta: "Занятия и аудитории", color: "bg-blue-500" },
                  { time: "10:10", title: "Группы и посещаемость", meta: "Работа со списком студентов", color: "bg-emerald-500" },
                  { time: "12:00", title: "Материалы к занятиям", meta: "Задания и объявления", color: "bg-amber-500" },
                ].map((item) => (
                  <div key={item.time} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:gap-4 sm:p-4">
                    <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-slate-500 sm:w-14 sm:text-sm">
                      {item.time}
                    </span>
                    <span className={`h-10 w-1 shrink-0 rounded-full ${item.color}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#111b34] sm:text-base">
                        {item.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500 sm:text-sm">
                        {item.meta}
                      </span>
                    </span>
                    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm" aria-hidden="true">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" />
                  </svg>
                </span>
                <span className="leading-5">Актуальные данные вашего учебного заведения</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="possibilities" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mb-8 max-w-2xl sm:mb-10">
          <p className="text-sm font-bold uppercase tracking-[.14em] text-[#5146e8]">
            Всё для занятий
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Инструменты преподавателя
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Основные учебные задачи доступны из одного кабинета и связаны с вашим расписанием.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.number} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_-24px_rgba(17,27,52,.3)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${feature.tone}`}>
                  {feature.number}
                </span>
                <span className="h-px flex-1 bg-slate-100" />
                <span className="text-sm font-semibold text-slate-400">НаПаре</span>
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
