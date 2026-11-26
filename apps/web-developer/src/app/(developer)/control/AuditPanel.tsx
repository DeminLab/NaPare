'use client';
import { useEffect, useState } from 'react';
import { type Access, type Page, Notice, Pager, inputClass, panelClass, useResource, useTargetUserId } from './control-ui';

interface Entry {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  ip?: string | null;
  userAgent?: string | null;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

interface UniversityOption { id: string; name: string; city: string; status?: string }
const actionNames: Record<string, string> = {
  'platform.universities.search': 'Просмотр списка вузов',
  'platform.accounts.search': 'Поиск аккаунтов',
  'platform.users.search': 'Поиск пользователей',
  'platform.audit.search': 'Поиск в журнале действий',
  'platform.services.search': 'Просмотр состояния сервисов',
};
const sensitiveKey = /(password|passwd|secret|token|authorization|cookie|email|e.?mail|phone|mobile|login|username|user.?name|ip|user.?agent|birth|snils|passport|address|full.?name|first.?name|last.?name|middle.?name|personal.?data|challenge|code)/i;
const freeTextKey = /^(?:case|submission|body|content|message|comment|answer|response|description|details|note|text|transcript|payload|free.?text)(?:text|body|content|value|data)?$/i;
function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sensitiveKey.test(key) || freeTextKey.test(key.replace(/[_-]/g, '')) ? '••••••' : maskSensitive(item)]));
}
const shortId = (value: string | null) => value ? value.replace(/-/g, '').slice(0, 8).toUpperCase() : 'ID недоступен';
const actionLabel = (action: string) => actionNames[action] || action.replace(/^platform\./, '').split('.').map(part => part.replace(/[_-]/g, ' ')).join(' · ');

export default function AuditPanel({ access }: { access: Access }) {
  const targetUserId = useTargetUserId();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  useEffect(() => { if (targetUserId) setQuery(targetUserId); }, [targetUserId]);
  const [organizationId, setOrganizationId] = useState('');
  const universities = useResource<Page<UniversityOption>>(access.permissions.includes('universities.read') ? '/platform/universities?limit=100' : null);
  const filters = new URLSearchParams({ page: String(page), limit: '20' });
  if (query.trim()) filters.set('q', query.trim());
  if (organizationId) filters.set('organizationId', organizationId);
  const list = useResource<Page<Entry>>(`/platform/audit?${filters.toString()}`);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Журнал управления</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.6fr)]">
        <label className="block text-sm">Поиск в журнале<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Действие, объект, причина или ID" /></label>
        {universities.data && <label className="block text-sm">Университет<select className={inputClass} value={organizationId} onChange={event => { setOrganizationId(event.target.value); setPage(1); }}><option value="">Все университеты</option>{universities.data.data.map(university => <option key={university.id} value={university.id}>{university.name} · {university.city}{university.status ? ` · ${university.status}` : ''} · {shortId(university.id)}</option>)}</select></label>}
      </div>
      {list.error && <Notice error>{list.error}</Notice>}
      {list.loading && !list.data && <p role="status" className="text-sm text-slate-400">Загружаем журнал…</p>}
      {list.data?.data.map(entry => (
        <article key={entry.id} className={panelClass}>
          <h3 className="break-words text-sm font-semibold text-[var(--color-text)]">{actionLabel(entry.action)}</h3>
          <p className="mt-2 text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString('ru-RU')}</p>
          <p className="mt-2 break-words text-sm text-slate-300">{entry.entity}: <span className="font-mono text-xs">{shortId(entry.entityId)}</span></p>
          {typeof entry.newValues?.reason === 'string' && <p className="mt-2 break-words text-sm text-amber-100">Причина: {entry.newValues.reason}</p>}
          {typeof entry.newValues?.decisionReason === 'string' && <p className="mt-1 break-words text-sm text-amber-100">Причина решения: {entry.newValues.decisionReason}</p>}
          <details className="mt-2 text-xs text-slate-400"><summary className="min-h-8 cursor-pointer py-2">Технические детали и ID</summary><dl className="grid gap-1 break-all sm:grid-cols-[7rem_1fr]"><dt>Действие</dt><dd className="font-mono">{entry.action}</dd><dt>Оператор ID</dt><dd className="font-mono">{entry.userId}</dd><dt>Объект ID</dt><dd className="font-mono">{entry.entityId || 'ID недоступен'}</dd>{(entry.ip || typeof entry.newValues?.ip === 'string') && <><dt>IP</dt><dd>{entry.ip || String(entry.newValues?.ip)}</dd></>}{(entry.userAgent || typeof entry.newValues?.userAgent === 'string') && <><dt>Браузер</dt><dd>{entry.userAgent || String(entry.newValues?.userAgent)}</dd></>}</dl></details>
          {entry.oldValues && (
            <details className="mt-3"><summary className="min-h-8 cursor-pointer text-sm font-semibold">Предыдущие значения · маскирование известных полей</summary><p className="mt-2 text-xs text-slate-400">Маскирование зависит от названий полей; другие форматы значений могут остаться видимыми.</p><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950/40 p-3 text-xs text-slate-300">{JSON.stringify(maskSensitive(entry.oldValues), null, 2)}</pre></details>
          )}
          {entry.newValues && (
            <div className="mt-3">
              <details><summary className="min-h-8 cursor-pointer text-sm font-semibold">Новые значения · известные чувствительные и текстовые поля маскируются</summary><p className="mt-2 text-xs text-slate-400">Маскирование зависит от названий полей; другие форматы значений могут остаться видимыми.</p><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950/40 p-3 text-xs text-slate-300">{JSON.stringify(maskSensitive(entry.newValues), null, 2)}</pre></details>
            </div>
          )}
        </article>
      ))}
      {list.data?.data.length === 0 && <p className="rounded-xl border border-dashed border-slate-600 p-5 text-sm text-slate-400">По заданным фильтрам записей нет.</p>}
      {list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
    </section>
  );
}
