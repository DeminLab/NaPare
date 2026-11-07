'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Icon,
  PageHeader,
  Pagination,
  RequestState,
  SearchInput,
  Select,
} from '@/components/ui';
import { roles, type Access, type Page, useResource } from '../control/control-ui';
import type { MonitoredUser, UserPage } from '@/lib/analytics';
import { formatDate, formatNumber, relativeTime } from '@/lib/analytics';

export default function MonitoredUsersPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [page, setPage] = useState(1);
  const access = useResource<Access>('/platform/access');
  const universities = useResource<Page<{ id: string; name: string; city: string }>>('/platform/universities?limit=100');

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('q', search);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (universityId) params.set('universityId', universityId);
    return `/platform/monitored-users?${params.toString()}`;
  }, [page, search, role, status, universityId]);
  const users = useResource<UserPage>(path, 60_000);
  const forbidden = users.error.toLowerCase().includes('доступ') || users.error.toLowerCase().includes('разреш');

  const columns = [
    {
      key: 'user',
      header: 'Пользователь',
      render: (user: MonitoredUser) => (
        <Link href={`/users/${user.id}`} className="group block min-w-0">
          <span className="block truncate text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-brand)]">{user.firstName} {user.lastName}</span>
          <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">{user.email}</span>
        </Link>
      ),
    },
    {
      key: 'role',
      header: 'Роль',
      render: (user: MonitoredUser) => <Badge variant="slate">{roles[user.role] ?? user.role}</Badge>,
    },
    {
      key: 'university',
      header: 'Вуз',
      render: (user: MonitoredUser) => user.university ? <div><p className="text-sm">{user.university.name}</p><p className="text-xs text-[var(--color-text-secondary)]">{user.university.city}</p></div> : <span className="text-sm text-[var(--color-text-secondary)]">Не указан</span>,
    },
    {
      key: 'activity',
      header: 'Последняя активность',
      render: (user: MonitoredUser) => <div><p className="text-sm">{relativeTime(user.lastSeenAt ?? user.lastLoginAt)}</p><p className="text-xs text-[var(--color-text-secondary)]">вход {relativeTime(user.lastAuthAt)}</p></div>,
    },
    {
      key: 'sessions',
      header: 'Сессии',
      render: (user: MonitoredUser) => <div className="flex items-center gap-2"><span className="text-sm font-semibold tabular-nums">{formatNumber(user.activeSessions)}</span><span className="text-xs text-[var(--color-text-secondary)]">из {formatNumber(user.sessionCount)}</span></div>,
    },
    {
      key: 'logins',
      header: 'Входы',
      render: (user: MonitoredUser) => <span className="text-sm tabular-nums">{formatNumber(user.loginCount)}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      render: (user: MonitoredUser) => <Badge variant={user.isActive ? 'success' : 'danger'} dot>{user.isActive ? 'Активен' : 'Заблокирован'}</Badge>,
    },
    {
      key: 'open',
      header: '',
      className: 'text-right',
      render: (user: MonitoredUser) => <Link href={`/users/${user.id}`} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[var(--color-brand)] hover:underline">Карточка <Icon name="chevron-right" size={14} /></Link>,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          eyebrow="NaPare · User monitoring"
          title="Пользователи"
          description="Полный список аккаунтов с последней активностью, устройствами и историей входов. Данные ограничены правами и университетами."
          actions={<Button variant="secondary" onClick={users.refresh} loading={users.loading}><Icon name="refresh" size={16} /> Обновить</Button>}
        />

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="user-search" className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Поиск</label>
            <SearchInput id="user-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Имя, email, телефон или ID" />
          </div>
          <div className="w-full sm:w-52">
            <Select label="Роль" value={role} onChange={event => { setRole(event.target.value); setPage(1); }}>
              <option value="">Все роли</option>
              {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <Select label="Статус" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
              <option value="">Все</option>
              <option value="active">Активные</option>
              <option value="blocked">Заблокированные</option>
            </Select>
          </div>
          {!!universities.data?.data.length && (
            <div className="w-full sm:w-64">
              <Select label="Университет" value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}>
                <option value="">Все доступные</option>
                {universities.data.data.map(university => <option key={university.id} value={university.id}>{university.name}</option>)}
              </Select>
            </div>
          )}
        </div>

        {users.error ? (
          <RequestState
            kind={forbidden ? 'forbidden' : 'error'}
            title={forbidden ? 'Нет доступа к мониторингу' : 'Не удалось загрузить пользователей'}
            description={users.error}
            onRetry={users.refresh}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>{users.data ? `Найдено ${formatNumber(users.data.meta.total)} аккаунтов` : 'Загрузка…'}</span>
              {access.data && !access.data.owner && access.data.universityIds !== null && <span>Доступ ограничен {formatNumber(access.data.universityIds.length)} вузами</span>}
            </div>
            <DataTable
              columns={columns}
              data={users.data?.data ?? []}
              getRowKey={user => user.id}
              loading={users.loading && !users.data}
              empty={<div className="py-10 text-center"><p className="text-sm font-semibold text-[var(--color-text)]">Пользователи не найдены</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Измените поиск или фильтры. Пустой список означает, что запрос не вернул аккаунтов.</p></div>}
            />
            {users.data && <Pagination page={users.data.meta.page} totalPages={Math.max(1, users.data.meta.totalPages)} onChange={setPage} />}
          </div>
        )}

        <p className="text-[11px] leading-5 text-[var(--color-text-muted)]">
          История активности ограничена сроком хранения телеметрии. Дата создания аккаунта: {formatDate(users.data?.data[0]?.createdAt)} у первой записи. Для полной истории откройте карточку пользователя.
        </p>
      </div>
    </div>
  );
}
