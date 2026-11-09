'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  RequestState,
  Skeleton,
  TabBar,
  Table,
} from '@/components/ui';
import { CategoryBadge, SectionCard, SeverityBadge } from '@/components/analytics/Breakdowns';
import { MetricCard } from '@/components/analytics/MetricCard';
import { apiFetch } from '@/lib/api';
import { roles, type Access, useResource } from '../../control/control-ui';
import type { UserActivity, UserSession } from '@/lib/analytics';
import {
  authTypeLabels,
  clientLabels,
  formatDate,
  formatDuration,
  formatNumber,
  relativeTime,
  sourceLabels,
} from '@/lib/analytics';

function sessionState(session: UserSession): 'active' | 'revoked' | 'expired' {
  if (session.revokedAt) return 'revoked';
  if (Date.parse(session.expiresAt) <= Date.now()) return 'expired';
  return 'active';
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const activity = useResource<UserActivity>(id ? `/platform/monitored-users/${id}/activity` : null);
  const access = useResource<Access>('/platform/access');
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [action, setAction] = useState<'block' | 'sessions' | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<UserSession | null>(null);
  const [reason, setReason] = useState('');

  const data = activity.data;
  const user = data?.user;
  const canWrite = !!access.data && (access.data.owner || access.data.permissions.includes('accounts.write'));
  const forbidden = activity.error.toLowerCase().includes('доступ') || activity.error.toLowerCase().includes('разреш');

  const close = () => { setAction(null); setSessionToRevoke(null); setReason(''); };
  const mutate = async (path: string, body: unknown) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
      setNotice('Операция выполнена. История обновлена.');
      close();
      activity.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить операцию.');
    } finally {
      setBusy(false);
    }
  };
  const toggleBlock = async () => {
    if (!user) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/platform/accounts/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive, reason: reason.trim() }) });
      setNotice(user.isActive ? 'Аккаунт заблокирован, сессии отозваны.' : 'Аккаунт разблокирован.');
      close();
      activity.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось изменить статус аккаунта.');
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'sessions', label: 'Сессии', count: data?.sessions.length },
    { id: 'auth', label: 'Входы', count: data?.authEvents.length },
    { id: 'events', label: 'События', count: data?.events.length },
    { id: 'audit', label: 'Аудит', count: data?.audit.length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Link href="/users" className="hover:text-[var(--color-text)]">Пользователи</Link>
          <span>/</span>
          <span className="font-medium text-[var(--color-text)]">Карточка</span>
        </div>

        {activity.error ? (
          <RequestState
            kind={forbidden ? 'forbidden' : 'error'}
            title={forbidden ? 'Нет доступа к карточке' : 'Не удалось загрузить пользователя'}
            description={activity.error}
            onRetry={activity.refresh}
          />
        ) : activity.loading && !data ? (
          <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton lines={6} /></div>
        ) : data && user ? (
          <>
            <Card className="border-[var(--color-border)] bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <Avatar name={`${user.firstName} ${user.lastName}`} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--color-text)]">{user.firstName} {user.lastName}</h1>
                      <Badge variant={user.isActive ? 'success' : 'danger'} dot>{user.isActive ? 'Активен' : 'Заблокирован'}</Badge>
                    </div>
                    <p className="mt-1 break-all text-sm text-[var(--color-text-secondary)]">{user.email}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{roles[user.role] ?? user.role}{user.university ? ` · ${user.university.name}, ${user.university.city}` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={activity.refresh} loading={activity.loading}><Icon name="refresh" size={16} /> Обновить</Button>
                  {canWrite && <Button variant="secondary" onClick={() => { setAction('sessions'); setReason('Принудительный выход администратором'); }}>Завершить сессии</Button>}
                  {canWrite && <Button variant={user.isActive ? 'danger' : 'primary'} onClick={() => { setAction('block'); setReason(user.isActive ? 'Блокировка администратором' : 'Разблокировка администратором'); }}>{user.isActive ? 'Заблокировать' : 'Разблокировать'}</Button>}
                </div>
              </div>
              {!canWrite && <p className="mt-4 text-xs text-[var(--color-text-secondary)]">Доступен только просмотр: нет разрешения accounts.write.</p>}
              {notice && <p role="status" className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-brand-soft)] p-3 text-sm text-[var(--color-brand-strong)]">{notice}</p>}
              {error && <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
            </Card>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label="Активные сессии" value={formatNumber(data.summary.activeSessions)} hint={`${formatNumber(data.summary.sessions)} всего`} icon={<Icon name="dashboard" />} />
              <MetricCard label="Входы" value={formatNumber(data.summary.logins)} hint={`${formatNumber(data.summary.failedLogins)} неудачных`} icon={<Icon name="lock" />} />
              <MetricCard label="События" value={formatNumber(data.summary.events)} hint={`${formatNumber(data.summary.errors)} ошибок`} icon={<Icon name="list" />} tone={data.summary.errors ? 'warning' : 'brand'} />
              <MetricCard label="Последняя активность" value={relativeTime(data.summary.lastActivity)} hint={formatDate(data.summary.lastActivity)} icon={<Icon name="pulse" />} tone="neutral" />
            </div>

            <Card className="border-[var(--color-border)] bg-white p-2 sm:p-3">
              <TabBar tabs={tabs} activeTab={tab} onChange={setTab} ariaLabel="Разделы карточки пользователя" />
              <div className="p-3 sm:p-4">
                {tab === 'overview' && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <SectionCard title="Данные аккаунта" description="Только поля, доступные по текущим правам.">
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">ID</dt><dd className="mt-0.5 break-all font-mono text-xs">{user.id}</dd></div>
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">Телефон</dt><dd className="mt-0.5">{user.phone || 'Не указан'}</dd></div>
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">Роль</dt><dd className="mt-0.5">{roles[user.role] ?? user.role}</dd></div>
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">Университет</dt><dd className="mt-0.5">{user.university ? `${user.university.name}, ${user.university.city}` : 'Не привязан'}</dd></div>
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">Создан</dt><dd className="mt-0.5">{formatDate(user.createdAt)}</dd></div>
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">Обновлён</dt><dd className="mt-0.5">{formatDate(user.updatedAt)}</dd></div>
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">Последний вход</dt><dd className="mt-0.5">{formatDate(user.lastLoginAt)}</dd></div>
                        <div><dt className="text-xs text-[var(--color-text-secondary)]">Последняя активность</dt><dd className="mt-0.5">{formatDate(data.summary.lastActivity)}</dd></div>
                      </dl>
                      {canWrite && <Link href={`/control?tab=accounts&userId=${user.id}`} className="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] px-3 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)]">Изменить данные, роль и доступ <Icon name="arrow-right" size={14} /></Link>}
                    </SectionCard>
                    <SectionCard title="Последние действия" description="Свежие записи журнала по этому пользователю.">
                      {data.events.length ? (
                        <ul className="divide-y divide-[var(--color-border)]">
                          {data.events.slice(0, 8).map(event => (
                            <li key={event.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                              <div className="min-w-0"><p className="truncate font-mono text-xs">{event.name}</p><p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{sourceLabels[event.source] ?? event.source} · {relativeTime(event.createdAt)}</p></div>
                              <SeverityBadge severity={event.severity} />
                            </li>
                          ))}
                        </ul>
                      ) : <EmptyState title="Действий пока нет" description="Для этого пользователя ещё не записано ни одного события." />}
                    </SectionCard>
                  </div>
                )}

                {tab === 'sessions' && (
                  data.sessions.length ? (
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--color-text-secondary)]">Устройства и сессии, сохранённые сервером. Принудительный выход завершает refresh-сессию.</p>
                      <Table>
                        <thead className="bg-[var(--color-surface-secondary)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"><tr><th className="px-3 py-2.5">Устройство</th><th className="px-3 py-2.5">IP</th><th className="px-3 py-2.5">Создана</th><th className="px-3 py-2.5">Активность</th><th className="px-3 py-2.5">Статус</th>{canWrite && <th className="px-3 py-2.5" />}</tr></thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {data.sessions.map(session => {
                            const state = sessionState(session);
                            return (
                              <tr key={session.id} className="hover:bg-[var(--color-surface-secondary)]">
                                <td className="px-3 py-3"><p className="text-sm">{session.device} · {session.os}</p><p className="text-xs text-[var(--color-text-secondary)]">{clientLabels[session.client] ?? session.client} · {session.browser}</p></td>
                                <td className="px-3 py-3 font-mono text-xs">{session.ip || '—'}</td>
                                <td className="px-3 py-3 text-xs">{formatDate(session.createdAt)}</td>
                                <td className="px-3 py-3 text-xs">{relativeTime(session.lastSeenAt)}</td>
                                <td className="px-3 py-3"><Badge variant={state === 'active' ? 'success' : state === 'expired' ? 'warning' : 'danger'}>{state === 'active' ? 'Активна' : state === 'expired' ? 'Истекла' : 'Отозвана'}</Badge>{session.revokeReason && <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{session.revokeReason}</p>}</td>
                                {canWrite && <td className="px-3 py-3 text-right">{state === 'active' && <Button variant="secondary" size="sm" onClick={() => { setSessionToRevoke(session); setReason('Завершение сессии администратором'); }}>Завершить</Button>}</td>}
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  ) : <EmptyState title="Сессий пока нет" description="Пользователь ещё не входил после подключения телеметрии." />
                )}

                {tab === 'auth' && (
                  data.authEvents.length ? (
                    <Table>
                      <thead className="bg-[var(--color-surface-secondary)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"><tr><th className="px-3 py-2.5">Событие</th><th className="px-3 py-2.5">Клиент</th><th className="px-3 py-2.5">IP</th><th className="px-3 py-2.5">Время</th></tr></thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {data.authEvents.map(event => (
                          <tr key={event.id}>
                            <td className="px-3 py-3"><Badge variant={event.type === 'login_failed' ? 'danger' : event.type === 'login_success' ? 'success' : 'slate'}>{authTypeLabels[event.type] ?? event.type}</Badge></td>
                            <td className="px-3 py-3 text-sm">{clientLabels[event.client] ?? event.client}</td>
                            <td className="px-3 py-3 font-mono text-xs">{event.ip || '—'}</td>
                            <td className="px-3 py-3 text-xs">{formatDate(event.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : <EmptyState title="История входов пуста" description="Записи появятся после следующего входа или неудачной попытки." />
                )}

                {tab === 'events' && (
                  data.events.length ? (
                    <Table>
                      <thead className="bg-[var(--color-surface-secondary)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"><tr><th className="px-3 py-2.5">Событие</th><th className="px-3 py-2.5">Категория</th><th className="px-3 py-2.5">Путь</th><th className="px-3 py-2.5">Время</th></tr></thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {data.events.map(event => (
                          <tr key={event.id}>
                            <td className="px-3 py-3"><p className="font-mono text-xs">{event.name}</p><SeverityBadge severity={event.severity} /></td>
                            <td className="px-3 py-3"><CategoryBadge category={event.category} /></td>
                            <td className="px-3 py-3 text-xs">{event.method ? `${event.method} ` : ''}{event.path || '—'}{event.durationMs !== null ? ` · ${formatDuration(event.durationMs)}` : ''}</td>
                            <td className="px-3 py-3 text-xs">{formatDate(event.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : <EmptyState title="Событий пока нет" description="Для пользователя ещё не записаны технические события." />
                )}

                {tab === 'audit' && (
                  data.audit.length ? (
                    <ul className="divide-y divide-[var(--color-border)]">
                      {data.audit.map(entry => (
                        <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-xs text-[var(--color-text)]">{entry.action}</p><span className="text-xs text-[var(--color-text-secondary)]">{formatDate(entry.createdAt)}</span></div>
                          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Администратор: {entry.actorId}</p>
                          {entry.newValues && <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-[var(--color-surface-secondary)] p-2 text-[11px] text-[var(--color-text-secondary)]">{JSON.stringify(entry.newValues, null, 2)}</pre>}
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyState title="Записей аудита нет" description="Здесь появятся изменения аккаунта, выполненные администраторами." />
                )}
              </div>
            </Card>
          </>
        ) : null}

        <Dialog open={action !== null || sessionToRevoke !== null} onClose={close} title={action === 'block' ? (user?.isActive ? 'Заблокировать аккаунт?' : 'Разблокировать аккаунт?') : 'Завершить сессии?'}>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            {action === 'block' ? 'Блокировка запретит вход и отзовёт активные сессии. Действие попадёт в журнал администратора.' : 'Все активные сессии пользователя будут завершены. Пользователь должен будет войти заново.'}
          </p>
          <div className="mt-4"><Input label="Причина" value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} hint="Минимум 3 символа. Причина сохраняется в аудите." /></div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>Отмена</Button>
            <Button
              variant={action === 'block' && user?.isActive ? 'danger' : 'primary'}
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={() => {
                if (sessionToRevoke) void mutate(`/platform/sessions/${sessionToRevoke.id}/revoke`, { reason: reason.trim() });
                else if (action === 'sessions') void mutate(`/platform/monitored-users/${user?.id}/revoke-sessions`, { reason: reason.trim() });
                else void toggleBlock();
              }}
            >
              Подтвердить
            </Button>
          </div>
        </Dialog>
      </div>
    </div>
  );
}
