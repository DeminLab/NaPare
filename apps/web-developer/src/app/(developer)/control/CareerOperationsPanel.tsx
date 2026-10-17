'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource, useTargetUserId } from './control-ui';

type Kind = 'applications' | 'works';
interface CareerItem { id: string; taskId: string; taskTitle: string; companyName: string; universityId: string; universityName: string; studentId: string; studentName: string; studentEmail: string; state: string; skill: string; deadline: string; createdAt: string; updatedAt: string; messagePreview?: string; submissionPreview?: string; resultUrl?: string; decisionReason?: string; profiled?: boolean; message?: string; submission?: string }
const applicationStates: Record<string, string> = { pending: 'Ожидает выбора', selected: 'Выбран', not_selected: 'Не выбран', withdrawn: 'Отозван' };
const workStates: Record<string, string> = { in_progress: 'В работе', submitted: 'На приёмке', revision: 'На доработке', accepted: 'Принята' };

export default function CareerOperationsPanel({ access }: { access: Access }) {
  const targetUserId = useTargetUserId();
  const [kind, setKind] = useState<Kind>('applications');
  const [query, setQuery] = useState('');
  useEffect(() => { if (targetUserId) setQuery(targetUserId); }, [targetUserId]);
  const [state, setState] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CareerItem | null>(null);
  const [message, setMessage] = useState('');
  const [submission, setSubmission] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = access.permissions.includes('career-data.write');
  const universityOptions = useResource<Page<{ id: string; name: string; city: string }>>(access.permissions.includes('universities.read') ? '/platform/universities?limit=100' : null);
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (query.trim()) params.set('q', query.trim());
  if (state) params.set('state', state);
  if (universityId) params.set('universityId', universityId);
  const list = useResource<Page<CareerItem>>(`/platform-career/${kind}?${params.toString()}`);
  const refresh = () => list.refresh();

  const open = async (item: CareerItem) => {
    setBusy(true); setError(''); setNotice(''); setSelected(null);
    try {
      const detail = await apiFetch<CareerItem>(`/platform-career/${kind}/${item.id}`);
      setSelected(detail); setMessage(detail.message ?? ''); setSubmission(detail.submission ?? ''); setResultUrl(detail.resultUrl ?? ''); setReason('');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const close = () => { setSelected(null); setMessage(''); setSubmission(''); setResultUrl(''); setReason(''); };
  const run = async (action: 'edit' | 'select' | 'not_selected' | 'accepted' | 'revision') => {
    if (!selected || !canWrite || busy || reason.trim().length < 3) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const path = `/platform-career/${kind}/${selected.id}`;
      if (action === 'edit') {
        const payload = kind === 'applications' ? { message, reason: reason.trim() } : { submission, resultUrl, reason: reason.trim() };
        await apiFetch(path, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        const decision = kind === 'applications' ? (action === 'select' ? 'selected' : 'not_selected') : action;
        await apiFetch(`${path}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason: reason.trim() }) });
      }
      close(); refresh();
      setNotice(action === 'edit' ? 'Данные исправлены и записаны в аудит.' : action === 'select' ? 'Студент выбран, остальные отклики закрыты; переход и уведомления записаны в аудит.' : action === 'accepted' ? 'Работа принята. Это решение не подтверждает оплату.' : action === 'revision' ? 'Студенту направлен запрос на доработку.' : 'Отклик закрыт; студент уведомлён.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  const states = kind === 'applications' ? applicationStates : workStates;
  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Практика и работы</h2><p className="mt-1 text-sm text-slate-400">Поиск откликов и результатов задач. Выбор кандидата и решение по работе выполняются через карьерные переходы и записываются в аудит.</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Тип карьерной записи"><Button aria-pressed={kind === 'applications'} onClick={() => { setKind('applications'); setState(''); setPage(1); close(); }} className={kind === 'applications' ? '!border-cyan-400 !bg-cyan-400/10' : ''}>Отклики</Button><Button aria-pressed={kind === 'works'} onClick={() => { setKind('works'); setState(''); setPage(1); close(); }} className={kind === 'works' ? '!border-cyan-400 !bg-cyan-400/10' : ''}>Работы</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-sm">Поиск по тексту, задаче или студенту<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="ФИО, email, ID, задача, текст" /></label>
      {universityOptions.data && <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все университеты</option>{universityOptions.data.data.map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>}
      <label className="block text-sm">Состояние<select className={inputClass} value={state} onChange={event => { setState(event.target.value); setPage(1); }}><option value="">Любое</option>{Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {(error || list.error || universityOptions.error) && <Notice error>{error || list.error || universityOptions.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    {list.loading && <p role="status" className="text-sm text-slate-400">Загружаем карьерные записи…</p>}
    <div className="divide-y divide-slate-700 rounded-xl border border-slate-700">
      {list.data?.data.map(item => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-semibold">{item.studentName || item.studentId} · {item.taskTitle}</p><p className="mt-1 break-all text-xs text-slate-400">{item.studentEmail} · {item.companyName} · {item.universityName} · {item.skill || 'общее направление'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{kind === 'applications' ? item.messagePreview : item.submissionPreview}</p><p className="mt-1 text-xs text-cyan-200">{states[item.state] || item.state} · срок {item.deadline}</p></div><Button disabled={busy} onClick={() => void open(item)}>Открыть</Button></article>)}
    </div>
    {list.data?.data.length === 0 && <p className="text-sm text-slate-400">Записей по этому запросу нет.</p>}{list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
    {selected && <section className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{selected.studentName || selected.studentId} · {selected.taskTitle}</h3><p className="mt-1 break-all text-xs text-slate-400">{selected.studentEmail} · {selected.companyName} · {selected.universityName} · {selected.id}</p><p className="mt-1 text-xs text-cyan-200">{states[selected.state] || selected.state} · {selected.skill || 'общее направление'} · срок {selected.deadline}</p></div><Button disabled={busy} onClick={close}>Закрыть</Button></div>
      {!canWrite && <Notice>У вас есть право просмотра. Для исправления или карьерных решений требуется разрешение владельца платформы.</Notice>}
      {!canWrite && <div className="space-y-2 rounded-lg border border-slate-700 p-3 text-sm"><p className="whitespace-pre-wrap break-words">{kind === 'applications' ? selected.message : selected.submission}</p>{kind === 'works' && selected.resultUrl && <p className="break-all text-xs text-slate-400">Результат: {selected.resultUrl}</p>}</div>}
      {canWrite && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run('edit'); }}>
        {kind === 'applications' ? <label className="block text-sm">Текст отклика<textarea className={`${inputClass} min-h-32`} minLength={10} maxLength={4000} required value={message} onChange={event => setMessage(event.target.value)} /></label> : <><label className="block text-sm">Результат<textarea className={`${inputClass} min-h-32`} maxLength={10000} required value={submission} onChange={event => setSubmission(event.target.value)} /></label><label className="block text-sm">HTTPS-ссылка на результат<input className={inputClass} type="url" maxLength={2000} value={resultUrl} onChange={event => setResultUrl(event.target.value)} placeholder="https://…" /></label>{selected.decisionReason && <p className="text-xs text-slate-400">Последнее решение: {selected.decisionReason}</p>}</>}
        <label className="block text-sm">Причина администрирования<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Причина исправления или решения" /></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Сохранить исправление'}</Button>{kind === 'applications' && selected.state === 'pending' && <><Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void run('select')}>Выбрать кандидата</Button><Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void run('not_selected')}>Закрыть отклик</Button></>}{kind === 'works' && selected.state === 'submitted' && <><Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void run('accepted')}>Принять работу</Button><Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void run('revision')}>На доработку</Button></>}</div>
      </form>}
    </section>}
  </section>;
}
