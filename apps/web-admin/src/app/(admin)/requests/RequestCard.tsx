'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch, type PaginatedResponse } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { controlClass, dateLabel, dutyLabels, nameOf, statusLabels, typeLabels, type Person, type RequestDetail } from './types';

const actions = { submit: 'Подать заявление', accept: 'Принять в работу', needs_changes: 'Запросить уточнение', revise: 'Отправить уточнение', approve: 'Согласовать этап', reject: 'Отказать', withdraw: 'Отозвать', close: 'Закрыть заявление', reassign: 'Сменить согласующего' };
export function RequestCard({ request, onChange, onBack }: { request: RequestDetail; onChange: () => Promise<void>; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [action, setAction] = useState<keyof typeof actions>('accept');
  const [reason, setReason] = useState(''), [description, setDescription] = useState(request.description), [reference, setReference] = useState('');
  const [sequence, setSequence] = useState(0), [assigneeId, setAssigneeId] = useState(''), [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [success, setSuccess] = useState('');
  const intent = useRef({ fingerprint: '', key: '' });
  useEffect(() => { heading.current?.focus(); }, [request.id]);
  useEffect(() => {
    let active = true;
    apiFetch<PaginatedResponse<Person>>(`/requests/candidates?groupId=${request.groupId}&limit=100`).then(result => { if (active) setPeople(result.data); }).catch(() => { if (active) setPeople([]); });
    return () => { active = false; };
  }, [request.groupId]);
  const available = request.availableActions;
  const selected = available.includes(action) ? action : available[0] as keyof typeof actions;
  const selectedSequence = request.steps.some(step => step.state === 'pending' && step.sequence === sequence) ? sequence : request.steps.find(step => step.state === 'pending')?.sequence ?? 0;
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    const payload = { action: selected, version: request.version, reason, ...(selected === 'revise' ? { description } : {}), ...(selected === 'close' ? { resultReference: reference } : {}), ...(selected === 'reassign' ? { sequence: selectedSequence, assigneeId } : {}) };
    const fingerprint = JSON.stringify(payload);
    if (intent.current.fingerprint !== fingerprint) intent.current = { fingerprint, key: crypto.randomUUID() };
    try {
      await apiFetch(`/requests/${request.id}/commands`, { method: 'POST', body: JSON.stringify({ ...payload, idempotencyKey: intent.current.key }) });
      intent.current = { fingerprint: '', key: '' }; setReason(''); setSuccess('Действие сохранено. Текущий этап и история обновлены.'); await onChange();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить действие.'); }
    finally { setSaving(false); }
  }
  return <div className="space-y-5">
    <Button variant="secondary" onClick={onBack}>← К очереди</Button>
    <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-600">{typeLabels[request.type]} · {request.studentName}</p><h2 ref={heading} tabIndex={-1} className="mt-1 text-2xl font-bold text-slate-950 focus-visible:outline-indigo-500">{request.title}</h2></div><span className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900">{statusLabels[request.status]}</span></div><p className="mt-5 whitespace-pre-wrap break-words text-slate-800">{request.description}</p><p className="mt-4 text-sm text-slate-600">Текущий срок: {dateLabel(request.dueAt)} · Версия маршрута {request.workflowVersion}</p>{request.resultReference && <p className="mt-3 text-sm text-slate-800">Результат: {request.resultReference}</p>}{request.documents.length > 0 && <p className="mt-3 text-sm text-slate-600">Приложено документов: {request.documents.length}. Доступ к самим файлам проверяется в исходном разделе.</p>}</Card>
    <Card><h3 className="text-lg font-bold text-slate-950">Согласование</h3>{request.steps.length ? <ol className="mt-4 space-y-3">{request.steps.map(step => <li key={step.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-950">{step.sequence + 1}. {dutyLabels[step.duty]}</p><p className="mt-1 text-sm text-slate-700">{step.assigneeName} · {step.state === 'approved' ? 'Согласовано' : step.state === 'rejected' ? 'Отказано' : 'Ожидает решения'}</p><p className="mt-1 text-sm text-slate-600">Срок: {dateLabel(step.dueAt)}</p></li>)}</ol> : <p className="mt-3 text-sm text-slate-600">Маршрут будет проверен и зафиксирован при подаче. Если сотрудник не назначен, заявление останется черновиком.</p>}</Card>
    {available.length > 0 && <Card><h3 className="text-lg font-bold text-slate-950">Действие по заявлению</h3><p className="mt-1 text-sm text-slate-600">Доступны действия по вашему текущему назначению.</p><form className="mt-4 grid gap-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-semibold text-slate-800">Действие<select value={selected} className={controlClass} onChange={event => { setAction(event.target.value as keyof typeof actions); setError(''); }}>{available.map(value => <option key={value} value={value}>{actions[value as keyof typeof actions]}</option>)}</select></label>
      {selected === 'revise' && <label className="grid gap-2 text-sm font-semibold text-slate-800">Уточнённое содержание<textarea required minLength={5} maxLength={10000} rows={5} className={controlClass} value={description} onChange={event => setDescription(event.target.value)} /></label>}
      {selected === 'reassign' && <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-slate-800">Незавершённый этап<select className={controlClass} value={selectedSequence} onChange={event => setSequence(Number(event.target.value))}>{request.steps.filter(step => step.state === 'pending').map(step => <option key={step.id} value={step.sequence}>{step.sequence + 1}. {dutyLabels[step.duty]}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold text-slate-800">Новый согласующий<select className={controlClass} required value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">Выберите сотрудника</option>{people.filter(person => person.id !== request.studentId).map(person => <option key={person.id} value={person.id}>{nameOf(person)}</option>)}</select></label></div>}
      <label className="grid gap-2 text-sm font-semibold text-slate-800">Основание или комментарий<textarea className={controlClass} rows={3} maxLength={2000} required={['needs_changes', 'revise', 'approve', 'reject', 'close', 'reassign'].includes(selected)} value={reason} onChange={event => setReason(event.target.value)} /></label>
      {selected === 'close' && <label className="grid gap-2 text-sm font-semibold text-slate-800">Реквизиты результата<input className={controlClass} maxLength={300} value={reference} onChange={event => setReference(event.target.value)} placeholder="Номер приказа или записи об отсутствии" /></label>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}<div className="flex flex-wrap items-center gap-3"><Button type="submit" loading={saving}>{actions[selected]}</Button><Button type="button" variant="secondary" disabled={saving} onClick={() => void onChange()}>Обновить карточку</Button></div>
    </form></Card>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>}
    <Card><h3 className="text-lg font-bold text-slate-950">История решений</h3>{request.history.length ? <ol className="mt-4 divide-y divide-slate-200">{request.history.map(item => <li key={item.id} className="py-4"><p className="text-sm font-semibold text-slate-950">{actions[item.action as keyof typeof actions] || item.action} · {item.actorName}</p><p className="mt-1 text-sm text-slate-600">{dateLabel(item.createdAt)} · {statusLabels[item.fromStatus]} → {statusLabels[item.toStatus]}</p>{item.reason && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{item.reason}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-slate-600">Решений пока нет. История появится после подачи заявления.</p>}</Card>
  </div>;
}
