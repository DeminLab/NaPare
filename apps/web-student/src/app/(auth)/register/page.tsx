import Link from 'next/link';

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">Н</span>
      НаПаре
    </Link>
  );
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Brand />
        <section className="mt-12 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:mt-16 sm:p-8">
          <p className="text-sm font-semibold text-indigo-600">Доступ в студенческий кабинет</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Учётную запись выдаёт вуз</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Самостоятельная регистрация отключена. Администратор вашего университета создаёт аккаунты студентов.
          </p>
          <ol className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-semibold text-indigo-700">1</span><span>Обратитесь к администратору или в учебный отдел вашего вуза, чтобы получить доступ.</span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-semibold text-indigo-700">2</span><span>Когда получите email и пароль, войдите в НаПаре.</span></li>
          </ol>
          <Link href="/login" className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 sm:w-auto">
            Перейти ко входу
          </Link>
        </section>
      </div>
    </main>
  );
}