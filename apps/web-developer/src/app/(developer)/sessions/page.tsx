'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  Icon,
  Input,
  PageHeader,
  Pagination,
  RequestState,
  SearchInput,
  Select,
} from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { roles, type Access, type Page, useResource, useTargetUserId } from '../control/control-ui';
import type { MonitoredUser, SessionPage, UserSession } from '@/lib/analytics';
import { clientLabels, formatDate, formatNumber, relativeTime } from '@/lib/analytics';

const clientOptions = ['web', 'android', 'max', 'api'];

function sessionState(session: UserSession): 'active' | 'revoked' | 'expired' {
  if (session.revokedAt) return 'revoked';
  if (Date.parse(session.expiresAt) <= Date.now()) return 'expired';
  return 'active';
}

export default function PlatformSessionsPage() {
  const targetUserId = useTargetUserId();
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [client, setClient] = useState('');
  const [active, setActive] = useState('true');
  const [universityId, setUniversityId] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserSession | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const access = useResource<Access>('/platform/access');
  const universities = useResource<Page<{ id: string; name: string; city: string }>>('/platform/universities?limit=100');
  const canWrite = !!access.data && (access.data.owner || access.data.permissions.includes('accounts.write'));

  useEffect(() => { if (targetUserId) setUserId(targetUserId); }, [targetUserId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Поиск по email/ФИО сначала резолвит аккаунт, затем ограничивает сессии его ID.
  const resolved = useResource<Page<MonitoredUser>>(search && !userId ? `/platform/monitored-users?q=${encodeURIComponent(search)}&limit=1` : null);
  const effectiveUserId = userId || (search ? resolved.data?.data[0]?.id ?? '' : '');

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (effectiveUserId) params.set('userId', effectiveUserId);
    if (client) params.set('client', client);
    if (active) params.set('active', active);
    if (universityId) params.set('universityId', universityId);
    return `/platform/sessions?${params.toString()}`;
  }, [active, client, effectiveUserId, page, universityId]);

  const sessions = useResource<SessionPage>(path, 30_000);
  const forbidden = sessions.error.toLowerCase().includes('доступ') || sessions.error.toLowerCase().includes('разреш');

  const revoke = async () => {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiFetch<{ changed: boolean }>(`/platform/sessions/${selected.id}/revoke`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      setNotice(result.changed ? 'Сессия завершена, refresh-токен больше не принимается.' : 'Сессия уже была завершена.');
      setSelected(null); setReason('');
      sessions.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось завершить сессию.');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'user',
      header: 'Пользователь',
      render: (session: UserSession) => session.user ? (
        <Link href={`/users/${session.user.id}`} className="block min-w-0 hover:text-[var(--color-brand)]">
          <p className="truncate text-sm font-medium">{session.user.firstName} {session.user.lastName}</p>
          <p className="truncate text-[11px] text-[var(--color-text-secondary)]">{session.user.email} · {roles[session.user.role] ?? session.user.role}</p>
        </Link>
      ) : <span className="text-xs text-[var(--color-text-secondary)]">Аккаунт удалён</span>,
    },
    {
      key: 'device',
      header: 'Устройство',
      render: (session: UserSession) => <div><p className="text-sm">{session.device} · {session.os}</p><p className="text-[11px] text-[var(--color-text-secondary)]">{session.browser} · {clientLabels[session.client] ?? session.client}</p></div>,
    },
    { key: 'ip', header: 'IP', render: (session: UserSession) => <span className="font-mono text-xs">{session.ip || '—'}</span> },
    { key: 'created', header: 'Создана', render: (session: UserSession) => <span className="text-xs">{formatDate(session.createdAt)}</span> },
    { key: 'seen', header: 'Активность', render: (session: UserSession) => <div><p className="text-xs">{relativeTime(session.lastSeenAt)}</p><p className="text-[11px] text-[var(--color-text-secondary)]">до {formatDate(session.expiresAt)}</p></div> },
    {
      key: 'status',
      header: 'Статус',
      render: (session: UserSession) => {
        const state = sessionState(session);
        return <div>{state === 'active' ? <Badge variant="success" dot>Активна</Badge> : state === 'expired' ? <Badge variant="warning">Истекла</Badge> : <Badge variant="danger">Отозвана</Badge>}{session.revokeReason && <p className="mt-1 max-w-[16rem] truncate text-[11px] text-[var(--color-text-muted)]">{session.revokeReason}</p>}</div>;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (session: UserSession) => canWrite && sessionState(session) === 'active'
        ? <Button variant="secondary" size="sm" onClick={() => { setSelected(session); setReason('Завершение сессии администратором'); setError(''); setNotice(''); }}>Завершить</Button>
        : null,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          eyebrow="NaPare · Session control"
          title="Сессии устройств"
          description="Реальные серверные сессии с устройствами, IP и временем последней активности. Принудительный выход отзывает refresh-токен и попадает в журнал администратора."
          actions={<Button variant="secondary" onClick={sessions.refresh} loading={sessions.loading}><Icon name="refresh" size={16} /> Обновить</Button>}
        />

        <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="session-user" className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Пользователь</label>
            <SearchInput id="session-user" value={query} onChange={event => { setQuery(event.target.value); setUserId(''); }} placeholder="Email, ФИО, телефон или ID аккаунта" />
          </div>
          <Select label="Клиент" value={client} onChange={event => { setClient(event.target.value); setPage(1); }}>
            <option value="">Все клиенты</option>
            {clientOptions.map(option => <option key={option} value={option}>{clientLabels[option]}</option>)}
          </Select>
          <Select label="Статус" value={active} onChange={event => { setActive(event.target.value); setPage(1); }}>
            <option value="true">Только активные</option>
            <option value="">Все</option>
            <option value="false">Завершённые</option>
          </Select>
          {!!universities.data?.data.length && <Select label="Университет" value={universityId} onChange={event => { setUniversityId(event.target.value); setPage(1); }}><option value="">Все доступные</option>{universities.data.data.map(university => <option key={university.id} value={university.id}>{university.name}</option>)}</Select>}
        </div>

        {notice && <p role="status" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-brand-soft)] p-3 text-sm text-[var(--color-brand-strong)]">{notice}</p>}
        {error && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

        {sessions.error ? (
          <RequestState kind={forbidden ? 'forbidden' : 'error'} title={forbidden ? 'Нет доступа к сессиям' : 'Не удалось загрузить сессии'} description={sessions.error} onRetry={sessions.refresh} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>{sessions.data ? `${formatNumber(sessions.data.meta.total)} сессий по фильтрам` : 'Загрузка…'}</span>
              {effectiveUserId && <Link href={`/users/${effectiveUserId}`} className="font-semibold text-[var(--color-brand)] hover:underline">Открыть карточку пользователя →</Link>}
            </div>
            <DataTable
              columns={columns}
              data={sessions.data?.data ?? []}
              getRowKey={session => session.id}
              loading={sessions.loading && !sessions.data}
              className="min-w-[62rem]"
              empty={<div className="py-10 text-center"><p className="text-sm font-semibold text-[var(--color-text)]">Сессий не найдено</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Ни одна сессия не соответствует фильтрам или ещё не была создана после входа.</p></div>}
            />
            {sessions.data && <Pagination page={sessions.data.meta.page} totalPages={Math.max(1, sessions.data.meta.totalPages)} onChange={setPage} />}
          </div>
        )}

        <Dialog open={!!selected} onClose={() => { setSelected(null); setReason(''); }} title="Завершить сессию?">
          {selected && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">Сессия будет отозвана немедленно. Пользователь сможет продолжить работу только после нового входа на этом устройстве.</p>
              <dl className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Пользователь</dt><dd className="mt-0.5">{selected.user ? `${selected.user.firstName} ${selected.user.lastName} · ${selected.user.email}` : 'Аккаунт удалён'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Устройство</dt><dd className="mt-0.5">{selected.device} · {selected.os} · {selected.browser}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">IP</dt><dd className="mt-0.5 font-mono text-xs">{selected.ip || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-secondary)]">Последняя активность</dt><dd className="mt-0.5">{formatDate(selected.lastSeenAt)}</dd></div>
              </dl>
              <Input label="Причина" value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} hint="Причина сохраняется в журнале администратора." />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setSelected(null); setReason(''); }} disabled={busy}>Отмена</Button>
                <Button variant="danger" onClick={revoke} loading={busy} disabled={reason.trim().length < 3}>Завершить сессию</Button>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </div>
  );
}
