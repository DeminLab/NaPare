'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchList, type PaginatedResponse } from '@/lib/api';
import { Badge, Button, Card, EmptyState, LessonTypeBadge, PageHeader, RequestState, Skeleton } from '@/components/ui';

interface AdminUser { id: string; firstName: string; lastName: string; role?: string; lastLoginAt?: string; isActive?: boolean; }
interface Group { id: string; name: string; }
interface Faculty { id: string; name: string; }
interface Lesson { id: string; startDate?:string; date?:string; startTime?: string; endTime?: string; subject?: string; subjectType?: string; groupName?: string; room?: string; teacherName?: string; isChanged?: boolean; changeDescription?: string; }
interface Notice { id?: string; title?: string; body?: string; type?: string; createdAt?: string; isRead?: boolean; }
interface Sync { status?: string; lastSync?: string | null; }
interface PendingAbsences { meta?: { total?: number }; }
interface UniversityStats { totalUsers: number; totalStudents: number; totalTeachers: number; totalLessons: number; activeToday: number; }
type BackendStatus = 'online' | 'offline' | 'unknown';

const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
const displayNumber = (value: number | null) => value === null ? 'Нет данных' : new Intl.NumberFormat('ru-RU').format(value);
const time = (value?: string) => value?.includes('T') ? value.slice(11, 16) : value || '—';
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Нет данных';

function isUpcoming(lesson: Lesson) {
  const date=lesson.startDate?.slice(0,10)||lesson.date||dateKey(new Date());
  const start = lesson.startTime ? new Date(lesson.startTime.includes('T')?lesson.startTime:`${date}T${lesson.startTime.slice(0,5)}`).getTime() : Number.POSITIVE_INFINITY;
  return start >= Date.now();
}

export default function DashboardPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groupsTotal, setGroupsTotal] = useState<number | null>(null);
  const [facultiesTotal, setFacultiesTotal] = useState<number | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [sync, setSync] = useState<Sync | null>(null);
  const [pendingAbsences, setPendingAbsences] = useState(0);
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [backend, setBackend] = useState<BackendStatus>('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState<string[]>([]);
  const [loadedSections, setLoadedSections] = useState<string[]>([]);
  const [today, setToday] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((showPageLoader = true) => {
    if (showPageLoader) setLoading(true);
    setRefreshing(true);
    setError('');
    const todayKey = dateKey(new Date());
    Promise.allSettled([
      apiFetchList<AdminUser>('/admin/users?limit=100'),
      apiFetch<PaginatedResponse<Group>>('/admin/groups?limit=1'),
      apiFetch<PaginatedResponse<Faculty>>('/admin/faculties?limit=1'),
      apiFetchList<Lesson>(`/schedule?date=${todayKey}&limit=100`),
      apiFetchList<Notice>('/notifications'),
      apiFetch<number>('/notifications/unread-count'),
      apiFetch<Sync>('/admin/schedule/sync-status'),
      apiFetch<PendingAbsences>('/absences/pending?limit=1'),
      apiFetch<UniversityStats>('/admin/stats'),
      apiFetch<{ status: string }>('/health'),
    ]).then((results) => {
      const failed: string[] = [];
      const succeeded: string[] = [];
      const update = <T,>(index: number, label: string, setValue: (value: T) => void) => {
        const result = results[index];
        if (result.status === 'rejected') {
          failed.push(label);
          return;
        }
        setValue(result.value as T);
        succeeded.push(label);
      };
      update<AdminUser[]>(0, 'пользователи', setUsers);
      update<PaginatedResponse<Group>>(1, 'группы', (value) => setGroupsTotal(value.meta.total));
      update<PaginatedResponse<Faculty>>(2, 'факультеты', (value) => setFacultiesTotal(value.meta.total));
      update<Lesson[]>(3, 'расписание', setLessons);
      update<Notice[]>(4, 'уведомления', setNotices);
      update<number | null>(5, 'непрочитанные уведомления', setUnreadCount);
      update<Sync | null>(6, 'синхронизация', setSync);
      update<PendingAbsences>(7, 'обращения об отсутствии', (value) => setPendingAbsences(value.meta?.total || 0));
      update<UniversityStats | null>(8, 'статистика ВУЗа', setStats);
      setLoadedSections((current) => [...new Set([...current, ...succeeded])]);
      setBackend(results[9].status === 'fulfilled' ? 'online' : 'offline');
      if (results[9].status === 'rejected') failed.push('статус backend');
      setPartial(failed);
      if (failed.length === results.length) setError('Не удалось загрузить операционную сводку.');
    }).finally(() => {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
    });
  }, []);

  useEffect(() => { setToday(dateKey(new Date())); load(); }, [load]);

  const currentDate = today ? new Date(`${today}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Сегодня';
  const hasLoaded = useCallback((section: string) => loadedSections.includes(section), [loadedSections]);
  const students = stats?.totalStudents ?? null;
  const teachers = stats?.totalTeachers ?? null;
  const activeToday = stats?.activeToday ?? null;
  const unread = hasLoaded('непрочитанные уведомления') ? unreadCount : null;
  const nextLesson = hasLoaded('расписание') ? lessons.filter(isUpcoming).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))[0] : undefined;
  const nextLessons = hasLoaded('расписание') ? lessons.filter(isUpcoming).filter((lesson) => lesson.id !== nextLesson?.id).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).slice(0, 4) : [];
  const changedLessons = hasLoaded('расписание') ? lessons.filter((lesson) => lesson.isChanged).length : null;
  const problems = useMemo(() => [
    { label: 'Занятия без аудитории', value: hasLoaded('расписание') ? lessons.filter((lesson) => !lesson.room).length : null, href: '/schedule-import' },
    { label: 'Преподаватели не сопоставлены', value: hasLoaded('расписание') ? lessons.filter((lesson) => !lesson.teacherName).length : null, href: '/users?role=teacher' },
    { label: 'Ожидают подтверждения отсутствий', value: hasLoaded('обращения об отсутствии') ? pendingAbsences : null, href: '/absences' },
  ], [lessons, pendingAbsences, hasLoaded]);
  const attentionQueue = problems.filter((problem) => problem.value !== null && problem.value > 0);
  const openProblems = problems.reduce((sum, item) => sum + (item.value || 0), 0);
  const incompleteProblems = problems.some((problem) => problem.value === null);
  const syncLabel = sync?.status === 'error' ? 'Ошибка' : sync?.status === 'active' ? 'Источник активен' : sync?.status === 'synced' ? 'Синхронизировано' : 'Нет данных';

  if (loading) return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6" aria-busy="true" aria-label="Загрузка dashboard"><Skeleton className="h-28" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]"><Skeleton className="h-72" /><Skeleton className="h-72" /></div><Skeleton className="h-48" /></div>;
  if (error && !loadedSections.length) return <div className="mx-auto max-w-[var(--layout-content-max)]"><RequestState title="Не удалось загрузить сводку ВУЗа" description={error} onRetry={load} /></div>;

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
    <PageHeader title="Обзор ВУЗа" description={currentDate} actions={<><Badge variant={backend === 'online' ? 'green' : backend === 'offline' ? 'red' : 'slate'} dot>{backend === 'online' ? 'Система работает' : backend === 'offline' ? 'Нет связи с системой' : 'Проверяем систему'}</Badge><Button variant="secondary" loading={refreshing} onClick={() => load(false)}>Обновить данные</Button></>} />
    {lastUpdated && <p className="-mt-4 text-xs text-[var(--color-text-secondary)]">Последняя проверка данных: {formatDateTime(lastUpdated.toISOString())}</p>}

    <section aria-label="Ключевые показатели ВУЗа" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        { label: 'Пользователи', value: stats?.totalUsers ?? (hasLoaded('пользователи') ? users.length : null), href: '/users', detail: 'Учетные записи' },
        { label: 'Факультеты', value: hasLoaded('факультеты') ? facultiesTotal : null, href: '/structure', detail: 'В структуре' },
        { label: 'Группы', value: hasLoaded('группы') ? groupsTotal : null, href: '/structure', detail: 'Учебные группы' },
        { label: 'Требуют решения', value: hasLoaded('обращения об отсутствии') ? pendingAbsences : null, href: '/absences', detail: 'Обращения студентов' },
        { label: 'Источник данных', value: syncLabel, href: '/connectors', detail: sync?.lastSync ? `Обновлён ${formatDateTime(sync.lastSync)}` : 'Состояние расписания' },
      ].map((metric) => <Link key={metric.label} href={metric.href} className="group rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)] sm:p-5">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{metric.label}</p>
        <p className="mt-3 truncate text-2xl font-bold tracking-tight text-[var(--color-text)]">{typeof metric.value === 'number' ? displayNumber(metric.value) : metric.value ?? 'Нет данных'}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{metric.detail}<span aria-hidden="true" className="ml-2 text-[var(--color-brand)]">→</span></p>
      </Link>)}
    </section>

    {partial.length > 0 && <div role="status" className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">Не удалось получить свежие данные: {partial.join(', ')}. Для этих разделов могут отображаться последние успешно загруженные значения.</div>}

    <section aria-labelledby="priority-title" className={openProblems || incompleteProblems ? "grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]" : "space-y-4"}>
      {(openProblems || incompleteProblems) ? <Card padding="lg" className="review-priority border-[var(--color-border)] bg-white"><div className="flex flex-col justify-between gap-6 sm:flex-row"><div><Badge variant="indigo">Требует внимания</Badge><h2 id="priority-title" className="mt-2 ds-section-title">{openProblems ? `Требуют решения: ${displayNumber(openProblems)}` : incompleteProblems ? 'Не все данные доступны для проверки' : 'Нет срочных задач'}</h2></div><div className="flex shrink-0 items-start"><Link href={openProblems ? attentionQueue[0]?.href || '/schedule-import' : '/notifications'} className="role-link role-link-primary">{openProblems ? 'Открыть первый пункт' : 'Проверить события'}</Link></div></div><div className="mt-6 grid gap-2 sm:grid-cols-2">{problems.filter(problem => problem.value === null || problem.value > 0).map((problem) => <Link key={problem.label} href={problem.href} className="rounded-[var(--radius-md)] bg-[var(--color-surface)]/70 p-3 transition-colors hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><p className="text-xs text-[var(--color-text-secondary)]">{problem.label}</p><p className="mt-1 text-xl font-bold text-[var(--color-text)]">{displayNumber(problem.value)}</p></Link>)}</div></Card> : <p id="priority-title" role="status" className="text-sm text-[var(--color-success)]">Нет срочных задач</p>}
      <Card padding="lg" className="work-next"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-[var(--color-brand)]">Ближайшее занятие</p><Link href="/schedule-import" aria-label="Открыть контроль расписания" className="inline-flex min-h-6 shrink-0 items-center rounded px-1 text-xs font-semibold text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]">Расписание →</Link></div><h2 className="mt-0 ds-card-title">{nextLesson?.subject || (partial.includes('расписание') && !hasLoaded('расписание') ? 'Расписание недоступно' : 'Нет ближайших занятий')}</h2>{nextLesson && <div className="mt-1"><LessonTypeBadge subjectType={nextLesson.subjectType} /></div>}</div>{nextLesson && <Badge variant={nextLesson.isChanged ? 'amber' : 'green'}>{nextLesson.isChanged ? 'Изменено' : 'По плану'}</Badge>}</div>{nextLesson ? <><p className="mt-4 text-2xl font-bold text-[var(--color-brand)]">{time(nextLesson.startTime)}–{time(nextLesson.endTime)}</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{nextLesson.groupName || 'Группа не указана'} · ауд. {nextLesson.room || 'не назначена'}</p></> : <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{partial.includes('расписание') && !hasLoaded('расписание') ? 'Не удалось загрузить расписание. Повторите проверку.' : 'На сегодня новых занятий нет.'}</p>}{changedLessons !== 0 && <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm"><span className="text-[var(--color-text-secondary)]">Изменений сегодня</span><span className="font-semibold text-[var(--color-text)]">{displayNumber(changedLessons)}</span></div>}</Card>
    </section>

    <section aria-label="Расписание и уведомления" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">{(nextLessons.length > 0 || partial.includes("расписание")) && <Card padding="sm"><div className="flex items-center justify-between gap-3 border-b pb-3"><div><h2 id="today-title" className="ds-card-title">Расписание на сегодня</h2></div><Badge variant="slate">{partial.includes('расписание') && !hasLoaded('расписание') ? 'Нет данных' : `${lessons.length} занятий`}</Badge></div>{nextLessons.length ? <div className="divide-y">{nextLessons.map((lesson) => <div key={lesson.id} className="flex gap-4 py-4"><div className="w-16 shrink-0 text-sm font-semibold text-[var(--color-brand)]">{time(lesson.startTime)}</div><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-[var(--color-text)]">{lesson.subject || 'Без названия'}</p><div className="mt-1"><LessonTypeBadge subjectType={lesson.subjectType} /></div><p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{lesson.groupName || 'Группа не указана'} · ауд. {lesson.room || 'не назначена'}</p></div>{lesson.isChanged && <Badge variant="amber">Изменено</Badge>}</div>)}</div> : <EmptyState title={partial.includes('расписание') && !hasLoaded('расписание') ? 'Расписание недоступно' : 'Других занятий нет'} description={partial.includes('расписание') && !hasLoaded('расписание') ? 'Повторите загрузку, чтобы увидеть занятия.' : 'Нет других занятий для отображения.'} />}</Card>}<div className="space-y-6"><Card padding="sm"><div className="flex items-center justify-between"><h2 className="ds-card-title">Мои уведомления</h2><Badge variant={unread ? 'red' : 'slate'}>{unread === null ? 'Нет данных' : `${unread} непрочитанных`}</Badge></div>{notices.length ? <div className="mt-2 divide-y">{notices.slice(0, 3).map((notice, index) => <Link key={notice.id || index} href="/notifications" className="block min-h-11 py-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><p className="truncate text-sm font-medium text-[var(--color-text)]">{notice.title || 'Уведомление'}</p><p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{notice.body || 'Откройте уведомление для подробностей'}</p></Link>)}</div> : <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{partial.includes('уведомления') ? 'Уведомления не загрузились.' : 'Новых уведомлений нет.'}</p>}<Link href="/notifications" className="mt-3 block min-h-11 pt-3 text-sm font-semibold text-[var(--color-brand)]">Все уведомления →</Link></Card>
      <Card padding="sm"><h2 className="ds-card-title">Основные разделы</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1"><Link href="/absences" className="role-link role-link-secondary w-full">Обращения об отсутствии{hasLoaded('обращения об отсутствии') ? pendingAbsences ? ` · ${pendingAbsences}` : '' : partial.includes('обращения об отсутствии') ? ' · Нет данных' : ''}</Link><Link href="/users" className="role-link role-link-secondary w-full">Пользователи</Link><Link href="/schedule-import" className="role-link role-link-secondary w-full">Расписание</Link><Link href="/structure" className="role-link role-link-secondary w-full">Структура ВУЗа</Link></div></Card></div></section>

    <details className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4"><summary className="cursor-pointer text-sm font-semibold">Показать показатели ВУЗа</summary><section aria-labelledby="secondary-title" className="mt-4"><div className="mb-3 flex items-center justify-between"><h2 id="secondary-title" className="text-sm font-semibold text-[var(--color-text-secondary)]">Структура и активность</h2><Link href="/structure" className="text-sm font-semibold text-[var(--color-brand)]">Открыть структуру →</Link></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[{ label: 'Пользователи', value: stats?.totalUsers ?? 'Нет данных' }, { label: 'Активны сегодня', value: activeToday }, { label: 'Студенты', value: students }, { label: 'Преподаватели', value: teachers }, { label: 'Группы', value: hasLoaded('группы') ? groupsTotal : null }, { label: 'Факультеты', value: hasLoaded('факультеты') ? facultiesTotal : null }, { label: 'Занятия в базе', value: stats?.totalLessons ?? '—' }, { label: 'Непрочитанные', value: unread }, { label: 'Синхронизация', value: syncLabel }].map((metric) => <Card key={metric.label} padding="sm"><p className="truncate text-xs text-[var(--color-text-secondary)]">{metric.label}</p><p className="mt-2 truncate text-xl font-bold text-[var(--color-text)]">{metric.value === null ? 'Нет данных' : typeof metric.value === 'number' ? displayNumber(metric.value) : metric.value}</p></Card>)}</div></section></details>

    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-secondary)]"><span>Синхронизация: {formatDateTime(sync?.lastSync || undefined)}</span><span>Статус: {syncLabel}</span><Link href="/connectors" className="inline-flex min-h-11 items-center font-semibold text-[var(--color-brand)]">Настроить источник данных</Link></footer>
  </div>;
}
