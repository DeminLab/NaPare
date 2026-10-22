'use client';

import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { errorMessage, fieldClass, type Faculty, type Group } from './types';

export default function StructureStep({ universityId, owner, faculties, groups, reload }: { universityId: string; owner: boolean; faculties: Faculty[]; groups: Group[]; reload: () => Promise<void> }) {
  const [facultyName, setFacultyName] = useState(''), [code, setCode] = useState('');
  const [groupName, setGroupName] = useState(''), [facultyId, setFacultyId] = useState(''), [year, setYear] = useState(1);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState('');
  async function save(event: FormEvent, kind: 'faculty' | 'group') {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(kind);
    const path = owner ? `/platform/organization/${kind === 'faculty' ? 'faculties' : 'groups'}?universityId=${universityId}` : `/admin/${kind === 'faculty' ? 'faculties' : 'groups'}`;
    const data = kind === 'faculty' ? { name: facultyName.trim(), code: code.trim() } : { name: groupName.trim(), facultyId: facultyId || faculties[0]?.id, curriculumYear: owner ? year : String(year) };
    try {
      await apiFetch(path, { method: 'POST', body: JSON.stringify({ ...data, ...(owner ? { reason: 'Первичная настройка университета' } : {}) }) });
      if (kind === 'faculty') { setFacultyName(''); setCode(''); } else setGroupName('');
      setSuccess('Сохранено. Если список не обновился, перечитайте данные — повторно создавать запись не нужно.');
      await reload();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(''); }
  }
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{success}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><h2 className="text-xl font-bold text-slate-950">Факультеты</h2><p className="mt-2 text-sm text-slate-600">Название и уникальный код своего подразделения.</p>
        <ul className="my-4 space-y-2 text-sm">{faculties.map(row => <li key={row.id} className="break-words">{row.name}{row.code ? ` · ${row.code}` : ''}</li>)}</ul>
        <form onSubmit={event => void save(event, 'faculty')} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Название факультета<input required maxLength={200} className={fieldClass} value={facultyName} onChange={event => setFacultyName(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-semibold">Код факультета<input required maxLength={40} className={fieldClass} value={code} onChange={event => setCode(event.target.value)} /></label>
          <Button type="submit" disabled={!!busy || !facultyName.trim() || !code.trim()} loading={busy === 'faculty'}>Добавить факультет</Button>
        </form>
      </Card>
      <Card><h2 className="text-xl font-bold text-slate-950">Учебные группы</h2><p className="mt-2 text-sm text-slate-600">Название должно точно совпадать с файлом расписания.</p>
        <ul className="my-4 space-y-2 text-sm">{groups.map(row => <li key={row.id} className="break-words">{row.name} · {faculties.find(faculty => faculty.id === row.facultyId)?.name || 'Факультет недоступен'}</li>)}</ul>
        <form onSubmit={event => void save(event, 'group')} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Факультет группы<select required className={fieldClass} value={facultyId || faculties[0]?.id || ''} onChange={event => setFacultyId(event.target.value)}><option value="" disabled>Добавьте факультет</option>{faculties.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold">Название группы<input required maxLength={120} className={fieldClass} value={groupName} onChange={event => setGroupName(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-semibold">Курс<input required type="number" min={1} max={12} className={fieldClass} value={year} onChange={event => setYear(Number(event.target.value))} /></label>
          <Button type="submit" disabled={!!busy || !faculties.length || !groupName.trim()} loading={busy === 'group'}>Добавить группу</Button>
        </form>
      </Card>
    </div>
  </div>;
}
