'use client';
import { useState } from 'react';
import { type Page, Notice, Pager, panelClass, useResource } from './control-ui';
interface Entry { id: string; userId: string; action: string; entityId: string; createdAt: string; newValues?: Record<string, unknown> }
export default function AuditPanel() {
  const [page,setPage] = useState(1);
  const list = useResource<Page<Entry>>(`/platform/audit?page=${page}&limit=20`);
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Журнал управления</h2>{list.error && <Notice error>{list.error}</Notice>}{list.data?.data.map(entry => <article key={entry.id} className={panelClass}><p className="break-all font-mono text-sm text-cyan-200">{entry.action}</p><p className="mt-2 text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString('ru-RU')}</p><p className="mt-2 break-all text-xs text-slate-400">Аккаунт: {entry.userId}</p><p className="mt-1 break-all text-xs text-slate-400">Объект: {entry.entityId}</p>{entry.newValues && <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">{JSON.stringify(entry.newValues, null, 2)}</pre>}</article>)}{list.data?.data.length === 0 && <p className="text-sm text-slate-400">Действий пока нет.</p>}{list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}</section>;
}
