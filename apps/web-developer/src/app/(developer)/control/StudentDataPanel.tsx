'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';

type DataTab = 'absences' | 'attendance';
interface UniversityOption { id: string; name: string; city: string }
interface AbsenceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityId: string;
  type: string;
  startDate: string;
  endDate: string;
  comment: string | null;
  isSensitive: boolean;
  confirmationRequired: boolean;
  affectedLessonsCount: number;
  source: string | null;
  syncStatus: string;
  createdAt: string;
}
interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityId: string;
  lessonId: string;
  lessonSubject: string;
  lessonStartDate: string | null;
  status: 'present' | 'absent' | 'late';
  comment: string | null;
  markedById: string | null;
  updatedAt: string;
}

const absenceTypes: Record<string, string> = { learning: 'По учёбе', sick: 'Болезнь', work: 'Работа', other_city: 'Другой город', other: 'Другая причина' };
const attendanceStatuses: Record<AttendanceRecord['status'], string> = { present: 'Присутствовал', absent: 'Отсутствовал', late: 'Опоздал' };
const localDateTime = (value: string) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function StudentDataPanel({ access }: { access: Access }) {
  const [tab, setTab] = useState<DataTab>('absences');
  const [query, setQuery] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [absenceType, setAbsenceType] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AbsenceRecord | AttendanceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [absenceForm, setAbsenceForm] = useState<{ type: string; startDate: string; endDate: string; comment: string; isSensitive: boolean; confirmationRequired: boolean } | null>(null);
  const [attendanceForm, setAttendanceForm] = useState<{ status: AttendanceRecord['status']; comment: string } | null>(null);
  const universityOptions = useResource<Page<UniversityOption>>(access.permissions.includes('universities.read') ? '/platform/universities?limit=100' : null);
  const filters = new URLSearchParams({ q: query, page: String(page), limit: '20' });
  if (universityId) filters.set('universityId', universityId);
  if (startDate) filters.set('startDate', new Date(`${startDate}T00:00:00`).toISOString());
  if (endDate) filters.set('endDate', new Date(`${endDate}T23:59:59.999`).toISOString());
  if (tab === 'absences' && absenceType) filters.set('type', absenceType);
  if (tab === 'absences' && confirmationRequired) filters.set('confirmationRequired', confirmationRequired);
  if (tab === 'attendance' && attendanceStatus) filters.set('status', attendanceStatus);
  const listPath = `/platform-data/${tab}?${filters.toString()}`;
  const absences = useResource<Page<AbsenceRecord>>(tab === 'absences' ? listPath : null);
  const attendance = useResource<Page<AttendanceRecord>>(tab === 'attendance' ? listPath : null);
  const writable = access.permissions.includes('student-data.write');
  const records = tab === 'absences' ? absences.data : attendance.data;
  const loading = tab === 'absences' ? absences.loading : attendance.loading;
  const listError = tab === 'absences' ? absences.error : attendance.error;

  const selectTab = (next: DataTab) => { setTab(next); setPage(1); setSelected(null); setReason(''); setError(''); setNotice(''); };
  const clearFilters = () => { setQuery(''); setUniversityId(''); setStartDate(''); setEndDate(''); setAbsenceType(''); setConfirmationRequired(''); setAttendanceStatus(''); setPage(1); };
  const edit = (record: AbsenceRecord | AttendanceRecord) => {
    setSelected(record);
    setReason('');
    setError('');
    if ('startDate' in record) {
      setAbsenceForm({ type: record.type, startDate: localDateTime(record.startDate), endDate: localDateTime(record.endDate), comment: record.comment || '', isSensitive: record.isSensitive, confirmationRequired: record.confirmationRequired });
      setAttendanceForm(null);
    } else {
      setAttendanceForm({ status: record.status, comment: record.comment || '' });
      setAbsenceForm(null);
    }
  };
  const save = async () => {
    if (!selected || reason.trim().length < 3 || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (tab === 'absences' && absenceForm) {
        await apiFetch(`/platform-data/absences/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ ...absenceForm, startDate: new Date(absenceForm.startDate).toISOString(), endDate: new Date(absenceForm.endDate).toISOString(), comment: absenceForm.comment || null, reason: reason.trim() }) });
      } else if (tab === 'attendance' && attendanceForm) {
        await apiFetch(`/platform-data/attendance/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ ...attendanceForm, comment: attendanceForm.comment || null, reason: reason.trim() }) });
      }
      setSelected(null); setAbsenceForm(null); setAttendanceForm(null); setReason(''); setNotice('Изменение сохранено и добавлено в журнал.');
      if (tab === 'absences') absences.refresh(); else attendance.refresh();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Данные студентов</h2>
        <p className="mt-1 text-sm text-slate-400">Глобальный поиск посещаемости и отсутствий. Доступ определяется отдельным разрешением владельца.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Тип данных">
        <Button aria-pressed={tab === 'absences'} onClick={() => selectTab('absences')} className={tab === 'absences' ? 'border-cyan-400 bg-cyan-400/10' : ''}>Отсутствия</Button>
        <Button aria-pressed={tab === 'attendance'} onClick={() => selectTab('attendance')} className={tab === 'attendance' ? 'border-cyan-400 bg-cyan-400/10' : ''}>Посещаемость</Button>
      </div>
      <label className="block text-sm">Поиск по студенту, email, ID или занятию<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {universityOptions.data && <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все университеты</option>{universityOptions.data.data.map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>}
        <label className="block text-sm">С даты<input className={inputClass} type="date" value={startDate} onChange={event => { setStartDate(event.target.value); setPage(1); }} /></label>
        <label className="block text-sm">По дату<input className={inputClass} type="date" value={endDate} onChange={event => { setEndDate(event.target.value); setPage(1); }} /></label>
        {tab === 'absences' ? <>
          <label className="block text-sm">Тип<select className={inputClass} value={absenceType} onChange={event => { setAbsenceType(event.target.value); setPage(1); }}><option value="">Любой тип</option>{Object.entries(absenceTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-sm">Подтверждение<select className={inputClass} value={confirmationRequired} onChange={event => { setConfirmationRequired(event.target.value); setPage(1); }}><option value="">Любое</option><option value="true">Требуется</option><option value="false">Не требуется</option></select></label>
        </> : <label className="block text-sm">Отметка<select className={inputClass} value={attendanceStatus} onChange={event => { setAttendanceStatus(event.target.value); setPage(1); }}><option value="">Любая</option>{Object.entries(attendanceStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <div className="flex items-end"><Button onClick={clearFilters}>Сбросить фильтры</Button></div>
      </div>
      {(error || listError) && <Notice error>{error || listError}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {loading && <p role="status" className="text-sm text-slate-400">Загружаем записи…</p>}
      <div className="divide-y divide-slate-700 rounded-xl border border-slate-700">
        {records?.data.map(record => (
          <article key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <button className="min-w-0 flex-1 text-left" onClick={() => edit(record)}>
              <span className="block break-words text-sm font-semibold">{record.studentName || record.studentId}</span>
              <span className="mt-1 block break-all text-xs text-slate-400">{record.studentEmail} · ID {record.studentId}</span>
              {'startDate' in record
                ? <span className="mt-1 block text-xs text-slate-300">{absenceTypes[record.type] || record.type} · {new Date(record.startDate).toLocaleDateString('ru-RU')} — {new Date(record.endDate).toLocaleDateString('ru-RU')} · затронуто занятий: {record.affectedLessonsCount}</span>
                : <span className="mt-1 block text-xs text-slate-300">{record.lessonSubject || 'Занятие'} · {record.lessonStartDate ? new Date(record.lessonStartDate).toLocaleString('ru-RU') : 'дата не указана'} · {attendanceStatuses[record.status]}</span>}
              {'comment' in record && record.comment && <span className="mt-1 block break-words text-xs text-slate-400">{record.comment}</span>}
            </button>
            <Button onClick={() => edit(record)}>{writable ? 'Открыть и изменить' : 'Просмотреть'}</Button>
          </article>
        ))}
      </div>
      {records?.data.length === 0 && <p className="text-sm text-slate-400">По этому запросу записей нет.</p>}
      {records && <Pager page={page} totalPages={records.meta.totalPages} onChange={setPage} />}

      {selected && <section className={`${panelClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">{selected.studentName || selected.studentId}</h3><p className="mt-1 break-all text-xs text-slate-400">{selected.studentEmail} · {selected.id}</p></div>
          <Button disabled={busy} onClick={() => { setSelected(null); setReason(''); }}>Закрыть</Button>
        </div>
        {!writable ? <Notice>У вас есть право просмотра. Для изменения обратитесь к владельцу платформы.</Notice> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
          {tab === 'absences' && absenceForm && <>
            <label className="block text-sm">Тип отсутствия<select className={inputClass} value={absenceForm.type} onChange={event => setAbsenceForm({ ...absenceForm, type: event.target.value })}>{Object.entries(absenceTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Начало<input className={inputClass} type="datetime-local" required value={absenceForm.startDate} onChange={event => setAbsenceForm({ ...absenceForm, startDate: event.target.value })} /></label><label className="block text-sm">Окончание<input className={inputClass} type="datetime-local" required value={absenceForm.endDate} onChange={event => setAbsenceForm({ ...absenceForm, endDate: event.target.value })} /></label></div>
            <label className="block text-sm">Комментарий<textarea className={`${inputClass} min-h-24`} maxLength={2000} value={absenceForm.comment} onChange={event => setAbsenceForm({ ...absenceForm, comment: event.target.value })} /></label>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={absenceForm.isSensitive} onChange={event => setAbsenceForm({ ...absenceForm, isSensitive: event.target.checked })} />Чувствительная информация</label>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={absenceForm.confirmationRequired} onChange={event => setAbsenceForm({ ...absenceForm, confirmationRequired: event.target.checked })} />Требуется подтверждение</label>
          </>}
          {tab === 'attendance' && attendanceForm && <>
            <label className="block text-sm">Отметка<select className={inputClass} value={attendanceForm.status} onChange={event => setAttendanceForm({ ...attendanceForm, status: event.target.value as AttendanceRecord['status'] })}>{Object.entries(attendanceStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm">Комментарий<textarea className={`${inputClass} min-h-24`} maxLength={2000} value={attendanceForm.comment} onChange={event => setAttendanceForm({ ...attendanceForm, comment: event.target.value })} /></label>
          </>}
          <label className="block text-sm">Причина исправления<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Например: исправление после обращения преподавателя" /></label>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Сохранить исправление'}</Button><Button disabled={busy} onClick={() => { setSelected(null); setReason(''); }}>Отмена</Button></div>
        </form>}
      </section>}
    </section>
  );
}
