import Card from '@/components/ui/Card';

export default function ArchitecturePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Архитектура системы</h1>
          <p className="mt-1 text-sm text-slate-500">
            Визуальная схема инфраструктуры НаПаре
          </p>
        </div>

        {/* Architecture diagram */}
        <Card className="mb-6 overflow-hidden p-0">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
            <h2 className="text-sm font-bold text-slate-900">Инфраструктура</h2>
          </div>
          <div className="p-4 sm:p-8">
            <div className="flex flex-col items-center gap-0">
              {/* Nginx */}
              <div className="relative">
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-3 text-center">
                  <p className="text-xs font-bold text-amber-700">NGINX</p>
                  <p className="text-[10px] text-amber-500">Reverse Proxy</p>
                </div>
              </div>

              {/* Connector down */}
              <div className="relative h-6 w-0.5 bg-slate-200" />

              {/* 4 Frontends */}
              <div className="relative">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-0">
                  <div className="rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold text-sky-700">Web-Front</p>
                    <p className="text-[9px] text-sky-500">:3000</p>
                  </div>
                  <div className="rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold text-sky-700">Student</p>
                    <p className="text-[9px] text-sky-500">:3001</p>
                  </div>
                  <div className="rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold text-sky-700">Teacher</p>
                    <p className="text-[9px] text-sky-500">:3002</p>
                  </div>
                  <div className="rounded-xl border-2 border-violet-300 bg-violet-50 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold text-violet-700">Developer</p>
                    <p className="text-[9px] text-violet-500">:3004</p>
                  </div>
                </div>

                {/* Horizontal connectors above frontends */}
                <div className="absolute top-0 left-1/2 hidden h-0.5 w-[calc(100%-32px)] -translate-x-1/2 -translate-y-0 bg-sky-200 sm:block" />
              </div>

              {/* Connectors down */}
              <div className="relative hidden items-start gap-0 sm:flex">
                <div className="h-6 w-0.5 bg-sky-200" />
                <div className="w-40" />
                <div className="h-6 w-0.5 bg-sky-200" />
              </div>

              {/* Horizontal line between connectors */}
              <div className="hidden h-0.5 w-[calc(100%-40px)] bg-slate-200 sm:block" />

              {/* Single connector to backend */}
              <div className="hidden h-6 w-0.5 bg-slate-200 sm:block" />

              {/* Backend */}
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-8 py-4 text-center">
                <p className="text-sm font-bold text-emerald-700">Backend API</p>
                <p className="text-[10px] text-emerald-500">Node.js + Express</p>
                <p className="mt-1 text-[9px] font-medium text-emerald-600">:8080</p>
              </div>

              {/* Connectors to storage */}
              <div className="relative hidden items-start sm:flex">
                <div className="h-6 w-0.5 bg-slate-200" />
              </div>

              {/* Horizontal line */}
              <div className="hidden h-0.5 w-[calc(100%-40px)] bg-slate-200 sm:block" />

              {/* Storage connectors */}
              <div className="relative hidden items-start gap-0 sm:flex">
                <div className="h-6 w-0.5 bg-slate-200" />
                <div className="w-20" />
                <div className="h-6 w-0.5 bg-slate-200" />
                <div className="w-20" />
                <div className="h-6 w-0.5 bg-slate-200" />
              </div>

              {/* Storage layer */}
              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3">
                <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-indigo-700">PostgreSQL</p>
                  <p className="text-[9px] text-indigo-500">:5432</p>
                </div>
                <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-red-700">Redis</p>
                  <p className="text-[9px] text-red-500">:6379</p>
                </div>
                <div className="rounded-xl border-2 border-cyan-300 bg-cyan-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-cyan-700">MinIO</p>
                  <p className="text-[9px] text-cyan-500">:9000</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Description cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: 'Nginx',
              desc: 'Обратный прокси, балансировка нагрузки, SSL-терминация. Маршрутизирует запросы по сервисам.',
              color: 'border-amber-200 bg-amber-50',
              dot: 'bg-amber-500',
            },
            {
              title: 'Фронтенды',
              desc: 'Четыре независимых Next.js приложения: основной сайт, кабинет студента, кабинет преподавателя, консоль разработчика.',
              color: 'border-sky-200 bg-sky-50',
              dot: 'bg-sky-500',
            },
            {
              title: 'Backend API',
              desc: 'Node.js + Express сервер. Общая бизнес-логика, аутентификация, авторизация, CRUD-операции.',
              color: 'border-emerald-200 bg-emerald-50',
              dot: 'bg-emerald-500',
            },
            {
              title: 'Хранилища данных',
              desc: 'PostgreSQL — основная БД. Redis — кэширование и сессии. MinIO — объектное хранилище файлов.',
              color: 'border-indigo-200 bg-indigo-50',
              dot: 'bg-indigo-500',
            },
          ].map((item) => (
            <Card key={item.title} variant="bordered" className={`border ${item.color}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.dot}`} />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
