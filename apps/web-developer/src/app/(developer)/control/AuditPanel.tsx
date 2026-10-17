'use client';
import { useEffect, useState } from 'react';
import { type Access, type Page, Notice, Pager, inputClass, panelClass, useResource, useTargetUserId } from './control-ui';

interface Entry {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  ip?: string | null;
  userAgent?: string | null;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

interface UniversityOption { id: string; name: string; city: string }

export default function AuditPanel({ access }: { access: Access }) {
  const targetUserId = useTargetUserId();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  useEffect(() => { if (targetUserId) setQuery(targetUserId); }, [targetUserId]);
  const [universityId, setUniversityId] = useState('');
  const universities = useResource<Page<UniversityOption>>(access.permissions.includes('universities.read') ? '/platform/universities?limit=100' : null);
  const filters = new URLSearchParams({ page: String(page), limit: '20' });
  if (query.trim()) filters.set('q', query.trim());
  if (universityId) filters.set('universityId', universityId);
  const list = useResource<Page<Entry>>(`/platform/audit?${filters.toString()}`);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Журнал управления</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.6fr)]">
        <label className="block text-sm">Поиск в журнале<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Действие, объект, причина или ID" /></label>
        {universities.data && <label className="block text-sm">Университет<select className={inputClass} value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все университеты</option>{universities.data.data.map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}</option>)}</select></label>}
      </div>
      {list.error && <Notice error>{list.error}</Notice>}
      {list.data?.data.map(entry => (
        <article key={entry.id} className={panelClass}>
          <p className="break-all font-mono text-sm text-cyan-200">{entry.action}</p>
          <p className="mt-2 text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString('ru-RU')}</p>
          <p className="mt-2 break-all text-xs text-slate-400">Оператор: {entry.userId}</p>
          <p className="mt-1 break-all text-xs text-slate-400">Объект: {entry.entity} · {entry.entityId}</p>
          {(entry.ip || typeof entry.newValues?.ip === 'string') && <p className="mt-1 break-all text-xs text-slate-400">IP: {entry.ip || String(entry.newValues?.ip)}</p>}
          {(entry.userAgent || typeof entry.newValues?.userAgent === 'string') && <details className="mt-2 text-xs text-slate-400"><summary className="min-h-8 cursor-pointer py-2">Технические сведения запроса</summary><p className="break-all">{entry.userAgent || String(entry.newValues?.userAgent)}</p></details>}
          {entry.oldValues && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-slate-400">Было</p>
              <pre className="overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">{JSON.stringify(entry.oldValues, null, 2)}</pre>
            </div>
          )}
          {entry.newValues && (
            <div className="mt-3">
              {typeof entry.newValues.reason === 'string' && <p className="mb-2 text-sm text-amber-100">Причина: {entry.newValues.reason}</p>}
              <p className="mb-1 text-xs font-semibold text-slate-400">Стало</p>
              <pre className="overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">{JSON.stringify(entry.newValues, null, 2)}</pre>
            </div>
          )}
        </article>
      ))}
      {list.data?.data.length === 0 && <p className="text-sm text-slate-400">Действий пока нет.</p>}
      {list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
    </section>
  );
}
