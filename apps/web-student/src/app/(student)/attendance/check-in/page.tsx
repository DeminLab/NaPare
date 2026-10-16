import Link from 'next/link';

export default function AttendanceInfoPage() {
  return <section className="mx-auto max-w-2xl space-y-4">
    <h1 className="text-2xl font-bold text-[var(--color-text)]">Посещаемость</h1>
    <p className="text-sm leading-6 text-[var(--color-text-secondary)]">Отметки проставляет преподаватель. Если в отметке ошибка, обратитесь к нему.</p>
    <div className="flex flex-wrap gap-3"><Link href="/week" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)]">Расписание</Link><Link href="/absences" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)]">Сообщить об отсутствии</Link></div>
  </section>;
}
