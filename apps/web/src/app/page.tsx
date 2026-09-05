import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold">НаПаре</h1>
      </div>

      <div className="mt-16 flex gap-8">
        <Link
          href="/login"
          className="rounded-lg bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 transition-colors"
        >
          Войти
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-primary-600 px-6 py-3 text-primary-600 hover:bg-primary-50 transition-colors"
        >
          Регистрация
        </Link>
      </div>

      <div className="mt-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-primary-300 hover:bg-primary-50">
          <h2 className="mb-3 text-2xl font-semibold">Расписание</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Актуальное расписание с уведомлениями об изменениях
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-primary-300 hover:bg-primary-50">
          <h2 className="mb-3 text-2xl font-semibold">Пространство пары</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Объявления, домашние задания и обсуждение
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-primary-300 hover:bg-primary-50">
          <h2 className="mb-3 text-2xl font-semibold">Уведомления</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Push-уведомления об изменениях и новостях
          </p>
        </div>
      </div>
    </main>
  );
}
