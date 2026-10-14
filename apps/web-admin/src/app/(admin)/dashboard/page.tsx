'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Badge, Button, Card, EmptyState, PageHeader, RequestState, Skeleton } from '@/components/ui';

interface AdminUser { id: string; firstName: string; lastName: string; role?: string; lastLoginAt?: string; isActive?: boolean; }
interface Group { id: string; name: string; }
interface Faculty { id: string; name: string; }
interface Lesson { id: string; startDate?:string; date?:string; startTime?: string; endTime?: string; subject?: string; groupName?: string; room?: string; teacherName?: string; isChanged?: boolean; changeDescription?: string; }
interface Notice { id?: string; title?: string; body?: string; type?: string; createdAt?: string; isRead?: boolean; }
interface Sync { status?: string; lastSync?: string | null; }
interface PendingAbsences { meta?: { total?: number }; }
interface UniversityStats { totalUsers: number; totalStudents: number; totalTeachers: number; totalLessons: number; activeToday: number; }
type BackendStatus = 'online' | 'offline' | 'unknown';

const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
const displayNumber = (value: number | null) => value === null ? 'Нет данных' : new Intl.NumberFormat('ru-RU').format(value);
const time = (value?: string) => value?.includes('T') ? value.slice(11, 16) : value || '—';
const formatDate = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Нет данных';

function isUpcoming(lesson: Lesson) {
  const date=lesson.startDate?.slice(0,10)||lesson.date||dateKey(new Date());
  const start = lesson.startTime ? new Date(lesson.startTime.includes('T')?lesson.startTime:`${date}T${lesson.startTime.slice(0,5)}`).getTime() : Number.POSITIVE_INFINITY;
  return start >= Date.now();
}

export default function DashboardPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [sync, setSync] = useState<Sync | null>(null);
  const [pendingAbsences, setPendingAbsences] = useState(0);
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [backend, setBackend] = useState<BackendStatus>('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState<string[]>([]);
  const [today, setToday] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const todayKey = dateKey(new Date());
    Promise.allSettled([
      apiFetchList<AdminUser>('/admin/users?limit=100'),
      apiFetchList<Group>('/admin/groups?limit=100'),
      apiFetchList<Faculty>('/admin/faculties?limit=100'),
      apiFetchList<Lesson>(`/schedule?date=${todayKey}&limit=100`),
      apiFetchList<Notice>('/notifications'),
      apiFetch<Sync>('/admin/schedule/sync-status'),
      apiFetch<PendingAbsences>('/absences/pending?limit=1'),
      apiFetch<UniversityStats>('/admin/stats'),
      apiFetch<{ status: string }>('/health'),
    ]).then((results) => {
      const failed: string[] = [];
      const value = <T,>(index: number, label: string, fallback: T): T => {
        const result = results[index];
        if (result.status === 'fulfilled') return result.value as T;
        failed.push(label);
        return fallback;
      };
      setUsers(value(0, 'пользователи', []));
      setGroups(value(1, 'группы', []));
      setFaculties(value(2, 'факультеты', []));
      setLessons(value(3, 'расписание', []));
      setNotices(value(4, 'уведомления', []));
      setSync(value<Sync | null>(5, 'синхронизация', null));
      setPendingAbsences(value<PendingAbsences>(6, 'обращения об отсутствии', {}).meta?.total || 0);
      setStats(value<UniversityStats | null>(7, 'статистика ВУЗа', null));
      setBackend(results[8].status === 'fulfilled' ? 'online' : 'offline');
      if (results[8].status === 'rejected') failed.push('статус backend');
      setPartial(failed);
      if (failed.length === results.length) setError('Не удалось загрузить операционную сводку.');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setToday(dateKey(new Date())); load(); }, [load]);

  const currentDate = today ? new Date(`${today}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Сегодня';
  const students = stats?.totalStudents ?? null;
  const teachers = stats?.totalTeachers ?? null;
  const activeToday = stats?.activeToday ?? null;
  const unread = partial.includes('уведомления') ? null : notices.filter((notice) => notice.isRead === false).length;
  const nextLesson = lessons.filter(isUpcoming).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))[0];
  const nextLessons = lessons.filter((lesson) => lesson.id !== nextLesson?.id).slice(0, 4);
  const changedLessons = partial.includes('расписание') ? null : lessons.filter((lesson) => lesson.isChanged).length;
  const deadlines = notices.filter((notice) => notice.type?.toLowerCase().includes('deadline') || notice.type?.toLowerCase().includes('import')).slice(0, 3);
  const problems = useMemo(() => [
    { label: 'Занятия без аудитории', value: partial.includes('расписание') ? null : lessons.filter((lesson) => !lesson.room).length, href: '/schedule-import' },
    { label: 'Преподаватели не сопоставлены', value: partial.includes('расписание') ? null : lessons.filter((lesson) => !lesson.teacherName).length, href: '/users?role=teacher' },
    { label: 'События с ошибками', value: partial.includes('уведомления') ? null : notices.filter((notice) => (notice.type || '').toLowerCase().includes('error')).length, href: '/notifications' },
    { label: 'Ожидают подтверждения отсутствий', value: partial.includes('обращения об отсутствии') ? null : pendingAbsences, href: '/absences' },
  ], [lessons, notices, pendingAbsences, partial]);
  const attentionQueue = problems.filter((problem) => problem.value !== null && problem.value > 0);
  const openProblems = problems.reduce((sum, item) => sum + (item.value || 0), 0);
  const incompleteProblems = problems.some((problem) => problem.value === null);
  const syncLabel = sync?.status === 'error' ? 'Ошибка' : sync?.status === 'synced' || sync?.status === 'active' ? 'Синхронизировано' : 'Нет данных';

  if (loading) return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6" aria-busy="true" aria-label="Загрузка dashboard"><Skeleton className="h-28" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]"><Skeleton className="h-72" /><Skeleton className="h-72" /></div><Skeleton className="h-48" /></div>;
  if (error && !users.length && !lessons.length) return <div className="mx-auto max-w-[var(--layout-content-max)]"><RequestState title="Не удалось загрузить сводку ВУЗа" description={error} onRetry={load} /></div>;

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6"><a href="/career" className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)]"><span>Практика и работа</span><span>Открыть карьерный кабинет →</span></a>
    <PageHeader eyebrow="Кабинет ВУЗа" title="Состояние учебного дня" description={currentDate} actions={<><Badge variant={backend === 'online' ? 'green' : backend === 'offline' ? 'red' : 'slate'} dot>{backend === 'online' ? 'Система работает' : backend === 'offline' ? 'Не удалось проверить API' : 'Проверяем систему'}</Badge><Link href="/schedule-import"><Button size="sm">Обновить расписание</Button></Link></>} />

    {partial.length > 0 && <div role="status" className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">Часть данных недоступна: {partial.join(', ')}. Показаны доступные сведения.</div>}

    <section aria-labelledby="priority-title" className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
      <Card padding="lg" className="border-[var(--color-brand)] bg-[var(--color-brand-soft)]"><div className="flex flex-col justify-between gap-6 sm:flex-row"><div><Badge variant="indigo">Требует внимания</Badge><h2 id="priority-title" className="mt-4 ds-section-title">{openProblems ? `${displayNumber(openProblems)} сигнал${openProblems === 1 ? '' : 'а'} требуют решения` : incompleteProblems ? 'Не все данные доступны для проверки' : 'В доступных данных сигналов не найдено'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">Сигналы собраны из загруженных занятий и событий ВУЗа. Сначала устраните причины, которые могут затронуть занятия и пользователей.</p></div><div className="flex shrink-0 items-start"><Link href={openProblems ? attentionQueue[0]?.href || '/schedule-import' : '/notifications'}><Button>{openProblems ? 'Открыть первый сигнал' : 'Проверить события'}</Button></Link></div></div><div className="mt-6 grid gap-2 sm:grid-cols-2">{problems.map((problem) => <Link key={problem.label} href={problem.href} className="rounded-[var(--radius-md)] bg-[var(--color-surface)]/70 p-3 transition-colors hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]"><p className="text-xs text-[var(--color-text-secondary)]">{problem.label}</p><p className="mt-1 text-xl font-bold text-[var(--color-text)]">{displayNumber(problem.value)}</p></Link>)}</div></Card>
      <Card padding="lg"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--color-text-muted)]">Пульс учебного дня</p><h2 className="mt-2 ds-card-title">{nextLesson?.subject || (partial.includes('расписание') ? 'Расписание недоступно' : 'Нет ближайших занятий')}</h2></div>{nextLesson && <Badge variant={nextLesson.isChanged ? 'amber' : 'green'}>{nextLesson.isChanged ? 'Изменено' : 'По плану'}</Badge>}</div>{nextLesson ? <><p className="mt-4 text-2xl font-bold text-[var(--color-brand)]">{time(nextLesson.startTime)}–{time(nextLesson.endTime)}</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{nextLesson.groupName || 'Группа не указана'} · ауд. {nextLesson.room || 'не назначена'}</p></> : <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{partial.includes('расписание') ? 'Не удалось загрузить расписание. Повторите проверку.' : 'На сегодня новых занятий нет.'}</p>}<div className="mt-5 flex items-center justify-between border-t pt-4 text-sm"><span className="text-[var(--color-text-secondary)]">Изменений сегодня</span><span className="font-semibold text-[var(--color-text)]">{displayNumber(changedLessons)}</span></div><Link href="/schedule-import" className="mt-4 block text-sm font-semibold text-[var(--color-brand)]">Открыть контроль расписания →</Link></Card>
    </section>

    <section aria-labelledby="today-title" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]"><Card padding="sm"><div className="flex items-center justify-between gap-3 border-b pb-3"><div><h2 id="today-title" className="ds-card-title">Расписание ВУЗа на сегодня</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Ближайшие занятия и изменения, требующие внимания.</p></div><Badge variant="slate">{partial.includes('расписание') ? 'Нет данных' : lessons.length + ' занятий'}</Badge></div>{nextLessons.length ? <div className="divide-y">{nextLessons.map((lesson) => <div key={lesson.id} className="flex gap-4 py-4"><div className="w-16 shrink-0 text-sm font-semibold text-[var(--color-brand)]">{time(lesson.startTime)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--color-text)]">{lesson.subject || 'Без названия'}</p><p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{lesson.groupName || 'Группа не указана'} · ауд. {lesson.room || 'не назначена'}</p></div>{lesson.isChanged && <Badge variant="amber">Изменено</Badge>}</div>)}</div> : <EmptyState title={partial.includes('расписание') ? 'Расписание недоступно' : 'Других занятий нет'} description={partial.includes('расписание') ? 'Повторите загрузку, чтобы увидеть занятия.' : 'Нет других занятий для отображения.'} />}</Card><div className="space-y-6"><Card padding="sm"><div className="flex items-center justify-between"><h2 className="ds-card-title">События ВУЗа</h2><Badge variant={unread ? 'red' : 'slate'}>{unread === null ? 'Нет данных' : unread}</Badge></div>{notices.length ? <div className="mt-2 divide-y">{notices.slice(0, 3).map((notice, index) => <Link key={notice.id || index} href="/notifications" className="block py-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-soft)]"><p className="truncate text-sm font-medium text-[var(--color-text)]">{notice.title || 'Системное событие'}</p><p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{notice.body || 'Открыть уведомление для подробностей'}</p></Link>)}</div> : <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{partial.includes('уведомления') ? 'События не загрузились.' : 'Новых событий нет.'}</p>}<Link href="/notifications" className="mt-3 block text-sm font-semibold text-[var(--color-brand)]">Открыть все события →</Link></Card>
      <Card padding="sm"><h2 className="ds-card-title">Быстрые действия</h2><div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1"><Link href="/absences"><Button variant="secondary" fullWidth>Обращения об отсутствии{pendingAbsences ? ` · ${pendingAbsences}` : ''}</Button></Link><Link href="/users"><Button variant="secondary" fullWidth>Пользователи</Button></Link><Link href="/connectors"><Button variant="secondary" fullWidth>Источники данных</Button></Link><Link href="/audit-log"><Button variant="secondary" fullWidth>Журнал аудита</Button></Link></div></Card></div></section>

    <details className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4"><summary className="cursor-pointer text-sm font-semibold">Показатели структуры и доступности</summary><section aria-labelledby="secondary-title" className="mt-4"><div className="mb-3 flex items-center justify-between"><div><h2 id="secondary-title" className="text-sm font-semibold uppercase tracking-[.1em] text-[var(--color-text-secondary)]">Контур ВУЗа</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Базовые показатели доступности и структуры.</p></div><Link href="/structure" className="text-sm font-semibold text-[var(--color-brand)]">Открыть структуру →</Link></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[{ label: 'Пользователи', value: stats?.totalUsers ?? 'Нет данных' }, { label: 'Активны сегодня', value: activeToday }, { label: 'Студенты', value: students }, { label: 'Преподаватели', value: teachers }, { label: 'Группы', value: partial.includes('группы') ? 'Нет данных' : groups.length }, { label: 'Факультеты', value: partial.includes('факультеты') ? 'Нет данных' : faculties.length }, { label: 'Занятия в базе', value: stats?.totalLessons ?? '—' }, { label: 'Непрочитанные', value: unread }, { label: 'Синхронизация', value: syncLabel }].map((metric) => <Card key={metric.label} padding="sm"><p className="truncate text-xs text-[var(--color-text-secondary)]">{metric.label}</p><p className="mt-2 truncate text-xl font-bold text-[var(--color-text)]">{metric.value === null ? 'Нет данных' : typeof metric.value === 'number' ? displayNumber(metric.value) : metric.value}</p></Card>)}</div></section></details>

    {deadlines.length > 0 && <section aria-labelledby="deadlines-title"><h2 id="deadlines-title" className="mb-3 text-sm font-semibold uppercase tracking-[.1em] text-[var(--color-text-secondary)]">Важные сроки и подсказки</h2><div className="grid gap-3 md:grid-cols-3">{deadlines.map((notice, index) => <Link key={notice.id || index} href="/notifications" className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-brand)]"><p className="text-sm font-semibold text-[var(--color-text)]">{notice.title || 'Проверьте событие'}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{notice.createdAt ? formatDate(notice.createdAt) : 'Требует проверки'}</p></Link>)}</div></section>}

    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-secondary)]"><span>Синхронизация: {formatDateTime(sync?.lastSync || undefined)}</span><span>Статус: {syncLabel}</span><Link href="/connectors" className="font-semibold text-[var(--color-brand)]">Настроить источник данных</Link></footer>
  </div>;
}
