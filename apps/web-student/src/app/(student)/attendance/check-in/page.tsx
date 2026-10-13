'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

type CheckInState = { status: 'idle' | 'loading' | 'success' | 'error'; message: string; lessonId?: string };
interface CheckInResponse { lessonId: string; status: 'present'; alreadyMarked: boolean; }

declare global {
  interface Window {
    WebApp?: {
      openCodeReader?: (fileSelect?: boolean) => Promise<string | null>;
    };
  }
}

export default function AttendanceCheckInPage() {
  const [state, setState] = useState<CheckInState>({ status: 'idle', message: 'Откройте отметку посещаемости в MAX или в браузере с доступом к камере.' });
  const [qrLink,setQrLink]=useState("");
  const [scannerReady,setScannerReady]=useState(false);
  const submittingRef=useRef(false);
  const [scanning, setScanning] = useState(false);
  const [maxScannerAvailable, setMaxScannerAvailable] = useState(false);
  const [browserScannerAvailable, setBrowserScannerAvailable] = useState(false);
  const [browserCameraOpen, setBrowserCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const scannerCancelledRef = useRef(false);

  const submitToken = useCallback(async (token: string) => {
    if(submittingRef.current) return; submittingRef.current=true;
    setState({ status: 'loading', message: 'Проверяем QR-код…' });
    try {
      const result = await apiFetch<CheckInResponse>('/absences/attendance/qr-check-in', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setState({
        status: 'success',
        lessonId: result.lessonId,
        message: result.alreadyMarked ? 'Ваше присутствие уже отмечено.' : 'Присутствие отмечено.',
      });
    } catch (reason) {
      setState({ status: 'error', message: reason instanceof Error ? reason.message : 'Не удалось отметить присутствие.' });
    } finally {submittingRef.current=false;}
  }, []);

  const handleScannedValue = useCallback((scanned: string) => {
    let qrUrl: URL;
    try {
      qrUrl = new URL(scanned, window.location.origin);
    } catch {
      setState({ status: 'error', message: 'Не удалось прочитать ссылку из QR-кода. Попросите преподавателя обновить код.' });
      return;
    }
    const expectedPath = window.location.pathname.replace(/\/$/, '');
    if (qrUrl.origin !== window.location.origin || qrUrl.pathname.replace(/\/$/, '') !== expectedPath) {
      setState({ status: 'error', message: 'Этот QR-код не относится к отметке посещаемости NaPare.' });
      return;
    }
    const token = new URLSearchParams(qrUrl.hash.slice(1)).get('token');
    if (!token) {
      setState({ status: 'error', message: 'В QR-коде нет токена отметки. Попросите преподавателя обновить код.' });
      return;
    }
    if (!window.localStorage.getItem('accessToken') && !window.localStorage.getItem('refreshToken')) {
      setState({ status: 'error', message: 'Сначала войдите в NaPare, затем отсканируйте QR-код повторно.' });
      return;
    }
    void submitToken(token);
  }, [submitToken]);

  const stopBrowserScanner = useCallback(() => {
    scannerCancelledRef.current = true;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setBrowserCameraOpen(false);
    setScanning(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function') {
        setBrowserScannerAvailable(true);
      }
      for (let attempt = 0; attempt < 150 && active; attempt += 1) {
        if (window.WebApp) {
          setMaxScannerAvailable(Boolean(window.WebApp.openCodeReader));
          break;
        }
        await new Promise(resolve => window.setTimeout(resolve, 100));
      }
      if(active) setScannerReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    scannerCancelledRef.current = true;
    scannerControlsRef.current?.stop();
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) {
      return;
    }
    // The fragment is not sent to the server, but removing the one-time token
    // from the address bar and history reduces accidental copying or reuse.
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    if (!window.localStorage.getItem('accessToken') && !window.localStorage.getItem('refreshToken')) {
      setState({ status: 'error', message: 'Сначала войдите в NaPare в этом браузере, затем отсканируйте QR-код повторно.' });
      return;
    }
    void submitToken(token);
  }, [submitToken]);

  async function scanWithMax() {
    const scan = window.WebApp?.openCodeReader;
    if (!scan) {
      await scanWithBrowserCamera();
      return;
    }
    let browserFallbackStarted = false;
    setScanning(true);
    setState({ status: 'idle', message: 'Откройте QR-код преподавателя камерой MAX.' });
    try {
      const scanned = await scan.call(window.WebApp, false);
      if (!scanned) {
        setState({ status: 'idle', message: 'Сканирование отменено. Можно попробовать ещё раз.' });
        return;
      }
      if (scanned) handleScannedValue(scanned);
      else setState({ status: 'idle', message: 'Сканирование отменено. Можно попробовать ещё раз.' });
    } catch (reason) {
      if (browserScannerAvailable) {
        browserFallbackStarted = true;
        setState({ status: 'idle', message: 'Нативная камера MAX недоступна. Откройте камеру браузера для сканирования QR.' });
        await scanWithBrowserCamera();
      } else {
        setState({ status: 'error', message: reason instanceof Error ? reason.message : 'Не удалось открыть сканер MAX.' });
      }
    } finally {
      if (!browserFallbackStarted) setScanning(false);
    }
  }

  async function scanWithBrowserCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setState({ status: 'error', message: 'Камера для QR недоступна в этом браузере. Откройте NaPare в мобильном MAX или используйте устройство с камерой.' });
      return;
    }

    setScanning(true);
    setBrowserCameraOpen(true);
    scannerCancelledRef.current = false;
    setState({ status: 'idle', message: 'Разрешите доступ к камере и наведите её на QR-код преподавателя.' });
    try {
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      if (!video) throw new Error('Окно камеры не открылось. Попробуйте ещё раз.');
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      let stopScan = () => {};
      const controls = await reader.decodeFromVideoDevice(undefined, video, result => {
        if (!result) return;
        stopScan();
        if (scannerCancelledRef.current) return;
        scannerControlsRef.current = null;
        setBrowserCameraOpen(false);
        setScanning(false);
        handleScannedValue(result.getText());
      });
      stopScan = () => controls.stop();
      if (scannerCancelledRef.current) controls.stop();
      else scannerControlsRef.current = controls;
    } catch (reason) {
      stopBrowserScanner();
      setState({ status: 'error', message: reason instanceof Error && reason.name === 'NotAllowedError' ? 'Доступ к камере запрещён. Разрешите камеру в настройках браузера или откройте ссылку преподавателя.' : reason instanceof Error && reason.name === 'NotFoundError' ? 'Камера не найдена. Откройте ссылку отметки, выданную преподавателем.' : reason instanceof Error ? `Не удалось запустить сканирование: ${reason.message}` : 'Не удалось открыть камеру. Проверьте разрешение в MAX или браузере.' });
    }
  }

  return <div className="mx-auto flex max-w-xl items-start px-4 py-6 sm:py-10">
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${state.status === 'success' ? 'bg-emerald-100 text-emerald-700' : state.status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`} aria-hidden="true">
        {state.status === 'loading' ? '…' : state.status === 'success' ? '✓' : state.status === 'error' ? '!' : '⌖' }
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-950">Отметка посещаемости</h1>
      <p className={`mt-2 text-sm ${state.status === 'error' ? 'text-rose-700' : 'text-slate-600'}`} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>
      {state.status === 'idle' && !browserCameraOpen && <ol className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-600"><li><strong className="text-slate-900">1. Откройте код преподавателя.</strong> Используйте код именно вашей пары.</li><li><strong className="text-slate-900">2. Наведите камеру.</strong> Проверьте доступ к камере или откройте ссылку отметки.</li><li><strong className="text-slate-900">3. Дождитесь подтверждения.</strong> Успешная проверка показывает, что присутствие сохранено.</li></ol>}
      {scannerReady && !maxScannerAvailable && !browserScannerAvailable && state.status === 'idle' && <p className="mt-4 text-sm text-amber-700">Сканер камеры здесь недоступен. Откройте ссылку отметки или используйте MAX на телефоне.</p>}
      {(maxScannerAvailable || browserScannerAvailable) && (state.status === 'idle' || (state.status === 'error' && !state.message.startsWith('Сначала войдите'))) && <button type="button" onClick={() => void scanWithMax()} disabled={scanning} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200">{scanning ? 'Открываем камеру…' : maxScannerAvailable ? 'Сканировать QR камерой MAX' : 'Сканировать QR камерой'}</button>}
      {browserCameraOpen && <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-950"><video ref={videoRef} className="max-h-72 w-full object-cover" autoPlay playsInline muted aria-label="Изображение с камеры для сканирования QR" /><button type="button" onClick={stopBrowserScanner} className="min-h-10 w-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Отменить сканирование</button></div>}
      {state.status === 'error' && <p className="mt-3 text-xs text-slate-500">Проверьте, что вы вошли в NaPare и состоите в группе этого занятия. QR-код действует ограниченное время.</p>}
      {state.status === 'success' && state.lessonId && <Link href={`/pair-space/${state.lessonId}`} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200">Открыть пространство пары</Link>}
      {state.status === 'error' && <a href={state.message.startsWith('Сначала войдите') ? '/login' : '/student/today'} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100">{state.message.startsWith('Сначала войдите') ? 'Войти в NaPare' : 'Вернуться к учебному дню'}</a>}
      {state.status !== 'loading' && state.status !== 'success' && <details className="mt-5 rounded-xl border border-slate-200 p-4 text-left"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-slate-700">Есть ссылка отметки от преподавателя</summary><form onSubmit={event=>{event.preventDefault();const value=qrLink.trim();setQrLink('');if(value) handleScannedValue(value);}} className="mt-3 space-y-3"><label htmlFor="qr-checkin-link" className="block text-sm text-slate-600">Ссылка QR-кода</label><input id="qr-checkin-link" type="text" value={qrLink} onChange={event=>setQrLink(event.target.value)} autoComplete="off" placeholder="Вставьте ссылку преподавателя" className="min-h-11 w-full rounded-xl border px-3 text-sm"/><button type="submit" disabled={!qrLink.trim() || scanning} className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Проверить ссылку</button></form></details>}
    </section>
  </div>;
}
