'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui';
import { apiFetch, logout } from '@/lib/api';
import type { UserSession } from '@/lib/analytics';
import { clientLabels, formatNumber, relativeTime } from '@/lib/analytics';

function sessionState(session: UserSession): 'active' | 'revoked' | 'expired' {
  if (session.revokedAt) return 'revoked';
  if (Date.parse(session.expiresAt) <= Date.now()) return 'expired';
  return 'active';
}

export default function MySessionsPage() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [target, setTarget] = useState<UserSession | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<{ data: UserSession[]; currentSessionId: string | null }>('/auth/sessions');
      setSessions(result.data);
      setCurrentId(result.currentSessionId);
      setLoadError('');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Не удалось загрузить сессии.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const revoke = async () => {
    if (!target) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      const result = await apiFetch<{ changed: boolean }>(`/auth/sessions/${target.id}/revoke`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() || 'Выход с устройства' }) });
      setNotice(result.changed ? 'Сессия завершена — на этом устройстве нужно войти заново.' : 'Сессия уже была завершена.');
      setTarget(null); setReason('');
      await load();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Не удалось завершить сессию.');
    } finally {
      setBusy(false);
    }
  };

  const activeCount = sessions.filter(session => sessionState(session) === 'active').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          eyebrow="Доступ · ваш аккаунт"
          title="Мои сессии"
          description="Серверные сессии вашего аккаунта: устройства, IP и последняя активность. Данные приходят из таблицы user_sessions, а не из локального токена."
          actions={<Button variant="secondary" onClick={load} loading={loading}><Icon name="refresh" size={16} /> Обновить</Button>}
        />

        {loadError && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{loadError}</p>}
        {notice && <p role="status" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-brand-soft)] p-3 text-sm text-[var(--color-brand-strong)]">{notice}</p>}
        {actionError && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{actionError}</p>}

        <section aria-label="Состояние сессий" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="border-[var(--color-border)] bg-white p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Активные сессии</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-text)]">{loading ? '—' : formatNumber(activeCount)}</p>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">на всех устройствах</span>
          </Card>
          <Card className="border-[var(--color-border)] bg-white p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Это устройство</p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{currentId ? 'Сессия найдена' : 'Сессия не определена'}</p>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">определяется по серверной записи</span>
          </Card>
          <Card className="border-[var(--color-border)] bg-white p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Отзыв токенов</p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-success)]">Работает на сервере</p>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">выход завершает все сессии аккаунта</span>
          </Card>
        </section>

        <Card className="border-[var(--color-border)] bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">История сессий аккаунта</h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Показаны последние 50 сессий. Отозванная сессия не сможет продлить доступ даже с валидным refresh-токеном.</p>
          <div className="mt-4">
            {loading ? (
              <Skeleton lines={5} />
            ) : sessions.length ? (
              <ul className="divide-y divide-[var(--color-border)]">
                {sessions.map(session => {
                  const state = sessionState(session);
                  const isCurrent = session.id === currentId;
                  return (
                    <li key={session.id} className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--color-text)]">{session.device} · {session.os}</span>
                          {isCurrent && <Badge variant="info">Это устройство</Badge>}
                          <Badge variant={state === 'active' ? 'success' : state === 'expired' ? 'warning' : 'danger'}>
                            {state === 'active' ? 'Активна' : state === 'expired' ? 'Истекла' : 'Отозвана'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {clientLabels[session.client] ?? session.client} · {session.browser} · IP {session.ip || 'не записан'} · активность {relativeTime(session.lastSeenAt)}
                        </p>
                        {session.revokeReason && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{session.revokeReason}</p>}
                      </div>
                      {state === 'active' && !isCurrent && (
                        <Button variant="secondary" size="sm" onClick={() => { setTarget(session); setReason('Выход с устройства'); setActionError(''); }}>
                          Завершить
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Серверных сессий пока нет"
                description="Сессии создаются при входе после подключения телеметрии. Если вы вошли раньше, чем начался сбор, история появится со следующего входа."
              />
            )}
          </div>
        </Card>

        <Card className="border-[var(--color-border)] bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Выход на всех устройствах</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Сервер отзовёт access- и refresh-токены на всех устройствах, затем текущий браузер вернётся на страницу входа.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}><Icon name="lock" size={16} /> Выйти на всех устройствах</Button>
          </div>
        </Card>

        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Выйти на всех устройствах?">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">Все ранее выданные токены аккаунта будут отозваны. Вы и другие устройства должны будете войти заново.</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loggingOut}>Отмена</Button>
            <Button variant="danger" loading={loggingOut} onClick={() => { setLoggingOut(true); void logout().finally(() => setLoggingOut(false)); }}>Выйти везде</Button>
          </div>
        </Dialog>

        <Dialog open={!!target} onClose={() => { setTarget(null); setReason(''); }} title="Завершить эту сессию?">
          {target && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                {target.device} · {target.os} · {target.browser}{target.ip ? ` · IP ${target.ip}` : ''}. Последняя активность: {relativeTime(target.lastSeenAt)}.
              </p>
              <Input label="Комментарий для истории" value={reason} onChange={event => setReason(event.target.value)} maxLength={200} hint="Комментарий сохраняется в серверной записи сессии." />
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setTarget(null); setReason(''); }} disabled={busy}>Отмена</Button>
                <Button variant="danger" loading={busy} onClick={revoke}>Завершить сессию</Button>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </div>
  );
}
