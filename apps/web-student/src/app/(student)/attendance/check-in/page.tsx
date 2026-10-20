import Link from 'next/link';

export default function AttendanceInfoPage() {
  return <div className="mx-auto max-w-[980px] space-y-6">
    <header className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-500">Учебный процесс</p>
      <h1 className="ds-page-title text-[var(--color-text)]">Посещаемость</h1>
      <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">Здесь можно уточнить информацию о посещении занятий и перейти к расписанию или обращению об отсутствии.</p>
    </header>

    <section className="student-panel grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:p-7" aria-labelledby="attendance-status-title">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3m8-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m9 14 2 2 4-4"/></svg>
      </span>
      <div className="min-w-0">
        <h2 id="attendance-status-title" className="ds-section-title text-[var(--color-text)]">Отметки ведёт преподаватель</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">История посещаемости пока недоступна в кабинете. Если вы заметили ошибку в отметке, обратитесь к преподавателю.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/week" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]">Открыть расписание</Link>
          <Link href="/absences" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]">Сообщить об отсутствии</Link>
        </div>
      </div>
    </section>
  </div>;
}
