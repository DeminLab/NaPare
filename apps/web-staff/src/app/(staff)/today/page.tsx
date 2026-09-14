'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchList, getNotifications, getUser } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Lesson { id: string; subject: string; subjectType: string; room: string; startTime: string; endTime: string; isChanged: boolean; changeDescription: string; groupName: string; }
interface MyDayResponse { date: string; lessons: Lesson[]; summary?: { totalLessons: number; changedLessons: number; totalAbsences: number }; }
interface Group { id: string; name: string; studentCount: number; }
interface Notice { id?: string; title?: string; message?: string; type?: string; createdAt?: string; }

const typeLabels: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };
const typeVariants: Record<string, 'sky' | 'green' | 'amber' | 'pink' | 'purple' | 'indigo' | 'teal'> = { lecture: 'sky', practice: 'green', lab: 'amber', exam: 'pink', consultation: 'purple', coursework: 'indigo', test: 'teal' };
const typeBorders: Record<string, string> = { lecture: 'border-l-sky-500', practice: 'border-l-emerald-500', lab: 'border-l-amber-500', exam: 'border-l-pink-500', consultation: 'border-l-purple-500', coursework: 'border-l-indigo-500', test: 'border-l-teal-500' };

function statusFor(lesson: Lesson, now: Date) {
  const toMinutes = (time: string) => time.split(':').map(Number).reduce((hour, minute) => hour * 60 + minute);
  const current = now.getHours() * 60 + now.getMinutes();
  if (lesson.isChanged) return { label: 'Изменено', variant: 'amber' as const };
  if (current >= toMinutes(lesson.endTime)) return { label: 'Завершено', variant: 'slate' as const };
  if (current >= toMinutes(lesson.startTime)) return { label: 'Сейчас', variant: 'sky' as const };
  return { label: 'Предстоящее', variant: 'sky' as const };
}

export default function TodayPage() {
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [day, setDay] = useState<MyDayResponse | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDay = () => {
    setLoading(true); setError('');
    Promise.all([getUser(), apiFetch<MyDayResponse>('/my-day'), apiFetchList<Group>('/admin/groups'), getNotifications()])
      .then(([profile, today, groupItems, notificationItems]) => { setUser(profile); setDay(today); setGroups(groupItems); setNotices(notificationItems); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить данные на сегодня.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDay(); }, []);

  const lessons = day?.lessons ?? [];
  const now = new Date();
  const currentLesson = lessons.find((lesson) => statusFor(lesson, now).label === 'Сейчас') || lessons.find((lesson) => statusFor(lesson, now).label === 'Предстоящее');
  const groupNames = new Set(lessons.map((lesson) => lesson.groupName).filter(Boolean));
  const studentCount = groups.filter((group) => groupNames.has(group.name)).reduce((sum, group) => sum + (group.studentCount || 0), 0);
  const attention = useMemo(() => [
    { label: 'Посещаемость', href: '/attendance', value: day?.summary?.totalAbsences || '—' },
    { label: 'Новые задания', href: '/assignments', value: notices.filter((notice) => notice.type?.toLowerCase().includes('assignment')).length || '—' },
    { label: 'Сообщения', href: '/chats', value: '—' },
    { label: 'Изменения расписания', href: '/week', value: day?.summary?.changedLessons || '—' },
  ], [day, notices]);

  if (loading) return <div className="mx-auto max-w-[1400px] space-y-6"><Skeleton className="h-24" /><Skeleton className="h-28" /><Skeleton className="h-[420px]" /></div>;
  if (error) return <div className="mx-auto max-w-[1400px]"><RequestState title="Не удалось загрузить данные на сегодня" description={error} onRetry={loadDay} /></div>;

  return <div className="mx-auto max-w-[1400px] space-y-6">
    <div className="flex items-center gap-2 text-sm text-slate-500"><Link href="/today" className="hover:text-sky-600">НаПаре</Link><span>/</span><span className="text-slate-900">Сегодня</span></div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Добрый день, {user?.firstName} {user?.lastName}</h1><p className="mt-2 text-sm text-slate-500">Сегодня · {now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p></div><Link href="/week"><Button variant="secondary">Открыть расписание</Button></Link></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[{ label: 'Занятия', value: lessons.length, note: 'Сегодня' }, { label: 'Группы', value: groupNames.size, note: 'В расписании' }, { label: 'Студенты', value: studentCount || '—', note: 'В группах дня' }, { label: 'Требуют отметки', value: '—', note: 'Нет данных' }].map((stat) => <Card key={stat.label} padding="sm" className="min-h-[104px]"><p className="text-2xl font-bold text-slate-900">{stat.value}</p><p className="mt-1 text-sm font-medium text-slate-700">{stat.label}</p><p className="mt-1 text-xs text-slate-400">{stat.note}</p></Card>)}</div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6">
      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Текущее занятие</h2><span className="text-xs text-slate-400">{currentLesson ? 'По времени' : 'Сегодня'}</span></div>{currentLesson ? <Card className="border-l-4 border-l-sky-500 px-5 py-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold text-slate-900">{currentLesson.subject}</h3><Badge variant="sky">{currentLesson.groupName || 'Группа не указана'}</Badge></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="font-semibold text-slate-800">{currentLesson.startTime}–{currentLesson.endTime}</span><span>Ауд. {currentLesson.room || '—'}</span></div><div className="mt-3"><Badge variant={typeVariants[currentLesson.subjectType] || 'slate'}>{typeLabels[currentLesson.subjectType] || currentLesson.subjectType}</Badge></div></div><div className="flex flex-wrap gap-2"><Link href={`/pair-space/${currentLesson.id}`}><Button>Открыть пару</Button></Link><Link href={`/attendance?lesson=${currentLesson.id}`}><Button variant="secondary">Посещаемость</Button></Link></div></div></Card> : <EmptyState title="Сейчас нет занятий" description="В расписании на сегодня нет текущей пары." />}</section>
      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Все занятия дня</h2><span className="text-sm text-slate-500">{lessons.length} занятий</span></div>{lessons.length ? <div className="space-y-3">{lessons.map((lesson) => { const status = statusFor(lesson, now); return <Link key={lesson.id} href={`/pair-space/${lesson.id}`}><Card hover className={`border-l-4 ${typeBorders[lesson.subjectType] || 'border-l-slate-300'} px-4 py-4`}><div className="flex gap-4"><div className="w-16 shrink-0"><p className="text-sm font-bold text-slate-900">{lesson.startTime}</p><p className="mt-1 text-xs text-slate-400">{lesson.endTime}</p></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{lesson.subject}</h3><Badge size="sm" variant={typeVariants[lesson.subjectType] || 'slate'}>{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge></div><p className="mt-1 text-sm text-slate-500">{lesson.groupName || 'Группа не указана'} · Ауд. {lesson.room || '—'}</p>{lesson.isChanged && lesson.changeDescription && <p className="mt-2 text-xs font-medium text-amber-700">{lesson.changeDescription}</p>}</div><Badge variant={status.variant} size="sm">{status.label}</Badge></div></Card></Link>; })}</div> : <EmptyState title="Нет занятий" description="На сегодня нет запланированных занятий." />}</section>
    </div><aside className="space-y-4 xl:sticky xl:top-24"><Card padding="sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Требуют внимания</h2><span className="text-xs text-slate-400">Сегодня</span></div><div className="mt-3 divide-y divide-slate-100">{attention.map((item) => <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 hover:text-sky-700"><span className="text-sm text-slate-600">{item.label}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{item.value}</span></Link>)}</div></Card><Card padding="sm"><h2 className="font-bold text-slate-900">Последние события</h2>{notices.length ? <div className="mt-3 space-y-3">{notices.slice(0, 3).map((notice, index) => <div key={notice.id || index}><p className="text-sm font-medium text-slate-800">{notice.title || notice.message || 'Новое уведомление'}</p>{notice.createdAt && <p className="mt-1 text-xs text-slate-400">{new Date(notice.createdAt).toLocaleDateString('ru-RU')}</p>}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">Новых событий нет.</p>}<Link href="/notifications" className="mt-4 block text-sm font-semibold text-sky-600 hover:text-sky-700">Открыть уведомления →</Link></Card></aside></div>
  </div>;
}
