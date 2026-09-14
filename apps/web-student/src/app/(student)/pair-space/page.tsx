import Link from 'next/link';

export default function PairSpaceIndex() {
  return <section className="mx-auto max-w-2xl py-12 text-center"><h1 className="ds-page-title">Пространство пары</h1><p className="mt-3 text-slate-500">Выберите пару в расписании, чтобы открыть её пространство.</p><Link href="/week" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Открыть расписание</Link></section>;
}
