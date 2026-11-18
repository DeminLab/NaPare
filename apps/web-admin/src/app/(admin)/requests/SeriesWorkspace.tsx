'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiFetch, apiFetchAllPages, apiFetchList } from '@/lib/api';
import { Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';
import { controlClass, type Group, type Person } from './types';

interface LessonSeries {
  id: string;
  groupId: string;
  courseId: string;
  teacherId: string | null;
  title: string | null;
  subjectType: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  pairNumber: number;
  weekType: string;
  room: string | null;
  building: string | null;
  validFrom: string;
  validTo: string | null;
}

interface Course { id: string; code: string; name: string }
interface ExpansionResult { seriesId: string; created: string[]; skipped: Array<{ date: string; reason: string }> }

const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const weekTypes: Record<string, string> = { both: 'Каждую неделю', odd: 'Нечётная неделя', even: 'Чётная неделя' };
const subjectTypes: Record<string, string> = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', exam: 'Экзамен', consultation: 'Консультация', coursework: 'Курсовая', test: 'Зачёт' };
const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayOffset = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return isoDay(date); };

interface FormState {
  groupId: string;
  courseId: string;
  teacherId: string;
  title: string;
  subjectType: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  pairNumber: string;
  weekType: string;
  room: string;
  building: string;
  validFrom: string;
  validTo: string;
}

const blankForm = (groupId: string): FormState => ({
  groupId,
  courseId: '',
  teacherId: '',
  title: '',
  subjectType: 'practice',
  dayOfWeek: '1',
  startTime: '10:00',
  endTime: '11:30',
  pairNumber: '2',
  weekType: 'both',
  room: '',
  building: '',
  validFrom: isoDay(new Date()),
  validTo: '',
});

/**
 * A series is the weekly template behind every generated lesson, so the
 * dispatcher can plan a semester once and expand it into concrete lessons.
 * Conflicts are still decided by the server: this form only surfaces them.
 */
export function SeriesWorkspace({ groups }: { groups: Group[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [rows, setRows] = useState<LessonSeries[]>([]);
  const [form, setForm] = useState<FormState>(() => blankForm(groups[0]?.id || ''));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [from, setFrom] = useState(() => isoDay(new Date()));
  const [to, setTo] = useState(() => dayOffset(61));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [course, setCourse] = useState({ code: '', name: '' });

  const field = (key: keyof FormState) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const [series, courseList, users] = await Promise.all([
        apiFetchList<LessonSeries>(`/schedule/series${groupId ? `?groupId=${groupId}` : ''}`, { signal }),
        apiFetchAllPages<Course>('/academic/courses', { signal }).catch(() => []),
        apiFetchAllPages<Person & { role?: string }>('/admin/users', { signal }).catch(() => []),
      ]);
      if (signal?.aborted) return;
      setRows(series);
      setCourses(courseList);
      setTeachers(users.filter(user => user.role === 'teacher'));
      setForm(current => ({
        ...current,
        groupId: current.groupId || groupId,
        courseId: current.courseId || courseList[0]?.id || '',
      }));
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить серии занятий.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function createCourse() {
    if (!course.code.trim() || !course.name.trim()) { setError('Укажите код и название курса.'); return; }
    setBusy('course'); setError('');
    try {
      const created = await apiFetch<Course>('/academic/courses', { method: 'POST', body: JSON.stringify({ code: course.code.trim(), name: course.name.trim() }) });
      setCourses(current => [...current, created]);
      setForm(current => ({ ...current, courseId: created.id }));
      setCourse({ code: '', name: '' });
      setSuccess(`Курс «${created.name}» создан.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать курс.');
    } finally { setBusy(''); }
  }

  function edit(row: LessonSeries) {
    setEditingId(row.id);
    setError(''); setSuccess('');
    setForm({
      groupId: row.groupId,
      courseId: row.courseId,
      teacherId: row.teacherId || '',
      title: row.title || '',
      subjectType: row.subjectType || 'practice',
      dayOfWeek: String(row.dayOfWeek),
      startTime: row.startTime,
      endTime: row.endTime,
      pairNumber: String(row.pairNumber),
      weekType: row.weekType || 'both',
      room: row.room || '',
      building: row.building || '',
      validFrom: row.validFrom.slice(0, 10),
      validTo: row.validTo ? row.validTo.slice(0, 10) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(blankForm(groupId));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.groupId) { setError('Выберите группу.'); return; }
    if (!form.courseId) { setError('Выберите учебный курс.'); return; }
    if (form.endTime <= form.startTime) { setError('Окончание занятия должно быть позже начала.'); return; }
    setBusy('save'); setError(''); setSuccess('');
    const body = {
      groupId: form.groupId,
      courseId: form.courseId,
      teacherId: form.teacherId || undefined,
      title: form.title.trim() || undefined,
      subjectType: form.subjectType || undefined,
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      pairNumber: Number(form.pairNumber),
      weekType: form.weekType,
      room: form.room.trim() || undefined,
      building: form.building.trim() || undefined,
      validFrom: form.validFrom,
      validTo: form.validTo || undefined,
    };
    try {
      if (editingId) {
        await apiFetch(`/schedule/series/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setSuccess('Серия обновлена. Уже созданные занятия не меняются — разверните серию заново.');
      } else {
        await apiFetch('/schedule/series', { method: 'POST', body: JSON.stringify(body) });
        setSuccess('Серия создана. Разверните её на период, чтобы занятия появились в расписании.');
      }
      setEditingId(null);
      setForm(current => ({ ...blankForm(current.groupId), courseId: current.courseId }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Серия не сохранена: проверьте данные и конфликты расписания.');
    } finally { setBusy(''); }
  }

  async function expand(row: LessonSeries) {
    if (!from || !to || to < from) { setError('Укажите период разворота: дата окончания не раньше начала.'); return; }
    setBusy(row.id); setError(''); setSuccess('');
    try {
      const result = await apiFetch<ExpansionResult>(`/schedule/series/${row.id}/expand`, { method: 'POST', body: JSON.stringify({ from, to }) });
      const skipped = result.skipped.slice(0, 3).map(item => `${item.date}: ${item.reason}`).join('; ');
      setSuccess(`Создано занятий: ${result.created.length}. Пропущено: ${result.skipped.length}${skipped ? ` (${skipped}${result.skipped.length > 3 ? '…' : ''})` : ''}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось развернуть серию.');
    } finally { setBusy(''); }
  }

  async function remove(row: LessonSeries) {
    if (!window.confirm('Удалить серию? Уже созданные занятия останутся в расписании.')) return;
    setBusy(row.id); setError(''); setSuccess('');
    try {
      await apiFetch(`/schedule/series/${row.id}`, { method: 'DELETE' });
      if (editingId === row.id) cancelEdit();
      setSuccess('Серия удалена. Созданные занятия сохранены в истории.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить серию.');
    } finally { setBusy(''); }
  }

  const groupName = (id: string) => groups.find(group => group.id === id)?.name || 'Группа';
  const courseName = (id: string) => courses.find(item => item.id === id)?.name || 'Курс';
  const teacherName = (id: string | null) => {
    const person = teachers.find(item => item.id === id);
    return person ? `${person.lastName} ${person.firstName}` : 'Преподаватель не указан';
  };

  return <div className="space-y-5">
    <Card>
      <h2 className="text-xl font-bold text-slate-950">Серии занятий</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">Недельный шаблон: пара, день недели и период действия. Разворот создаёт занятия на выбранные даты, а сервер проверяет конфликты преподавателя, группы и аудитории.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Группа<select className={controlClass} value={groupId} onChange={event => { setGroupId(event.target.value); setForm(current => ({ ...current, groupId: event.target.value })); setEditingId(null); }}>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Развернуть с<input type="date" className={controlClass} value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">по<input type="date" className={controlClass} value={to} onChange={event => setTo(event.target.value)} /></label>
      </div>
    </Card>

    {error && <RequestState title="Действие не выполнено" description={error} onRetry={() => void load()} />}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>}

    <Card>
      <h2 className="text-xl font-bold text-slate-950">{editingId ? 'Изменить серию' : 'Новая серия'}</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Курс<select className={controlClass} value={form.courseId} onChange={event => field('courseId')(event.target.value)}><option value="">Выберите курс</option>{courses.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Преподаватель<select className={controlClass} value={form.teacherId} onChange={event => field('teacherId')(event.target.value)}><option value="">Не указан</option>{teachers.map(person => <option key={person.id} value={person.id}>{person.lastName} {person.firstName}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Предмет<input className={controlClass} maxLength={200} value={form.title} onChange={event => field('title')(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Тип занятия<select className={controlClass} value={form.subjectType} onChange={event => field('subjectType')(event.target.value)}>{Object.entries(subjectTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">День недели<select className={controlClass} value={form.dayOfWeek} onChange={event => field('dayOfWeek')(event.target.value)}>{weekdays.map((label, index) => <option key={label} value={String(index + 1)}>{label}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Начало<input type="time" required className={controlClass} value={form.startTime} onChange={event => field('startTime')(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Окончание<input type="time" required className={controlClass} value={form.endTime} onChange={event => field('endTime')(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Номер пары<input type="number" min={1} max={10} required className={controlClass} value={form.pairNumber} onChange={event => field('pairNumber')(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Чётность недели<select className={controlClass} value={form.weekType} onChange={event => field('weekType')(event.target.value)}>{Object.entries(weekTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Аудитория<input className={controlClass} maxLength={100} value={form.room} onChange={event => field('room')(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Корпус<input className={controlClass} maxLength={100} value={form.building} onChange={event => field('building')(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Действует с<input type="date" required className={controlClass} value={form.validFrom} onChange={event => field('validFrom')(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">Действует по<input type="date" className={controlClass} value={form.validTo} onChange={event => field('validTo')(event.target.value)} /></label>
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 xl:col-span-4">
          <Button type="submit" loading={busy === 'save'} disabled={!groups.length}>{editingId ? 'Сохранить серию' : 'Создать серию'}</Button>
          {editingId && <Button type="button" variant="secondary" disabled={busy === 'save'} onClick={cancelEdit}>Отмена</Button>}
        </div>
      </form>
      {!courses.length && <div className="mt-5 rounded-xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">В вузе ещё нет учебных курсов — серию создать некуда.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><input className={controlClass} placeholder="Код, например CS-101" maxLength={100} value={course.code} onChange={event => setCourse(current => ({ ...current, code: event.target.value }))} /><input className={controlClass} placeholder="Название курса" maxLength={255} value={course.name} onChange={event => setCourse(current => ({ ...current, name: event.target.value }))} /><Button type="button" variant="secondary" loading={busy === 'course'} onClick={() => void createCourse()}>Создать курс</Button></div></div>}
    </Card>

    {loading ? <Skeleton className="h-48 rounded-2xl" /> : rows.length ? <Card>
      <h2 className="text-xl font-bold text-slate-950">Серии группы {groupName(groupId)}</h2>
      <ul className="mt-4 divide-y divide-slate-200">{rows.map(row => <li key={row.id} className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-950">{row.title || courseName(row.courseId)}</h3>
          <p className="mt-1 text-sm text-slate-600">{weekdays[row.dayOfWeek - 1] || `День ${row.dayOfWeek}`} · {row.startTime}–{row.endTime} · {row.pairNumber} пара · {weekTypes[row.weekType] || row.weekType}</p>
          <p className="mt-1 text-sm text-slate-600">{[courseName(row.courseId), teacherName(row.teacherId), row.building, row.room].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-sm text-slate-600">Действует: {row.validFrom.slice(0, 10)} — {row.validTo ? row.validTo.slice(0, 10) : 'до конца семестра'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" loading={busy === row.id} onClick={() => void expand(row)}>Развернуть на период</Button>
          <Button variant="secondary" onClick={() => edit(row)}>Изменить</Button>
          <Button variant="secondary" loading={busy === row.id} onClick={() => void remove(row)}>Удалить</Button>
        </div>
      </li>)}</ul>
    </Card> : <Card><EmptyState title="У этой группы ещё нет серий" description="Создайте недельный шаблон выше и разверните его на период. Занятия появятся в расписании и в пространстве пары." /></Card>}
  </div>;
}
