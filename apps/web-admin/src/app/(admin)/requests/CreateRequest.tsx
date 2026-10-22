'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch, type PaginatedResponse } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { controlClass, nameOf, typeLabels, type OfficeContext, type Person } from './types';

export function CreateRequest({ context, onCreated, onCancel }: { context: OfficeContext; onCreated: (id: string) => void; onCancel: () => void }) {
  const [groupId, setGroupId] = useState(''), [students, setStudents] = useState<Person[]>([]), [studentId, setStudentId] = useState(''), [q, setQ] = useState('');
  const [type, setType] = useState<keyof typeof typeLabels>('absence'), [title, setTitle] = useState(''), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [searching, setSearching] = useState(false);
  const intent = useRef({ fingerprint: '', key: '' });
  useEffect(() => {
    const controller = new AbortController();
    setStudentId(''); setStudents([]); setError('');
    if (!groupId) return () => controller.abort();
    setSearching(true);
    const timer = setTimeout(() => {
      apiFetch<PaginatedResponse<Person>>(`/requests/students?groupId=${groupId}&limit=100&q=${encodeURIComponent(q)}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setStudents(result.data); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Список студентов недоступен.'); }).finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [groupId, q]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    const payload = { studentId, type, title, description }, fingerprint = JSON.stringify(payload);
    if (intent.current.fingerprint !== fingerprint) intent.current = { fingerprint, key: crypto.randomUUID() };
    try { const result = await apiFetch<{ id: string }>('/requests', { method: 'POST', body: JSON.stringify({ ...payload, idempotencyKey: intent.current.key }) }); onCreated(result.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать черновик.'); } finally { setBusy(false); }
  }
  return <Card><h2 className="text-xl font-bold text-slate-950">Заявление от имени студента</h2><p className="mt-2 text-sm text-slate-600">Сначала создаётся черновик. Подача и авторство сотрудника сохраняются в истории.</p><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
    <label className="grid gap-2 text-sm font-semibold text-slate-800">Группа<select required className={controlClass} value={groupId} onChange={event => setGroupId(event.target.value)}><option value="">Выберите группу</option>{context.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <label className="grid gap-2 text-sm font-semibold text-slate-800">Поиск студента<input className={controlClass} value={q} onChange={event => setQ(event.target.value)} placeholder="Фамилия или имя" disabled={!groupId} /></label>
    <label className="grid gap-2 text-sm font-semibold text-slate-800">Студент<select required className={controlClass} value={studentId} onChange={event => setStudentId(event.target.value)} disabled={searching || !groupId}><option value="">{searching ? 'Поиск…' : 'Выберите студента'}</option>{students.map(student => <option key={student.id} value={student.id}>{nameOf(student)}</option>)}</select></label>
    <label className="grid gap-2 text-sm font-semibold text-slate-800">Тип<select className={controlClass} value={type} onChange={event => setType(event.target.value as keyof typeof typeLabels)}>{Object.entries(typeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="grid gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">Название<input required minLength={3} maxLength={200} className={controlClass} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label className="grid gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">Содержание<textarea required minLength={5} maxLength={10000} rows={5} className={controlClass} value={description} onChange={event => setDescription(event.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-red-800 sm:col-span-2">{error}</p>}<div className="flex flex-wrap gap-3 sm:col-span-2"><Button type="submit" loading={busy} disabled={!studentId || searching}>Создать черновик</Button><Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Отмена</Button></div>
  </form></Card>;
}
