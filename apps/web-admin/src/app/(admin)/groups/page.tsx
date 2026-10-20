'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { apiFetch, apiFetchAllPages, apiFetchList, type PaginatedResponse } from '@/lib/api';
import { ListPagination } from '@/components/ListPagination';
import { Badge, Button, Card, EmptyState, Input, LessonTypeBadge, Modal, RequestState, Sheet, SearchInput, Skeleton } from '@/components/ui';

interface Faculty { id: string; name: string; abbreviation?: string; }
interface Group { id: string; name: string; curriculumYear?: number; course?: number; facultyId: string; faculty?: Faculty; curatorId?: string; }
interface Student { id: string; firstName: string; lastName: string; email: string; role?: string; }
interface Lesson { startDate?: string; date?: string; id: string; subject: string; subjectType?: string; groupId?: string; groupName: string; startTime?: string; endTime?: string; room?: string; teacherName?: string; teacher?: { firstName?: string; lastName?: string }; }
interface AttendanceRecord { studentId: string; status: 'present' | 'absent' | 'late'; }
interface PairSpaceSummary { id: string; lessonId: string; subject: string; date: string; pairNumber: number; teacherName: string | null; group: string | null; room: string | null; isActive: boolean; syncStatus: string; }
type DetailTab = 'overview' | 'students' | 'teachers' | 'schedule' | 'attendance' | 'pairSpaces';

const detailTabs: Array<{ id: DetailTab; label: string }> = [{ id: 'overview', label: 'Обзор' }, { id: 'students', label: 'Студенты' }, { id: 'teachers', label: 'Преподаватели' }, { id: 'schedule', label: 'Расписание' }, { id: 'attendance', label: 'Посещаемость' }, { id: 'pairSpaces', label: 'Пространства пары' }];
function course(group: Group) { return group.curriculumYear ?? group.course ?? '—'; }
function revealHorizontally(container: HTMLElement | null, item: HTMLElement) {
  if (!container) return;
  const containerRect = container.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  if (itemRect.right > containerRect.right) container.scrollLeft += itemRect.right - containerRect.right;
  else if (itemRect.left < containerRect.left) container.scrollLeft -= containerRect.left - itemRect.left;
}
function facultyName(group: Group, faculties: Faculty[]) { return group.faculty?.name || faculties.find((faculty) => faculty.id === group.facultyId)?.name || '—'; }
function datePart(value?: string) { return value ? value.slice(0, 10) : '—'; }
function timePart(value?: string) { return value?.includes('T') ? value.slice(11, 16) : value || '—'; }

function GroupAttendancePanel({ groupName, lessons, scheduleAvailable, onRetry }: { groupName: string; lessons: Lesson[]; scheduleAvailable: boolean; onRetry: () => void }) {
  const [lessonId, setLessonId] = useState('');
  const [retry, setRetry] = useState(0);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const orderedLessons = [...lessons].sort((a, b) => `${b.startDate || b.date || b.startTime || ''} ${b.startTime || ''}`.localeCompare(`${a.startDate || a.date || a.startTime || ''} ${a.startTime || ''}`));

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (!lessonId) {
      setRecords([]);
      setError('');
      setLoading(false);
      return;
    }
    setRecords([]);
    setError('');
    setLoading(true);
    apiFetchAllPages<AttendanceRecord>(`/absences/attendance/lesson/${lessonId}`)
      .then((result) => { if (requestRef.current === requestId) setRecords(result); })
      .catch((reason) => { if (requestRef.current === requestId) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить посещаемость.'); })
      .finally(() => { if (requestRef.current === requestId) setLoading(false); });
    return () => { requestRef.current += 1; };
  }, [lessonId, retry]);

  const lesson = orderedLessons.find((item) => item.id === lessonId);
  const counts = records.reduce((total, record) => ({ ...total, [record.status]: total[record.status] + 1 }), { present: 0, absent: 0, late: 0 });

  if (!scheduleAvailable) return <div className="mt-6"><RequestState title="Расписание недоступно" description="Не удалось получить занятия группы. Посещаемость нельзя проверить, пока расписание недоступно." onRetry={onRetry} /></div>;
  if (!orderedLessons.length) return <div className="mt-6"><EmptyState title="Занятия не найдены" description="В расписании группы на текущий календарный год пока нет занятий." /></div>;

  return <section className="mt-6 space-y-4" aria-label={`Посещаемость группы ${groupName}`}>
    <label htmlFor="group-attendance-lesson" className="block text-sm font-medium text-[var(--color-text)]">Занятие
      <select id="group-attendance-lesson" value={lessonId} onChange={(event) => setLessonId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
        <option value="">Выберите занятие</option>
        {orderedLessons.map((item) => <option key={item.id} value={item.id}>{datePart(item.startDate || item.date || item.startTime)} · {timePart(item.startTime)} · {item.subject || 'Без названия'}</option>)}
      </select>
    </label>
    {!lessonId ? <p className="text-sm leading-6 text-[var(--color-text-secondary)]">Выберите занятие, чтобы посмотреть сохранённые отметки. Доступны занятия текущего календарного года.</p> : loading ? <div role="status" aria-live="polite" className="space-y-3"><span className="sr-only">Загружаем посещаемость…</span><Skeleton className="h-24" /></div> : error ? <RequestState title="Посещаемость недоступна" description={error} onRetry={() => setRetry((value) => value + 1)} /> : <>
      <p className="text-sm font-medium text-[var(--color-text)]">{lesson?.subject || 'Без названия'} · {datePart(lesson?.startDate || lesson?.date || lesson?.startTime)} · {timePart(lesson?.startTime)}</p>
      {!records.length ? <EmptyState title="Отметок пока нет" description="Для этого занятия ещё не сохранена посещаемость." /> : <>
        <p className="text-sm text-[var(--color-text-secondary)]">Отмечено студентов: {records.length}</p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-3"><dt className="text-xs font-medium text-[var(--color-text-secondary)]">Присутствовали</dt><dd className="mt-1 text-xl font-semibold text-[var(--color-text)]">{counts.present}</dd></div>
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-3"><dt className="text-xs font-medium text-[var(--color-text-secondary)]">Отсутствовали</dt><dd className="mt-1 text-xl font-semibold text-[var(--color-text)]">{counts.absent}</dd></div>
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-3"><dt className="text-xs font-medium text-[var(--color-text-secondary)]">Опоздали</dt><dd className="mt-1 text-xl font-semibold text-[var(--color-text)]">{counts.late}</dd></div>
        </dl>
      </>}
    </>}
  </section>;
}

function GroupPairSpacesPanel({ groupId }: { groupId: string }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponse<PairSpaceSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    apiFetch<PaginatedResponse<PairSpaceSummary>>(`/pair-spaces/groups/${groupId}?page=${page}&limit=25`)
      .then((next) => { if (requestRef.current === requestId) setResult(next); })
      .catch((reason) => { if (requestRef.current === requestId) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить пространства пары.'); })
      .finally(() => { if (requestRef.current === requestId) setLoading(false); });
    return () => { requestRef.current += 1; };
  }, [groupId, page, retry]);

  if (loading) return <div role="status" aria-live="polite" className="mt-6 space-y-3"><span className="sr-only">Загружаем пространства пары…</span><Skeleton className="h-24" /></div>;
  if (error) return <div className="mt-6"><RequestState title="Пространства пары недоступны" description={error} onRetry={() => setRetry((value) => value + 1)} /></div>;
  if (!result?.meta.total) return <div className="mt-6"><EmptyState title="Пространств пары пока нет" description="Для занятий этой группы ещё не создавали пространства пары." /></div>;

  return <section className="mt-6 space-y-3" aria-label="Существующие пространства пары">
    <p className="text-sm text-[var(--color-text-secondary)]">Пространств в группе: {result.meta.total}</p>
    <ul className="space-y-2">
      {result.data.map((space) => <li key={space.id}><Card padding="sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 font-semibold text-[var(--color-text)]">{space.subject || 'Без названия'}</p>
          <Badge variant={space.isActive ? 'green' : 'slate'} size="sm">{space.isActive ? 'Активно' : 'Архив'}</Badge>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{datePart(space.date)} · пара {space.pairNumber}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{space.teacherName || 'Преподаватель не указан'} · ауд. {space.room || '—'}</p>
      </Card></li>)}
    </ul>
    {result.meta.totalPages > 1 && <ListPagination page={page} pageSize={result.meta.limit} total={result.meta.total} onChange={setPage} />}
  </section>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentMeta, setStudentMeta] = useState<PaginatedResponse<Student>['meta'] | null>(null);
  const [curators, setCurators] = useState<Student[]>([]);
  const [detailError, setDetailError] = useState('');
  const [scheduleAvailable, setScheduleAvailable] = useState(true);
  const curatorLabel = (id?: string) => { const user = curators.find(item => item.id === id); return user ? `${user.lastName} ${user.firstName}` : id ? 'Имя куратора недоступно' : 'Не назначен'; };
  const [selected, setSelected] = useState<Group | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [search, setSearch] = useState('');
  useWorkspaceQuery({ q: search }, query => setSearch((query.get('q') || '').slice(0, 100)));
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [formName, setFormName] = useState('');
  const [formYear, setFormYear] = useState('1');
  const [formFaculty, setFormFaculty] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const studentRequestRef = useRef(0);

  const load = () => { setLoading(true); setError(''); setScheduleAvailable(true); Promise.all([apiFetchAllPages<Group>('/admin/groups'), apiFetchAllPages<Faculty>('/admin/faculties'), apiFetchAllPages<Student>('/admin/users').catch(() => []), apiFetchList<Lesson>(`/schedule/range?startDate=${new Date().getFullYear()}-01-01&endDate=${new Date().getFullYear()}-12-31`).catch(() => { setScheduleAvailable(false); return []; })]).then(([groupItems, facultyItems, curatorItems, lessonItems]) => { setGroups(groupItems); setFaculties(facultyItems); setCurators(curatorItems); setLessons(lessonItems); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить группы.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const courses = [...new Set(groups.map(course).filter((item) => item !== '—'))].sort();
  const filtered = useMemo(() => groups.filter((group) => { const q = search.trim().toLowerCase(); return (!q || group.name.toLowerCase().includes(q)) && (facultyFilter === 'all' || group.facultyId === facultyFilter) && (courseFilter === 'all' || String(course(group)) === courseFilter); }), [groups, search, facultyFilter, courseFilter]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, facultyFilter, courseFilter]);
  const selectedLessons = selected ? lessons.filter((lesson) => lesson.groupId ? lesson.groupId === selected.id : lesson.groupName === selected.name).sort((a, b) => `${a.startDate || a.date || a.startTime || ''} ${a.startTime || ''}`.localeCompare(`${b.startDate || b.date || b.startTime || ''} ${b.startTime || ''}`)) : [];
  const attendanceLessons = selected ? lessons.filter((lesson) => lesson.groupId === selected.id).sort((a, b) => `${b.startDate || b.date || b.startTime || ''} ${b.startTime || ''}`.localeCompare(`${a.startDate || a.date || a.startTime || ''} ${a.startTime || ''}`)) : [];
  const selectedTeachers = [...new Set(selectedLessons.map(lesson => lesson.teacherName || [lesson.teacher?.firstName, lesson.teacher?.lastName].filter(Boolean).join(' ')).filter(Boolean))];

  const openCreate = () => { setEditing(null); setFormName(''); setFormYear('1'); setFormFaculty(faculties[0]?.id || ''); setFormError(''); setModalOpen(true); };
  const openEdit = (group: Group) => { setEditing(group); setFormName(group.name); setFormYear(String(course(group) === '—' ? 1 : course(group))); setFormFaculty(group.facultyId); setFormError(''); setModalOpen(true); };
  const saveGroup = async () => { setSaving(true); setFormError(''); try { const body = { name: formName.trim(), curriculumYear: formYear, facultyId: formFaculty || undefined }; if (editing) await apiFetch(`/admin/groups/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) }); else await apiFetch('/admin/groups', { method: 'POST', body: JSON.stringify(body) }); setModalOpen(false); await load(); } catch (err) { setFormError(`${err instanceof Error ? err.message : 'Не удалось сохранить группу.'} Попробуйте ещё раз.`); } finally { setSaving(false); } };
  const loadStudents = (groupId: string, requestedPage = 1) => { const requestId = ++studentRequestRef.current; setDetailLoading(true); setDetailError(''); apiFetch<PaginatedResponse<Student>>(`/admin/groups/${groupId}/students?page=${requestedPage}&limit=25`).then(result => { if (requestId !== studentRequestRef.current) return; setStudents(result.data); setStudentMeta(result.meta); setStudentPage(result.meta.page); }).catch(reason => { if (requestId !== studentRequestRef.current) return; setStudents([]); setStudentMeta(null); setDetailError(reason instanceof Error ? reason.message : 'Не удалось загрузить студентов группы.'); }).finally(() => { if (requestId === studentRequestRef.current) setDetailLoading(false); }); };
  const closeDetail = () => { studentRequestRef.current += 1; setDetailLoading(false); setSelected(null); };
  const openDetail = (group: Group) => { setSelected(group); setDetailTab('overview'); setDetailError(''); setStudents([]); setStudentMeta(null); setStudentPage(1); loadStudents(group.id, 1); };

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="workspace-kicker">Университет</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text)]">Группы</h1><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Состав учебных групп, кураторство и связанные занятия · {filtered.length} из {groups.length}</p></div><Button onClick={openCreate}>Создать группу</Button></div><div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5 lg:flex-row"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} onSearch={setSearch} placeholder="Поиск групп…" /><select aria-label="Факультет" value={facultyFilter} onChange={(event) => setFacultyFilter(event.target.value)} className="h-11 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)]"><option value="all">Все факультеты</option>{faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select><select aria-label="Курс" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="h-11 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)]"><option value="all">Все курсы</option>{courses.map((item) => <option key={item} value={item}>{item} курс</option>)}</select></div>{loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16" />)}</div> : error && !groups.length ? <RequestState title="Не удалось загрузить группы" description={error} onRetry={load} /> : !filtered.length ? <EmptyState title="Группы не найдены" description="Измените параметры поиска или создайте новую группу." /> : <><div className="grid gap-3 lg:hidden">{visible.map(group => <Card key={group.id} padding="sm"><h2 className="text-base font-semibold">{group.name}</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{facultyName(group, faculties)} · {course(group)} курс</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Куратор: {curatorLabel(group.curatorId)}</p><Button className="mt-3" variant="secondary" onClick={() => openDetail(group)}>Открыть группу →</Button></Card>)}</div><div className="hidden overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white lg:block"><div className="min-w-[900px] grid grid-cols-[1.5fr_1.4fr_1.2fr_1fr_100px] gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"><span>Группа</span><span>Факультет</span><span>Куратор</span><span>Расписание</span><span>Статус</span></div><div className="min-w-[900px] divide-y divide-[var(--color-border)]">{visible.map((group) => { const groupLessons = lessons.filter((lesson) => lesson.groupId ? lesson.groupId === group.id : lesson.groupName === group.name); return <button key={group.id} type="button" onClick={() => openDetail(group)} className="grid w-full grid-cols-[1.5fr_1.4fr_1.2fr_1fr_100px] gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--color-background)]"><span className="font-semibold text-[var(--color-text)]">{group.name}</span><span className="text-sm text-[var(--color-text-secondary)]">{facultyName(group, faculties)}</span><span className="text-sm text-[var(--color-text-secondary)]">{curatorLabel(group.curatorId)}</span><span className="text-sm text-[var(--color-text-secondary)]">{groupLessons.length ? `${groupLessons.length} занятий` : '—'}</span><span><Badge variant="green" size="sm">В структуре</Badge></span></button>; })}</div></div><ListPagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} /></>}{error && groups.length > 0 && <p className="text-sm text-red-700">{error}</p>}{selected && <Sheet open={!modalOpen} onClose={closeDetail} title={selected.name}><p className="text-sm text-[var(--color-text-secondary)]">{facultyName(selected, faculties)} · {course(selected)} курс</p><div role="group" aria-label="Разделы группы" className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">{detailTabs.map((item) => <button key={item.id} type="button" onFocus={(event) => revealHorizontally(event.currentTarget.parentElement, event.currentTarget)} onClick={(event) => { revealHorizontally(event.currentTarget.parentElement, event.currentTarget); setDetailTab(item.id); }} aria-pressed={detailTab === item.id} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${detailTab === item.id ? 'border-slate-900 text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-secondary)] hover:border-slate-300 hover:text-[var(--color-text)]'}`}>{item.label}</button>)}</div>{(detailTab === 'overview' || detailTab === 'students') && detailError ? <RequestState title="Состав группы недоступен" description={detailError} onRetry={() => openDetail(selected)} /> : (detailTab === 'overview' || detailTab === 'students') && detailLoading ? <div className="mt-6"><Skeleton className="h-32" /></div> : detailTab === 'attendance' ? <GroupAttendancePanel key={selected.id} groupName={selected.name} lessons={attendanceLessons} scheduleAvailable={scheduleAvailable} onRetry={load} /> : detailTab === 'overview' ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><Card padding="sm"><p className="text-xs uppercase tracking-wide text-slate-400">Факультет</p><p className="mt-2 font-semibold text-[var(--color-text)]">{facultyName(selected, faculties)}</p></Card><Card padding="sm"><p className="text-xs uppercase tracking-wide text-slate-400">Студенты</p><p className="mt-2 font-semibold text-[var(--color-text)]">{studentMeta?.total ?? students.length}</p></Card><Card padding="sm"><p className="text-xs uppercase tracking-wide text-slate-400">Куратор</p><p className="mt-2 font-semibold text-[var(--color-text)]">{curatorLabel(selected.curatorId)}</p></Card><Card padding="sm"><p className="text-xs uppercase tracking-wide text-slate-400">Статус</p><p className="mt-2"><Badge variant="slate">В структуре</Badge></p></Card><div className="sm:col-span-2"><Button variant="secondary" onClick={() => openEdit(selected)}>Редактировать группу</Button></div></div> : detailTab === 'students' ? <div className="mt-6">{students.length ? <div className="divide-y divide-[var(--color-border)]">{students.map((student) => <div key={student.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-semibold text-[var(--color-text)]">{student.lastName} {student.firstName}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{student.email}</p></div><span className="text-xs text-slate-400">Студент</span></div>)}</div> : <EmptyState title="Студенты не найдены" description="В группе пока нет пользователей со статусом студента." />}{studentMeta && studentMeta.totalPages > 1 && <ListPagination page={studentPage} pageSize={studentMeta.limit} total={studentMeta.total} onChange={nextPage => selected && loadStudents(selected.id, nextPage)} />}</div> : detailTab === 'schedule' ? <div className="mt-6">{!scheduleAvailable ? <RequestState title="Расписание недоступно" description="Не удалось получить занятия. Это не означает, что расписание пустое." onRetry={load} /> : selectedLessons.length ? <div className="space-y-2">{selectedLessons.map((lesson) => <div key={lesson.id} className="rounded-xl bg-[var(--color-background)] px-4 py-3"><div className="flex justify-between gap-3"><span><p className="text-sm font-semibold text-[var(--color-text)]">{lesson.subject || 'Без названия'}</p><span className="mt-1 inline-flex"><LessonTypeBadge subjectType={lesson.subjectType} /></span></span><span className="text-xs text-[var(--color-text-secondary)]">{timePart(lesson.startTime)}–{timePart(lesson.endTime)}</span></div><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{datePart(lesson.startDate || lesson.date || lesson.startTime)} · ауд. {lesson.room || '—'}</p></div>)}</div> : <EmptyState title="Расписание не найдено" description="Для группы нет занятий в загруженном диапазоне." />}</div> : detailTab === 'pairSpaces' ? <GroupPairSpacesPanel key={selected.id} groupId={selected.id} /> : detailTab === 'teachers' ? <div className="mt-6">{selectedTeachers.length ? <ul className="space-y-3">{selectedTeachers.map(name => <li key={name} className="rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium">{name}</li>)}</ul> : <EmptyState title="Имена преподавателей недоступны" description="В загруженном расписании группы нет сведений о преподавателях." />}</div> : <div className="mt-6"><p className="text-sm leading-6 text-[var(--color-text-secondary)]">Для этого раздела отдельный эндпоинт API пока не подключён.</p><Button className="mt-4" variant="secondary" onClick={closeDetail}>Закрыть детали</Button></div>}</Sheet>}<Modal open={modalOpen} onClose={() => { if (!saving) setModalOpen(false); }} title={editing ? 'Редактировать группу' : 'Создать группу'}><div className="space-y-4"><Input label="Название" value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="ИС-21" /><Input label="Учебный год / курс" type="number" min={1} max={6} value={formYear} onChange={(event) => setFormYear(event.target.value)} /><label className="block text-sm font-medium text-[var(--color-text)]">Факультет<select value={formFaculty} onChange={(event) => setFormFaculty(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)]"><option value="">Без факультета</option>{faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label>{formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}<div className="flex justify-end gap-2 pt-2"><Button variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>Отмена</Button><Button loading={saving} disabled={!formName.trim()} onClick={saveGroup}>{editing ? 'Сохранить' : 'Создать'}</Button></div></div></Modal></div>;
}
