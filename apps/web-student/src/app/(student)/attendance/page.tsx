import Link from 'next/link';
import { Icon } from '@napare/ui';

export default function AttendancePage() {
  return <div className="student-attendance-page mx-auto max-w-[1400px] space-y-6">
    <header className="student-page-heading">
      <p className="student-page-kicker">Личный кабинет студента</p>
      <h1>Посещаемость</h1>
      <p>История посещений и отметки по занятиям.</p>
    </header>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.8fr)]">
      <article className="student-panel p-5 sm:p-7" aria-labelledby="attendance-history-title">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]"><Icon name="chart" size={21} /></span>
          <div><h2 id="attendance-history-title" className="text-lg font-bold">История посещаемости</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Данные по отметкам преподавателей</p></div>
        </div>
        <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm leading-6 text-sky-900" role="status">
          Личные отметки посещаемости пока не передаются в кабинет. Здесь появятся сводка и история, когда вуз подключит источник данных.
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/week" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><Icon name="calendar" size={17} />Открыть расписание</Link>
          <Link href="/absences" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><Icon name="clipboard" size={17} />Мои обращения</Link>
        </div>
      </article>

      <aside className="student-panel p-5 sm:p-6" aria-labelledby="attendance-help-title">
        <h2 id="attendance-help-title" className="text-base font-bold">Если отметка неверная</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">Отметки вносит преподаватель. Уточните её у преподавателя или сообщите об отсутствии, если заранее знаете, что не сможете прийти.</p>
        <Link href="/absences" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><Icon name="arrow-right" size={17} />Сообщить об отсутствии</Link>
      </aside>
    </section>
  </div>;
}
