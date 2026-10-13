import Link from 'next/link';

export default function AttendanceInfoPage() {
  return <section className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
    <h1 className="text-2xl font-bold text-slate-900">Посещаемость отмечает преподаватель</h1>
    <p className="text-sm leading-6 text-slate-600">На каждой паре преподаватель отмечает присутствие, отсутствие и опоздание в списке группы. Самостоятельная отметка по QR больше не используется.</p>
    <p className="text-sm leading-6 text-slate-600">Если в отметке ошибка, обратитесь к преподавателю. Если не сможете прийти, сообщите о причине отсутствия.</p>
    <div className="flex flex-wrap gap-3"><Link href="/week" className="inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white">Расписание</Link><Link href="/absences" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Сообщить об отсутствии</Link></div>
  </section>;
}
