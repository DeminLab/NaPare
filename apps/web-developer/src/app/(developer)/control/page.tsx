'use client';
import { useEffect, useState } from 'react';
import ServicesPanel from './ServicesPanel';
import AccountsPanel from './AccountsPanel';
import PermissionsPanel from './PermissionsPanel';
import SettingsPanel from './SettingsPanel';
import UniversitiesPanel from './UniversitiesPanel';
import AuditPanel from './AuditPanel';
import { type Access, Button, Notice, useResource } from './control-ui';

const tabs = [{ id: 'services', label: 'Сервисы', permission: 'services.read' }, { id: 'accounts', label: 'Аккаунты', permission: 'accounts.read' }, { id: 'universities', label: 'Университеты', permission: 'universities.read' }, { id: 'permissions', label: 'Контур доверия', permission: 'owner' }, { id: 'settings', label: 'Настройки', permission: 'settings.read' }, { id: 'audit', label: 'Журнал', permission: 'audit.read' }];
export default function PlatformControlPage() {
  const context = useResource<Access>('/platform/access', 30000);
  const [tab,setTab] = useState('services');
  const access = context.data;
  const available = tabs.filter(item => item.permission === 'owner' ? access?.owner : access?.permissions.includes(item.permission));
  useEffect(() => { const query = new URLSearchParams(window.location.search).get('tab'); if (query && tabs.some(item => item.id === query)) setTab(query); }, []);
  useEffect(() => { const refresh = () => context.refresh(); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [context.refresh]);
  const active = available.find(item => item.id === tab)?.id || available[0]?.id;
  const select = (id: string) => { setTab(id); const url = new URL(window.location.href); url.searchParams.set('tab',id); window.history.replaceState(null,'',url); };
  return <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-100 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Управление платформой</h1>{access && <p className="mt-2 text-sm text-slate-400">{access.owner ? 'Владелец · полный доступ' : 'Доступ по выданным разрешениям'}</p>}</div><Button onClick={context.refresh} disabled={context.loading}>Обновить доступ</Button></div>
    {context.error && <Notice error>{context.error}</Notice>}{!access && !context.error && <p role="status" className="text-sm text-slate-400">Проверяем доступ…</p>}
    {access && !access.ownerConfigured && <Notice error>Владелец ещё не назначен на этом сервере. Требуется первоначальная настройка через серверную команду; автоматической выдачи прав по email нет.</Notice>}
    {access?.ownerConfigured && !available.length && <Notice>Разрешения на управление пока не выданы. Их назначает владелец платформы.</Notice>}
    {!!available.length && <nav aria-label="Разделы управления платформой" className="flex gap-2 overflow-x-auto pb-2">{available.map(item => <Button key={item.id} aria-pressed={active === item.id} className={active === item.id ? '!border-cyan-400 !bg-cyan-400/15 !text-cyan-100 whitespace-nowrap' : 'whitespace-nowrap'} onClick={() => select(item.id)}>{item.label}</Button>)}</nav>}
    {access && <>{active === 'services' && <ServicesPanel access={access} />}{active === 'accounts' && <AccountsPanel access={access} />}{active === 'universities' && <UniversitiesPanel access={access} />}{active === 'permissions' && access.owner && <PermissionsPanel access={access} />}{active === 'settings' && <SettingsPanel access={access} />}{active === 'audit' && <AuditPanel />}</>}
  </div>;
}
