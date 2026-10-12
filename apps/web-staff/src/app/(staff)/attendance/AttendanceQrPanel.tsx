'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Card } from '@/components/ui';
import { apiFetch } from '@/lib/api';

interface QrSession { token: string; expiresAt: string; lessonId: string; }

export function AttendanceQrPanel({ lessonId }: { lessonId: string }) {
  const [session, setSession] = useState<QrSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const expiresAt = session ? Date.parse(session.expiresAt) : 0;
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const active = Boolean(session && secondsLeft > 0);
  const checkInUrl = session && origin
    ? `${origin}/student/attendance/check-in#token=${encodeURIComponent(session.token)}`
    : '';

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const createSession = async () => {
    setLoading(true);
    setError('');
    setCopyStatus('');
    try {
      const next = await apiFetch<QrSession>('/absences/attendance/qr-sessions', {
        method: 'POST',
        body: JSON.stringify({ lessonId }),
      });
      setSession(next);
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось создать QR-код.');
    } finally {
      setLoading(false);
    }
  };

  return <Card padding="sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-semibold text-slate-900">QR-отметка</p><p className="mt-1 max-w-2xl text-xs text-slate-500">Покажите код группе во время занятия. Он действует 90 секунд. Студенту нужно войти в свой аккаунт и отсканировать код камерой телефона или в MAX.</p></div>
      <Button size="sm" variant="secondary" loading={loading} onClick={createSession}>{session ? 'Обновить QR' : 'Начать отметку по QR'}</Button>
    </div>
    {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
    {session && <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
      {active && checkInUrl ? <QRCodeSVG value={checkInUrl} size={216} level="M" marginSize={2} title="QR-код для отметки посещаемости" /> : <div className="flex h-[216px] w-[216px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-medium text-slate-500">{active ? 'Подготавливаем QR-код…' : 'QR-код истёк'}</div>}
      <div className="text-center sm:text-left"><p className="text-sm font-semibold text-slate-900">{active ? 'Откройте сканер камеры и наведите его на код' : 'Создайте новый QR-код для продолжения'}</p><p className="mt-2 text-sm tabular-nums text-slate-600">{active ? `Истекает через ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'Старый код больше нельзя использовать.'}</p><p className="mt-2 max-w-sm text-xs text-slate-500">При обновлении предыдущий код сразу отключается. Студенту нужно заранее войти в NaPare в браузере, где будет открыт QR.</p>{active && <Button size="sm" variant="secondary" className="mt-3" onClick={async () => { try { await navigator.clipboard.writeText(checkInUrl); setCopyStatus('Ссылка скопирована. Она действует столько же, сколько QR.'); } catch { setCopyStatus('Не удалось скопировать. Используйте QR-код.'); } }}>Скопировать ссылку</Button>}{copyStatus && <p role="status" className="mt-2 max-w-sm text-xs text-slate-600">{copyStatus}</p>}</div>
    </div>}
  </Card>;
}
