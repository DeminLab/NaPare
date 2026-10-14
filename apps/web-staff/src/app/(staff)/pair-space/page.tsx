'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetchList } from '@/lib/api';
import { Badge, Button, Card, EmptyState, PageHeader, RequestState, Skeleton } from '@/components/ui';

interface Lesson { id: string; subject: string; startTime: string; endTime: string; startDate?: string; date?: string; groupName?: string; room?: string; isChanged?: boolean; }
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const lessonDate=(lesson:Lesson)=>lesson.startDate?.slice(0,10)||lesson.date||(lesson.startTime.includes('T')?lesson.startTime.slice(0,10):'');
const lessonTime=(lesson:Lesson)=>lesson.startTime.includes('T')?lesson.startTime.slice(11,16):lesson.startTime.slice(0,5);
const lessonLabel=(lesson:Lesson)=>{const date=lessonDate(lesson);return date?`${new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} · ${lessonTime(lesson)}`:lessonTime(lesson);};

export default function PairSpaceIndex() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const start = new Date(); start.setDate(start.getDate() - 7);
    const end = new Date(); end.setDate(end.getDate() + 14);
    setLoading(true); setError('');
    try { setLessons(await apiFetchList<Lesson>(`/schedule/range?startDate=${dateKey(start)}&endDate=${dateKey(end)}&limit=100`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить занятия.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => lessons.filter(lesson => `${lesson.subject} ${lesson.groupName || ''}`.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'))).sort((a, b) => (lessonDate(a)+lessonTime(a)).localeCompare(lessonDate(b)+lessonTime(b))), [lessons, query]);
  const today = dateKey(new Date());
  const upcoming = visible.filter(lesson => lessonDate(lesson) >= today);
  const recent = visible.filter(lesson => lessonDate(lesson) < today).reverse();
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader eyebrow="Работа с группой" title="Занятия и материалы" description="Выберите конкретную пару, чтобы опубликовать объявление, подготовку или ссылку на материал." actions={<Link href="/week" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold text-[var(--color-brand)]">Всё расписание →</Link>} />
    <label className="block"><span className="mb-2 block text-sm font-medium">Найти занятие</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Предмет или группа…" className="min-h-11 w-full rounded-xl border bg-[var(--color-surface)] px-4 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]" /></label>
    {loading ? <div className="space-y-3" aria-busy="true"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : error ? <RequestState title="Занятия недоступны" description={error} onRetry={() => void load()} /> : !visible.length ? <EmptyState title={query ? 'Совпадений нет' : 'Занятий в ближайшем расписании нет'} description={query ? 'Измените запрос или сбросьте поиск.' : 'Выберите другой период в расписании.'} action={query ? <Button variant="secondary" onClick={() => setQuery('')}>Сбросить поиск</Button> : undefined} /> : [{ title: 'Сегодня и ближайшие две недели', items: upcoming }, { title: 'Недавние занятия', items: recent }].filter(section => section.items.length).map(section => <section key={section.title} className="space-y-3"><h2 className="text-lg font-semibold">{section.title}</h2>{section.items.map(lesson => <Card key={lesson.id} padding="sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><time dateTime={lessonDate(lesson)?lessonDate(lesson)+'T'+lessonTime(lesson):undefined} className="text-sm font-medium text-[var(--color-text-secondary)]">{lessonLabel(lesson)}</time>{lesson.isChanged && <Badge variant="warning">Изменено</Badge>}</div><h3 className="mt-2 break-words text-base font-semibold">{lesson.subject}</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{lesson.groupName || 'Группа не указана'} · {lesson.room ? `ауд. ${lesson.room}` : 'Аудитория не указана'}</p></div><div className="flex flex-wrap gap-2"><Link href={`/attendance?lesson=${lesson.id}`} className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold text-[var(--color-brand)]">Посещаемость</Link><Link href={`/pair-space/${lesson.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-strong)]">Открыть занятие</Link></div></div></Card>)}</section>)}
  </div>;
}
