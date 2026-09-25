'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, RequestState, Sheet, Skeleton } from '@/components/ui';

interface Lesson { id: string; subject: string; subjectType?: string; startTime: string; endTime: string; groupName?: string; teacherName?: string; }
interface Homework { id: string; title: string; description?: string; deadline?: string; isCompleted?: boolean; priority?: string; progress?: number; }
interface PairSpaceSummary { lessonId: string; homeworks?: Homework[]; }
interface MyDayResponse { lessons: Lesson[]; pairSpaces?: PairSpaceSummary[]; }
interface FileItem { id?: string; fileName?: string; fileUrl?: string; fileType?: string; }
interface PairSpace { homeworks?: Homework[]; files?: FileItem[]; }
type View = 'today' | 'overdue' | 'upcoming' | 'all' | 'completed';
type Sort = 'deadline' | 'priority' | 'subject';

const views: Array<{ id: View; label: string }> = [{ id: 'today', label: 'Сегодня' }, { id: 'overdue', label: 'Просроченные' }, { id: 'upcoming', label: 'Ближайшие' }, { id: 'all', label: 'Все' }, { id: 'completed', label: 'Выполненные' }];
const priorityRank: Record<string, number> = { high: 3, urgent: 3, medium: 2, low: 1 };
const priorityLabel: Record<string, string> = { high: 'Высокий приоритет', urgent: 'Срочно', medium: 'Средний приоритет', low: 'Низкий приоритет' };
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'Без дедлайна';
const isSameDay = (value?: string) => Boolean(value && new Date(value).toDateString() === new Date().toDateString());

export default function AssignmentsPage() {
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('today');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('deadline');
  const [groupBySubject, setGroupBySubject] = useState(false);
  const [selected, setSelected] = useState<{ homework: Homework; lesson?: Lesson } | null>(null);
  const [detail, setDetail] = useState<PairSpace | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = () => { setLoading(true); setError(''); apiFetch<MyDayResponse>('/my-day').then(setDay).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить задания.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const lessons = day?.lessons || [];
  const assignments = useMemo(() => (day?.pairSpaces || []).flatMap((space) => (space.homeworks || []).map((homework) => ({ homework, lesson: lessons.find((lesson) => lesson.id === space.lessonId) }))), [day, lessons]);
  const now = Date.now();
  const visible = useMemo(() => assignments.filter(({ homework }) => {
    const deadline = homework.deadline ? new Date(homework.deadline).getTime() : Number.POSITIVE_INFINITY;
    const completed = Boolean(homework.isCompleted);
    const matchesView = view === 'completed' ? completed : view === 'overdue' ? !completed && deadline < now : view === 'upcoming' ? !completed && deadline >= now && !isSameDay(homework.deadline) : view === 'today' ? !completed && isSameDay(homework.deadline) : true;
    const text = `${homework.title} ${homework.description || ''}`.toLowerCase();
    return matchesView && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }).sort((a, b) => sort === 'subject' ? (a.lesson?.subject || '').localeCompare(b.lesson?.subject || '') : sort === 'priority' ? (priorityRank[b.homework.priority || 'medium'] || 2) - (priorityRank[a.homework.priority || 'medium'] || 2) : (new Date(a.homework.deadline || '9999-12-31').getTime() - new Date(b.homework.deadline || '9999-12-31').getTime())), [assignments, now, query, sort, view]);
  const grouped = useMemo(() => visible.reduce<Record<string, typeof visible>>((result, item) => { const key = item.lesson?.subject || 'Без предмета'; (result[key] ||= []).push(item); return result; }, {}), [visible]);

  const openDetail = (item: { homework: Homework; lesson?: Lesson }) => { setSelected(item); setDetail(null); if (!item.lesson) return; setDetailLoading(true); apiFetch<PairSpace>(`/pair-spaces/${item.lesson.id}`).then(setDetail).catch(() => setDetail(null)).finally(() => setDetailLoading(false)); };
  const complete = async (item = selected) => { if (!item || submitting) return; setActionError(''); setSubmitting(true); try { await apiFetch(`/pair-spaces/homeworks/${item.homework.id}/submit`, { method: 'PATCH', body: JSON.stringify({}) }); setDay((current) => current ? { ...current, pairSpaces: current.pairSpaces?.map((space) => ({ ...space, homeworks: space.homeworks?.map((homework) => homework.id === item.homework.id ? { ...homework, isCompleted: true } : homework) })) } : current); setSelected((current) => current?.homework.id === item.homework.id ? { ...current, homework: { ...current.homework, isCompleted: true } } : current); } catch (err) { setActionError(err instanceof Error ? err.message : 'Не удалось обновить статус задания.'); } finally { setSubmitting(false); } };

  if (loading) return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-5" aria-busy="true" aria-label="Загрузка заданий"><Skeleton className="h-24" /><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (error) return <div className="mx-auto max-w-[var(--layout-content-max)]"><RequestState title="Не удалось загрузить задания" description={error} onRetry={load} /></div>;

  const countFor = (id: View) => assignments.filter(({ homework }) => id === 'completed' ? homework.isCompleted : id === 'overdue' ? !homework.isCompleted && Boolean(homework.deadline && new Date(homework.deadline).getTime() < now) : id === 'today' ? !homework.isCompleted && isSameDay(homework.deadline) : id === 'upcoming' ? !homework.isCompleted && Boolean(homework.deadline && new Date(homework.deadline).getTime() >= now && !isSameDay(homework.deadline)) : true).length;
  const list = (items: typeof visible) => items.map(({ homework, lesson }) => { const overdue = !homework.isCompleted && homework.deadline && new Date(homework.deadline).getTime() < now; return <button type="button" key={homework.id} onClick={() => openDetail({ homework, lesson })} className="group block w-full border-b px-1 py-4 text-left transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]"><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${homework.isCompleted ? 'bg-[var(--color-success)]' : overdue ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-brand)]'}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`font-semibold ${homework.isCompleted ? 'text-[var(--color-text-secondary)] line-through' : 'text-[var(--color-text)]'}`}>{homework.title}</h3>{homework.priority && <Badge variant={homework.priority === 'high' || homework.priority === 'urgent' ? 'red' : homework.priority === 'low' ? 'slate' : 'amber'}>{priorityLabel[homework.priority] || homework.priority}</Badge>}</div><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{lesson?.subject || 'Предмет не указан'}{lesson?.groupName ? ` · ${lesson.groupName}` : ''}</p></div><div className="shrink-0 text-right"><p className={`text-xs font-semibold ${overdue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>{dateLabel(homework.deadline)}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{homework.isCompleted ? 'Выполнено' : 'Открыть →'}</p></div></div>{typeof homework.progress === 'number' && <div className="mt-3 ml-5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-tertiary)]"><div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${Math.min(100, Math.max(0, homework.progress))}%` }} /></div>}</button>; });

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[.1em] text-[var(--color-brand)]">Личная рабочая область</p><h1 className="ds-page-title">Задания</h1><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Соберите следующий шаг, не теряя дедлайны.</p></div><Link href="/today"><Button variant="secondary">Открыть мой день</Button></Link></header>
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Фильтр заданий">{views.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium ${view === item.id ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}>{item.label}<span className="ml-1.5 text-xs">{countFor(item.id)}</span></button>)}</nav>
    <Card padding="sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><Input aria-label="Поиск заданий" placeholder="Поиск по названию или предмету" value={query} onChange={(event) => setQuery(event.target.value)} className="lg:max-w-sm" /><div className="flex flex-wrap gap-2"><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Сортировка" className="min-h-11 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 text-sm"><option value="deadline">По дедлайну</option><option value="priority">По приоритету</option><option value="subject">По предмету</option></select><Button variant={groupBySubject ? 'primary' : 'secondary'} size="sm" onClick={() => setGroupBySubject((value) => !value)}>{groupBySubject ? 'Группировка включена' : 'Группировать'}</Button></div></div></Card>
    <section aria-live="polite">{!visible.length ? <EmptyState title={view === 'today' ? 'На сегодня заданий нет' : 'Задания не найдены'} description={query ? 'Измените поисковый запрос или сбросьте фильтр.' : 'Новые задания появятся здесь из пространств пар.'} action={query ? <Button variant="secondary" onClick={() => setQuery('')}>Сбросить поиск</Button> : undefined} /> : groupBySubject ? <div className="space-y-6">{Object.entries(grouped).map(([subject, items]) => <Card key={subject} padding="sm"><h2 className="border-b pb-3 text-sm font-semibold text-[var(--color-text)]">{subject}<span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">{items.length}</span></h2>{list(items)}</Card>)}</div> : <Card padding="sm">{list(visible)}</Card>}</section>
    <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.homework.title} side="right"><div className="space-y-5">{selected && <><div className="flex flex-wrap gap-2"><Badge variant={selected.homework.isCompleted ? 'green' : 'indigo'}>{selected.homework.isCompleted ? 'Выполнено' : 'В работе'}</Badge>{selected.homework.priority && <Badge variant="amber">{priorityLabel[selected.homework.priority] || selected.homework.priority}</Badge>}</div><div className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 text-sm"><p><span className="text-[var(--color-text-secondary)]">Предмет:</span> {selected.lesson?.subject || 'Не указан'}</p><p><span className="text-[var(--color-text-secondary)]">Преподаватель:</span> {selected.lesson?.teacherName || 'Не указан'}</p><p><span className="text-[var(--color-text-secondary)]">Дедлайн:</span> {dateLabel(selected.homework.deadline)}</p><p><span className="text-[var(--color-text-secondary)]">Связанная пара:</span> {selected.lesson ? <Link className="font-semibold text-[var(--color-brand)]" href={`/pair-space/${selected.lesson.id}`}>Открыть пространство</Link> : 'Не указана'}</p></div><div><h3 className="text-sm font-semibold text-[var(--color-text)]">Описание</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">{selected.homework.description || 'Описание не добавлено.'}</p></div>{detailLoading ? <Skeleton className="h-20" /> : detail?.files?.length ? <div><h3 className="text-sm font-semibold text-[var(--color-text)]">Материалы</h3><div className="mt-2 space-y-2">{detail.files.map((file, index) => <a key={file.id || index} href={file.fileUrl || '#'} target="_blank" rel="noreferrer" className="block rounded-[var(--radius-md)] border p-3 text-sm text-[var(--color-brand)] hover:bg-[var(--color-surface-secondary)]">{file.fileName || 'Материал'}</a>)}</div></div> : <p className="text-sm text-[var(--color-text-secondary)]">Материалы не прикреплены.</p>}{actionError && <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]">{actionError}</p>}{!selected.homework.isCompleted && <Button fullWidth loading={submitting} onClick={() => complete()}>Отметить выполненным</Button>}</>}</div></Sheet>
  </div>;
}
