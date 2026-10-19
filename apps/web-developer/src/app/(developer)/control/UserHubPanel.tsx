'use client';
import { useEffect, useState } from 'react';
import { type Access, type Page, Button, Notice, Pager, inputClass, panelClass, roles, useResource, useTargetUserId } from './control-ui';

interface UserSummary { id: string; email: string; firstName: string; lastName: string; role: string; universityId: string | null; universityName?: string | null; groupId?: string | null; isActive: boolean; university?: { name: string; city: string } | null }
interface AccountRow extends UserSummary { university?: { name: string; city: string } | null }
type Navigate = (tab: string, userId: string) => void;

export default function UserHubPanel({ access, onNavigate }: { access: Access; onNavigate: Navigate }) {
  const targetUserId = useTargetUserId();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => { if (targetUserId) { setQuery(targetUserId); setSelectedId(targetUserId); } }, [targetUserId]);
  const canReadAccounts = access.permissions.includes('accounts.read');
  const params = new URLSearchParams({ q: query, page: String(page), limit: '20' });
  const path = canReadAccounts ? `/platform/accounts?${params}` : `/platform-records/users?${params}`;
  const users = useResource<Page<AccountRow | UserSummary>>(path);
  const selected = users.data?.data.find(user => user.id === selectedId) || null;
  const targets = [
    { permission: 'accounts.read', tab: 'accounts', label: 'Аккаунт' },
    { permission: 'student-data.read', tab: 'student-data', label: 'Посещаемость и отсутствия' },
    { permission: 'personal-data.read', tab: 'personal-records', label: 'Личные записи' },
    { permission: 'notification-data.read', tab: 'notifications-data', label: 'Уведомления и входящие' },
    { permission: 'homework-data.read', tab: 'homework-submissions', label: 'Сдачи домашних заданий' },
    { permission: 'career-data.read', tab: 'career-data', label: 'Карьерный профиль и допуски' },
    { permission: 'career-data.read', tab: 'career-operations', label: 'Заявки и практика' },
    { permission: 'career-data.read', tab: 'career-memberships', label: 'Карьерные права и назначения' },
    { permission: 'career-data.read', tab: 'career-tests', label: 'Карьерные тесты и попытки' },
    { permission: 'career-data.read', tab: 'career-content', label: 'Кейсы, отзывы и уведомления' },
    { permission: 'career-data.read', tab: 'career-planning', label: 'Планирование карьеры' },
    { permission: 'discussion-data.read', tab: 'discussions', label: 'Обсуждения' },
    { permission: 'audit.read', tab: 'audit', label: 'Журнал действий' },
  ].filter((item, index, list) => access.permissions.includes(item.permission) && list.findIndex(candidate => candidate.tab === item.tab) === index);

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Обзор пользователя</h2><p className="mt-1 text-sm text-slate-400">Найдите аккаунт один раз и откройте его данные в разделах, доступных по вашим разрешениям. Изменения выполняются в соответствующем разделе и записываются в аудит.</p></div>
    {users.error && <Notice error>{users.error}</Notice>}
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        <label className="block text-sm">Поиск пользователя<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); setSelectedId(''); }} placeholder="ФИО, email, телефон, группа или UUID" /></label>
        {users.loading && <p role="status" className="text-sm text-slate-400">Ищем пользователей…</p>}
        <div className="max-h-[34rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">{users.data?.data.map(user => <button key={user.id} aria-pressed={selectedId === user.id} className={`block min-h-16 w-full p-3 text-left hover:bg-slate-800 ${selectedId === user.id ? 'bg-cyan-400/10' : ''}`} onClick={() => setSelectedId(user.id)}><span className="block text-sm font-semibold">{user.lastName} {user.firstName}</span><span className="mt-1 block break-all text-xs text-slate-400">{user.email}</span><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{roles[user.role] || user.role} · {user.isActive ? 'Активен' : 'Заблокирован'}</span></button>)}</div>
        {users.data && <><p className="text-xs text-[var(--color-text-muted)]">Найдено: {users.data.meta.total}</p><Pager page={page} totalPages={users.data.meta.totalPages} onChange={setPage} /></>}
        {users.data?.data.length === 0 && <p className="text-sm text-slate-400">Пользователи не найдены.</p>}
      </div>
      <div className="min-w-0 space-y-4">
        {!selected && <div className={panelClass}><p className="text-sm text-slate-400">Выберите пользователя, чтобы увидеть его карточку и доступные разделы.</p></div>}
        {selected && <>
          <article className={`${panelClass} space-y-4`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-semibold">{selected.lastName} {selected.firstName}</h3><p className="mt-1 break-all text-sm text-slate-300">{selected.email}</p><p className="mt-2 text-sm text-slate-400">{roles[selected.role] || selected.role}</p><p className="mt-1 text-sm text-slate-400">{selected.university?.name || selected.universityName || 'Университет не указан'}{selected.groupId ? ` · группа ${selected.groupId}` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${selected.isActive ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{selected.isActive ? 'Активен' : 'Заблокирован'}</span></div><div className="rounded-lg border border-slate-700 p-3"><p className="text-xs text-[var(--color-text-muted)]">UUID пользователя</p><p className="mt-1 break-all font-mono text-xs text-cyan-100">{selected.id}</p></div></article>
          <section className={`${panelClass} space-y-3`}><div><h3 className="font-semibold">Связанные данные</h3><p className="mt-1 text-sm text-slate-400">Откройте нужный раздел — поиск уже будет установлен на этого пользователя.</p></div>{targets.length ? <div className="grid gap-2 sm:grid-cols-2">{targets.map(item => <Button key={item.tab} className="text-left" onClick={() => onNavigate(item.tab, selected.id)}>{item.label} <span aria-hidden="true">→</span></Button>)}</div> : <p className="text-sm text-slate-400">Для связанных разделов не выданы разрешения.</p>}</section>
        </>}
      </div>
    </div>
  </section>;
}
