'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Student { id: string; firstName: string; lastName: string; email?: string; }
interface Absence { id: string; studentId: string; isExcused: boolean; }
interface Lesson { id: string; subject: string; groupName: string; startTime: string; endTime?: string; }
interface Group { id: string; name: string; }
type AttendanceStatus = 'present' | 'absent' | 'late' | 'unmarked';

const statusLabels: Record<AttendanceStatus, string> = { present: 'Присутствует', absent: 'Отсутствует', late: 'Опоздал', unmarked: 'Не отмечен' };
const statusVariants: Record<AttendanceStatus, 'green' | 'red' | 'amber' | 'slate'> = { present: 'green', absent: 'red', late: 'amber', unmarked: 'slate' };

function todayKey() { return new Date().toISOString().split('T')[0]; }
function displayTime(value?: string) { return value?.includes('T') ? value.slice(11, 16) : value || '—'; }

export default function AttendancePage() {
  const params = useSearchParams();
  const initialGroupId = params.get('group') || '';
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState(initialGroupId);
  const [date, setDate] = useState(todayKey);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState(params.get('lesson') || '');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { apiFetchList<Group>('/admin/groups').then(setGroups).catch(() => undefined); }, []);

  const loadStudents = () => {
    if (!groupId) { setLoading(false); return; }
    setLoading(true); setError('');
    Promise.all([
      apiFetchList<Student>(`/admin/groups/${groupId}/students`),
      apiFetchList<Lesson>(`/schedule/range?startDate=${date}&endDate=${date}`),
    ]).then(([studentItems, lessonItems]) => { setStudents(studentItems); setLessons(lessonItems.filter((lesson) => !lesson.groupName || !groups.length || groups.some((group) => group.id === groupId && group.name === lesson.groupName))); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить студентов или занятия.')).finally(() => setLoading(false));
  };
  useEffect(() => { loadStudents(); }, [groupId, date]);

  useEffect(() => {
    if (!lessonId) { setStatuses({}); return; }
    apiFetchList<Absence>(`/absences/lesson/${lessonId}`).then((items) => { const next: Record<string, AttendanceStatus> = {}; students.forEach((student) => { next[student.id] = items.some((item) => item.studentId === student.id) ? 'absent' : 'unmarked'; }); setStatuses(next); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить отметки.'));
  }, [lessonId, students]);

  const counts = useMemo(() => { const values = students.map((student) => statuses[student.id] || 'unmarked'); return { present: values.filter((value) => value === 'present').length, absent: values.filter((value) => value === 'absent').length, late: values.filter((value) => value === 'late').length, unmarked: values.filter((value) => value === 'unmarked').length }; }, [students, statuses]);
  const percentage = students.length ? Math.round(((counts.present + counts.late) / students.length) * 100) : null;
  const selectedLesson = lessons.find((lesson) => lesson.id === lessonId);

  const markAll = (status: AttendanceStatus) => { const next: Record<string, AttendanceStatus> = {}; students.forEach((student) => { next[student.id] = status; }); setStatuses(next); setSuccess(''); };
  const save = async () => { if (!lessonId) return; setSaving(true); setSuccess(''); try { await apiFetch('/absences', { method: 'POST', body: JSON.stringify({ lessonId, studentIds: students.filter((student) => statuses[student.id] === 'absent').map((student) => student.id) }) }); setSuccess('Посещаемость сохранена.'); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить посещаемость.'); } finally { setSaving(false); } };

  if (!groupId) return <div className="mx-auto max-w-[1400px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><span>НаПаре</span><span>/</span><span className="text-slate-900">Посещаемость</span></div><h1 className="text-2xl font-bold text-slate-900">Посещаемость</h1><EmptyState title="Выберите группу" description="Откройте посещаемость из раздела «Группы», чтобы начать отметку." /></div>;

  return <div className="mx-auto max-w-[1400px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><span>НаПаре</span><span>/</span><span className="text-slate-900">Посещаемость</span></div><div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Посещаемость</h1>{success && <p role="status" className="text-sm font-medium text-emerald-700">{success}</p>}</div><Card padding="sm"><div className="grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-slate-500">Группа<select value={groupId} onChange={(event) => { setGroupId(event.target.value); setLessonId(''); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value={initialGroupId}>{groups.find((group) => group.id === groupId)?.name || 'Текущая группа'}</option>{groups.filter((group) => group.id !== groupId).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Занятие<select value={lessonId} onChange={(event) => setLessonId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="">Выберите занятие</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.subject} · {displayTime(lesson.startTime)}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Дата<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setLessonId(''); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label></div></Card>{loading ? <div className="space-y-3"><Skeleton className="h-24" />{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16" />)}</div> : error ? <RequestState title="Не удалось загрузить посещаемость" description={error} onRetry={loadStudents} /> : !lessonId ? <EmptyState title="Выберите занятие" description="После выбора занятия появится список студентов для отметки." /> : students.length === 0 ? <EmptyState title="Нет студентов" description="В выбранной группе нет студентов." /> : <><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[{ label: 'Студентов', value: students.length }, { label: 'Присутствует', value: counts.present }, { label: 'Отсутствует', value: counts.absent }, { label: 'Опоздал', value: counts.late }, { label: 'Посещаемость', value: `${percentage}%` }].map((item) => <Card key={item.label} padding="sm"><p className="text-xl font-bold text-slate-900">{item.value}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.label}</p></Card>)}</div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="secondary" onClick={() => markAll('present')}>Отметить всех</Button><Button size="sm" variant="secondary" onClick={() => markAll('absent')}>Снять всех</Button><Button size="sm" loading={saving} onClick={save}>Сохранить</Button>{selectedLesson && <span className="ml-auto text-sm text-slate-500">{selectedLesson.subject} · {displayTime(selectedLesson.startTime)}</span>}</div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="hidden grid-cols-[minmax(220px,1.5fr)_180px_100px_minmax(160px,1fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"><span>Студент</span><span>Статус</span><span>Время</span><span>Комментарий</span></div><div className="divide-y divide-slate-100">{students.map((student) => { const status = statuses[student.id] || 'present'; return <div key={student.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(220px,1.5fr)_180px_100px_minmax(160px,1fr)] md:items-center md:gap-4 md:px-5"><div><p className="text-sm font-semibold text-slate-900">{student.lastName} {student.firstName}</p>{student.email && <p className="mt-1 text-xs text-slate-400">{student.email}</p>}</div><label className="flex items-center gap-2"><span className="text-xs font-medium text-slate-500 md:hidden">Статус</span><select value={status} onChange={(event) => { setStatuses((current) => ({ ...current, [student.id]: event.target.value as AttendanceStatus })); setSuccess(''); }} className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="present">Присутствует</option><option value="absent">Отсутствует</option><option value="late">Опоздал</option></select><Badge variant={statusVariants[status]} size="sm">{statusLabels[status]}</Badge></label><span className="text-xs text-slate-500"><span className="mr-2 md:hidden">Время</span>—</span><input value={comments[student.id] || ''} onChange={(event) => setComments((current) => ({ ...current, [student.id]: event.target.value }))} placeholder="Добавить комментарий" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></div>; })}</div></div><p className="text-xs text-slate-400">API сохраняет отсутствия. Статусы «Опоздал», время и комментарии пока доступны только в текущей сессии.</p></>}</div>;
}
