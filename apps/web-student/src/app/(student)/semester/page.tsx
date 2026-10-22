'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, PaginatedResponse } from '@/lib/api';
import { Card, RequestState } from '@/components/ui';

interface Period { id: string; label: string }
interface Grade {
  id: number; name: string; hidden: boolean; stale: boolean;
  raw: number | null; display: string | null; minimum: number | null; maximum: number | null;
}
interface Course { id: number; name: string; available: boolean; grades: Grade[] }
interface Overview extends PaginatedResponse<Course> {
  available: boolean;
  message?: string;
  source: { provider: string; baseUrl: string; fetchedAt: string } | null;
  debtSource: { available: boolean; message: string };
}
interface Periods { available: boolean; periods: Period[] }

const control = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

function gradeValue(grade: Grade) {
  if (grade.hidden) return 'Скрыта источником';
  if (grade.stale) return 'Ожидает пересчёта';
  return grade.display?.trim() || (grade.raw !== null ? String(grade.raw) : 'Нет оценки');
}

export default function SemesterPage() {
  const [periods, setPeriods] = useState<Periods | null>(null);
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null); setPeriods(null);
    apiFetch<Periods>('/academic/semester/periods', { signal: controller.signal, cache: 'no-store' })
      .then(data => { if (!controller.signal.aborted) { setPeriods(data); setPeriod(current => data.periods.some(row => row.id === current) ? current : data.periods[0]?.id || ''); setPage(1); } })
      .catch(() => { if (!controller.signal.aborted) setError('Не удалось получить список семестров. Проверьте соединение и повторите запрос.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!periods?.available || !period) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    apiFetch<Overview>(`/academic/semester?period=${encodeURIComponent(period)}&page=${page}&limit=10`, { signal: controller.signal, cache: 'no-store' })
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Не удалось загрузить оценки. Источник может быть временно недоступен. Проверьте соединение и повторите запрос.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [periods, period, page]);

  const refresh = () => setRetry(value => value + 1);
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/profile" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700">← Профиль</Link>
    <div><p className="text-sm font-medium text-slate-500">Учебные результаты</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Мой семестр</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Оценки из Moodle по курсам выбранного семестра. Отчёт показывает текущее состояние курсов; это не архивный снимок на дату окончания семестра.</p></div>
    {!!periods?.periods.length && <Card padding="sm"><div className="flex flex-wrap items-end gap-3"><label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-semibold text-slate-700">Семестр<select value={period} onChange={event => { setResult(null); setPeriod(event.target.value); setPage(1); }} className={`${control} w-full max-w-full`}>
      {periods.periods.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
    </select></label><button type="button" className={control} onClick={refresh} disabled={loading}>Обновить</button></div></Card>}
    <section aria-label="Результаты семестра" aria-busy={loading}>
      {loading ? <p role="status" className="py-10 text-sm text-slate-600">Загружаем учебные результаты…</p>
        : error ? <Card><RequestState title="Оценки недоступны" description={error} onRetry={refresh} /></Card>
          : !periods?.available ? <Card padding="sm"><h2 className="font-semibold text-slate-900">Источник ещё не подключён</h2><p className="mt-2 text-sm text-slate-600">Вуз не подключил действующий источник оценок Moodle. Уточните подключение у администратора.</p></Card>
            : !periods.periods.length ? <Card padding="sm"><h2 className="font-semibold text-slate-900">Семестры ещё не настроены</h2><p className="mt-2 text-sm text-slate-600">Администратору нужно указать учебные периоды и соответствующие курсы Moodle.</p></Card>
              : result && !result.available ? <Card padding="sm"><h2 className="font-semibold text-slate-900">Данные пока недоступны</h2><p className="mt-2 text-sm text-slate-600">{result.message}</p></Card>
                : result && <div className="space-y-4">
                  <div className="break-words text-sm leading-6 text-slate-600"><p>Источник: Moodle · {result.source?.baseUrl}</p>{result.source?.fetchedAt && <p>Получено: {new Date(result.source.fetchedAt).toLocaleString('ru-RU')}</p>}<p>Курсов в отчёте: {result.meta.total}</p></div>
                  {!result.data.length && <Card padding="sm"><h2 className="font-semibold text-slate-900">Курсы не найдены</h2><p className="mt-2 text-sm text-slate-600">В этом периоде нет доступных вам курсов. Это не подтверждает отсутствие задолженностей.</p></Card>}
                  {result.data.map(course => <Card key={course.id} padding="sm"><h2 className="break-words text-lg font-semibold text-slate-900">{course.name || `Курс ${course.id}`}</h2>
                    {!course.available ? <p className="mt-3 text-sm text-slate-600">Источник закрыл доступ к оценкам курса.</p> : !course.grades.length ? <p className="mt-3 text-sm text-slate-600">Источник пока не передал оценки.</p> : <dl className="mt-3 divide-y divide-slate-100">{course.grades.map(grade => <div key={grade.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-6"><dt className="min-w-0 break-words text-sm text-slate-600">{grade.name || 'Итог курса'}</dt><dd className="break-words text-sm font-semibold text-slate-900 sm:text-right">{gradeValue(grade)}{!grade.hidden && !grade.stale && grade.raw !== null && grade.maximum !== null && <span className="ml-2 font-normal text-slate-500">из {grade.maximum}</span>}</dd></div>)}</dl>}
                  </Card>)}
                  {result.meta.totalPages > 1 && <nav aria-label="Страницы курсов" className="flex flex-wrap items-center gap-3"><button type="button" className={control} disabled={page <= 1} onClick={() => { setResult(null); setPage(value => value - 1); }}>Назад</button><span className="text-sm text-slate-600">{page} из {result.meta.totalPages}</span><button type="button" className={control} disabled={page >= result.meta.totalPages} onClick={() => { setResult(null); setPage(value => value + 1); }}>Далее</button></nav>}
                </div>}
    </section>
    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-semibold text-slate-900">Академические задолженности</h2><p className="mt-2 text-sm leading-6 text-slate-600">{result?.debtSource.message || 'Подтверждённый реестр задолженностей не подключён. Оценки Moodle сами по себе не определяют наличие или отсутствие задолженности.'}</p></aside>
  </div>;
}
