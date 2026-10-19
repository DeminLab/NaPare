'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Student { id: string; firstName: string; lastName: string; email?: string; }
interface AttendanceRecord { studentId: string; status: Exclude<AttendanceStatus, 'unmarked'>; comment?: string | null; }
interface Lesson { id: string; subject: string; groupId?: string; groupName: string; startTime: string; startDate?: string; }
interface Group { id: string; name: string; }
interface ReportedAbsence { id: string; studentId: string; type: string; comment?: string | null; confirmationRequired: boolean; }
type AttendanceStatus = 'present' | 'absent' | 'late' | 'unmarked';
const statusLabels: Record<AttendanceStatus, string> = { present: 'Присутствует', absent: 'Отсутствует', late: 'Опоздал', unmarked: 'Не отмечен' };
const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const todayKey = () => dateKey(new Date());
const localDayRange = (value: string) => ({ startDate:value, endDate:value });
const displayTime = (value?: string) => value?.includes('T') ? value.slice(11, 16) : value || '—';

export default function AttendancePage() {
  const pathname = usePathname();
  const params = useSearchParams();
  const searchParameters = params.toString();
  const linkedLessonId = params.get('lesson');
  const [groups, setGroups] = useState<Group[]>([]); const [groupId, setGroupId] = useState(params.get('group') || ''); const [groupsLoading, setGroupsLoading] = useState(true); const [groupsError, setGroupsError] = useState('');
  const [date, setDate] = useState(todayKey); const [students, setStudents] = useState<Student[]>([]); const [lessons, setLessons] = useState<Lesson[]>([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [lessonId, setLessonId] = useState(linkedLessonId || ''); const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({}); const [comments, setComments] = useState<Record<string, string>>({});
  const [savedMarks,setSavedMarks]=useState<Record<string,AttendanceStatus>>({}); const [savedComments,setSavedComments]=useState<Record<string,string>>({}); const [search,setSearch]=useState(''); const [statusFilter,setStatusFilter]=useState('all');
  const [reportedAbsences, setReportedAbsences] = useState<ReportedAbsence[]>([]); const [reportedAbsencesError, setReportedAbsencesError] = useState(''); const [reportedAbsencesLoading, setReportedAbsencesLoading] = useState(false); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [confirmingAbsenceId, setConfirmingAbsenceId] = useState(''); const [error, setError] = useState(''); const [saveError, setSaveError] = useState(''); const [success, setSuccess] = useState('');
  const loadRequestId = useRef(0);
  const absenceRequestId = useRef(0);

  const loadGroups = useCallback(() => { setGroupsLoading(true); setGroupsError(''); apiFetchList<Group>('/admin/attendance-groups').then((items) => { setGroups(items); setGroupId((current) => current || items[0]?.id || ''); }).catch((err) => setGroupsError(err instanceof Error ? err.message : 'Не удалось загрузить доступные группы.')).finally(() => setGroupsLoading(false)); }, []);
  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => {
    if (!linkedLessonId) return;
    apiFetch<Lesson>(`/schedule/lessons/${linkedLessonId}`).then((lesson) => {
      if (lesson.groupId) setGroupId(lesson.groupId);
      const lessonDate = lesson.startDate?.slice(0, 10) || (lesson.startTime.includes('T') ? lesson.startTime.slice(0, 10) : '');
      if (lessonDate) setDate(lessonDate);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось открыть занятие из уведомления.'));
  }, [linkedLessonId]);
  const load = () => { const requestId = ++loadRequestId.current; if (!groupId) { setLoading(false); return; } setLoading(true); setError(''); const { startDate, endDate } = localDayRange(date); Promise.all([apiFetchList<Student>(`/admin/groups/${groupId}/students`), apiFetchList<Lesson>(`/schedule/range?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`)]).then(([studentItems, lessonItems]) => { if (requestId !== loadRequestId.current) return; setStudents(studentItems); setLessons(lessonItems.filter((lesson) => lesson.groupId === groupId || (!lesson.groupId && groups.some((group) => group.id === groupId && group.name === lesson.groupName)))); }).catch((err) => { if (requestId === loadRequestId.current) setError(err instanceof Error ? err.message : 'Не удалось загрузить студентов или занятия.'); }).finally(() => { if (requestId === loadRequestId.current) setLoading(false); }); };
  useEffect(() => { load(); return () => { loadRequestId.current += 1; }; }, [groupId, date]);
  useEffect(() => {
    let active = true;
    if (!lessonId) { setStatuses({}); setComments({}); setSavedMarks({}); setSavedComments({}); setMarksLoading(false); return; }
    setMarksLoading(true);
    apiFetchList<AttendanceRecord>(`/absences/attendance/lesson/${lessonId}`).then((items) => {
      if (!active) return;
      const next: Record<string, AttendanceStatus> = {}; const notes: Record<string, string> = {};
      students.forEach((student) => { const record = items.find((item) => item.studentId === student.id); next[student.id] = record?.status || 'unmarked'; if (record?.comment) notes[student.id] = record.comment; });
      setStatuses(next); setComments(notes); setSavedMarks(next); setSavedComments(notes);
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Не удалось загрузить отметки.'); }).finally(() => { if (active) setMarksLoading(false); });
    return () => { active = false; };
  }, [lessonId, students]);
  const loadReportedAbsences = useCallback(() => { const requestId = ++absenceRequestId.current; if (!lessonId) { setReportedAbsences([]); setReportedAbsencesError(''); setReportedAbsencesLoading(false); return; } setReportedAbsences([]); setReportedAbsencesError(''); setReportedAbsencesLoading(true); apiFetchList<ReportedAbsence>(`/absences/lesson/${lessonId}`).then((items) => { if (requestId === absenceRequestId.current) setReportedAbsences(items); }).catch((err) => { if (requestId === absenceRequestId.current) setReportedAbsencesError(err instanceof Error ? err.message : 'Не удалось загрузить сообщения об отсутствии.'); }).finally(() => { if (requestId === absenceRequestId.current) setReportedAbsencesLoading(false); }); }, [lessonId]);
  useEffect(() => { loadReportedAbsences(); return () => { absenceRequestId.current += 1; }; }, [loadReportedAbsences]);

  const counts = useMemo(() => { const values = students.map((student) => statuses[student.id] || 'unmarked'); return { present: values.filter((value) => value === 'present').length, absent: values.filter((value) => value === 'absent').length, late: values.filter((value) => value === 'late').length }; }, [students, statuses]);
  const markedCount = counts.present + counts.absent + counts.late;
  const percentage = markedCount ? Math.round(((counts.present + counts.late) / markedCount) * 100) : null;
  const changedStudents=students.filter(student=>(statuses[student.id]||'unmarked')!=='unmarked').filter(student=>(statuses[student.id]||'unmarked')!==(savedMarks[student.id]||'unmarked')||(comments[student.id]||'').trim()!==(savedComments[student.id]||'').trim());
  const pending=changedStudents.length;
  const visibleStudents=students.filter(student=>(!search||`${student.lastName} ${student.firstName}`.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')))&&(statusFilter==='all'||(statuses[student.id]||'unmarked')===statusFilter));
  const mayLeave=useCallback(()=>{if(saving){window.alert('Посещаемость сохраняется. Дождитесь результата перед переходом.');return false;}return !pending||window.confirm('Есть несохранённые отметки. Перейти без сохранения?');},[pending,saving]);
  useEffect(() => {
    if (!pending) return;
    const confirmLeaving = mayLeave;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!confirmLeaving()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const navigationApi = (window as Window & { navigation?: EventTarget }).navigation;
    const guardHistoryNavigation = (event: Event) => {
      const navigationEvent = event as Event & { navigationType?: string; canIntercept?: boolean };
      if (navigationEvent.navigationType !== 'traverse' || !navigationEvent.canIntercept || confirmLeaving()) return;
      event.preventDefault();
    };
    const guardHistoryFallback = (event: Event) => {
      if (!confirmLeaving()) event.preventDefault();
    };
    const guardProgrammaticNavigation = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;
      if (!href) return;
      const destination = new URL(href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!confirmLeaving()) event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    document.addEventListener('click', guardLinkClick, true);
    if (navigationApi) navigationApi.addEventListener('navigate', guardHistoryNavigation);
    else window.addEventListener('napare:staff-history-request', guardHistoryFallback);
    window.addEventListener('napare:staff-navigation-request', guardProgrammaticNavigation);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      document.removeEventListener('click', guardLinkClick, true);
      if (navigationApi) navigationApi.removeEventListener('navigate', guardHistoryNavigation);
      else window.removeEventListener('napare:staff-history-request', guardHistoryFallback);
      window.removeEventListener('napare:staff-navigation-request', guardProgrammaticNavigation);
    };
  }, [mayLeave, pending]);
  const save = async () => { if (marksLoading || saving || !lessonId || !pending) return; setSaving(true); setSuccess(''); setSaveError(''); try { await apiFetch('/absences/attendance', { method: 'POST', body: JSON.stringify({ lessonId, entries: changedStudents.filter(student => statuses[student.id] && statuses[student.id] !== 'unmarked').map((student) => ({ studentId: student.id, status: statuses[student.id], comment: comments[student.id]?.trim() || undefined })) }) }); setSavedMarks({...statuses}); setSavedComments({...comments}); setError(''); setSaveError(''); setSuccess('Посещаемость сохранена.'); } catch (err) { setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить посещаемость.'); } finally { setSaving(false); } };
  const confirmAbsence = async (absenceId: string) => { setConfirmingAbsenceId(absenceId); setSuccess(''); try { await apiFetch(`/absences/${absenceId}/confirm`, { method: 'POST' }); setReportedAbsences((items) => items.map((item) => item.id === absenceId ? { ...item, confirmationRequired: false } : item)); setSuccess('Отсутствие подтверждено.'); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось подтвердить отсутствие.'); } finally { setConfirmingAbsenceId(''); } };
  const markAll = (status: AttendanceStatus) => { setStatuses(Object.fromEntries(students.map((student) => [student.id, status]))); setSuccess(''); };
  if (!groupId && !groupsLoading && !loading) return <div className="mx-auto max-w-[1400px] space-y-6"><h1 className="text-2xl font-bold text-slate-900">Посещаемость</h1>{groupsError ? <RequestState title="Не удалось загрузить группы" description={groupsError} onRetry={loadGroups} /> : <EmptyState title="Нет доступных групп" description="Попросите кабинет ВУЗа добавить группу и назначить вам доступ." />}</div>;

  return <div className="mx-auto max-w-[1400px] space-y-6"><div className="flex items-center justify-between gap-3"><div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Посещаемость</h1></div>{success && <p role="status" className="text-sm font-medium text-emerald-700">{success}</p>}</div><Card padding="sm"><div className="grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-slate-500">Группа<select disabled={saving || groupsLoading} value={groupId} onChange={(event) => { if(!mayLeave())return; setSavedMarks({});setSavedComments({});setStatuses({});setComments({});setGroupId(event.target.value); setLessonId(''); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Занятие<select disabled={saving} value={lessonId} onChange={(event) => {if(mayLeave())setLessonId(event.target.value);}} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"><option value="">Выберите занятие</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.subject} · {displayTime(lesson.startTime)}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Дата<input disabled={saving} type="date" value={date} onChange={(event) => { if(!mayLeave())return;setStatuses({});setComments({});setSavedMarks({});setSavedComments({});setDate(event.target.value); setLessonId(''); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" /></label></div></Card>{groupsLoading || loading || marksLoading ? <div className="space-y-3" aria-busy="true" aria-label="Загрузка списка и отметок"><Skeleton className="h-24" />{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16" />)}</div> : error ? <RequestState title="Не удалось загрузить посещаемость" description={error} onRetry={load} /> : !lessonId ? <EmptyState title="Выберите занятие" description="После выбора занятия появится список студентов для отметки." /> : students.length === 0 ? <EmptyState title="Нет студентов" description="В выбранной группе нет студентов." /> : <><Card padding="sm"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Сообщения об отсутствии</p></div><Badge variant="amber" size="sm">{reportedAbsencesLoading ? 'Загружаем' : `${reportedAbsences.filter((item) => item.confirmationRequired).length} ожидают`}</Badge></div>{reportedAbsencesError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"><span>Не удалось загрузить сообщения: {reportedAbsencesError}</span><Button size="sm" variant="secondary" loading={reportedAbsencesLoading} onClick={loadReportedAbsences}>Повторить</Button></div>}{!reportedAbsencesError && !reportedAbsencesLoading && reportedAbsences.length === 0 && <p className="mt-3 text-sm text-slate-500">Нет сообщений об отсутствии.</p>}{reportedAbsences.length > 0 && <div className="mt-3 divide-y divide-slate-100">{reportedAbsences.map((absence) => { const student = students.find((item) => item.id === absence.studentId); return <div key={absence.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${params.get('absence') === absence.id ? 'rounded-lg bg-amber-50 px-2' : ''}`}><div><p className="text-sm font-medium text-slate-900">{student ? `${student.lastName} ${student.firstName}` : 'Студент'}</p><p className="mt-1 text-xs text-slate-500">{absence.comment || 'Без комментария'} · {absence.type}</p></div>{absence.confirmationRequired ? <Button size="sm" loading={confirmingAbsenceId === absence.id} onClick={() => confirmAbsence(absence.id)}>Подтвердить</Button> : <Badge variant="green" size="sm">Подтверждено</Badge>}</div>; })}</div>}</Card><div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-white px-4 py-3" aria-label="Сводка отметок">{[{label:'Не отмечено',value:students.length-markedCount},{label:'Были',value:counts.present},{label:'Отсутствовали',value:counts.absent},{label:'Опоздали',value:counts.late}].map(item=><p key={item.label} className="text-sm text-slate-600"><strong className="mr-2 text-lg tabular-nums text-slate-900">{item.value}</strong>{item.label}</p>)}<p className="text-sm text-slate-500">Среди отмеченных: {percentage===null?'—':`${percentage}%`}</p></div>
    <div className="flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">Поиск студента<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Фамилия или имя…" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"/></label><label className="text-xs font-semibold text-slate-600">Показать<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)} className="mt-1 block min-h-11 rounded-lg border bg-white px-3 text-sm"><option value="all">Всех студентов</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">{visibleStudents.map(student=>{const status=statuses[student.id]||'unmarked';const dirty=changedStudents.some(item=>item.id===student.id);return <div key={student.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-center"><div><p className="text-sm font-semibold text-slate-900">{student.lastName} {student.firstName}</p><p className="mt-1 text-xs text-slate-500">{statusLabels[status]}{dirty?' · Не сохранено':''}</p></div><div><div className="flex flex-wrap gap-1" role="group" aria-label={`Отметка: ${student.lastName} ${student.firstName}`}>{([['present','Был'],['late','Опоздал'],['absent','Отсутствовал']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={status===value} disabled={saving} onClick={()=>{setStatuses(current=>({...current,[student.id]:value}));setSuccess('');}} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${status===value?(value==='present'?'border-emerald-300 bg-emerald-50 text-emerald-800':value==='late'?'border-amber-300 bg-amber-50 text-amber-800':'border-rose-300 bg-rose-50 text-rose-800'):'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}{!savedMarks[student.id]||savedMarks[student.id]==='unmarked'?<button type="button" disabled={saving} onClick={()=>{setStatuses(current=>({...current,[student.id]:'unmarked'}));setComments(current=>({...current,[student.id]:savedComments[student.id]||''}));}} className="min-h-11 rounded-lg px-3 text-xs text-slate-500">Не отмечен</button>:null}</div><details className="mt-1"><summary className="inline-flex min-h-9 cursor-pointer items-center text-xs text-slate-500">{status==='unmarked'?'Комментарий — сначала выберите отметку':comments[student.id]?'Комментарий добавлен':'Добавить комментарий'}</summary><p className="mb-1 text-xs text-slate-500">{status==='unmarked'?'Выберите статус, чтобы добавить и сохранить комментарий.':'Комментарий сохранится вместе с отметкой.'}</p><input disabled={saving || status==='unmarked'} value={comments[student.id]||''} onChange={event=>{setComments(current=>({...current,[student.id]:event.target.value}));setSuccess('');}} aria-label={`Комментарий к отметке: ${student.lastName} ${student.firstName}`} placeholder="Например, причина опоздания…" className="min-h-11 w-full rounded-lg border px-3 text-sm"/></details></div></div>;})}{!visibleStudents.length&&<p className="p-5 text-sm text-slate-500">Студентов по этим условиям нет. Измените поиск или фильтр.</p>}</div></div>
    <div className={`${pending ? "sticky bottom-20 z-10 shadow-sm lg:bottom-4" : ""} flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3`}>{saveError && <div role="alert" className="w-full rounded-md bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700">{saveError}</div>}<p role="status" className="mr-auto text-sm font-medium text-slate-600">{pending?`Изменений: ${pending}`:'Все изменения сохранены'}</p><Button size="sm" variant="secondary" disabled={saving} onClick={()=>markAll('present')}>Все присутствуют</Button><Button size="sm" variant="secondary" disabled={saving} onClick={()=>{if(window.confirm('Отметить всех студентов отсутствующими?'))markAll('absent');}}>Все отсутствуют</Button><Button loading={saving} disabled={!pending} onClick={save}>Сохранить отметки</Button></div><p className="text-xs text-slate-400">Студенты без отметки не записываются как присутствующие.</p></>}</div>;
}
