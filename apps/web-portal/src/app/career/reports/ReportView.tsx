'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountApiError, accountApi, currentSession, type Session } from '../../privacy/account/api';
import career from '../career.module.css';
import styles from './report.module.css';

type Report = {
  universityId: string; universityName: string; asOf: string; period: 'all_time';
  tasks: number; applications: number; acceptedWorks: number;
  byState: Record<'tasks' | 'applications' | 'works', { state: string; count: number }[]>;
  limitations: string[];
};
const stateLabels: Record<string, string> = {
  draft: 'Черновик', open: 'Открыто', closed: 'Закрыто', pending: 'Ожидает решения',
  accepted: 'Принято', rejected: 'Отклонено', withdrawn: 'Отозвано', in_progress: 'В работе', submitted: 'Сдано на проверку', revision: 'На доработке',
};

export default function ReportView() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const session = useRef<Session | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const load = useCallback(async () => {
    controller.current?.abort(); const next = new AbortController(); controller.current = next;
    session.current = currentSession(); setError(''); setStatus(''); setBusy(true);
    if (!session.current) { setReport(null); setError('Войдите в аккаунт сотрудника карьерного центра своего вуза.'); setBusy(false); return; }
    try {
      const data = await accountApi<Report>('/career/center/report', session.current, next.signal);
      if (data.period !== 'all_time' || !data.universityId || !data.byState ||
        ![data.tasks, data.applications, data.acceptedWorks].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Не удалось проверить отчёт сервера.');
      setReport(data);
    } catch (failure) { if (!next.signal.aborted) {
      if (failure instanceof AccountApiError && [401, 403, 409].includes(failure.status)) setReport(null);
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить отчёт.');
    } }
    finally { if (!next.signal.aborted) setBusy(false); }
  }, []);
  useEffect(() => {
    void load();
    const changed = (event: StorageEvent) => {
      if (!event.key || ['accessToken', 'refreshToken'].includes(event.key)) { setReport(null); pending.current = false; void load(); }
    };
    window.addEventListener('storage', changed);
    return () => { controller.current?.abort(); window.removeEventListener('storage', changed); };
  }, [load]);

  async function download() {
    if (!report || !session.current || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    const next = new AbortController(); controller.current = next;
    try {
      const response = await accountApi<Response>('/career/center/report.xlsx', session.current, next.signal, {}, 'response');
      if (response.headers.get('X-NaPare-University-Id') !== report.universityId ||
        !response.headers.get('Content-Type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) throw new Error('Формат или вуз отчёта изменился. Обновите сведения.');
      const blob = await response.blob(); next.signal.throwIfAborted();
      const stored = currentSession();
      if (stored?.accessToken !== session.current.accessToken || stored?.refreshToken !== session.current.refreshToken) throw new Error('Сессия изменилась. Загрузите отчёт заново.');
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'napare-career-report.xlsx'; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('XLSX подготовлен для скачивания. Проверьте загрузки браузера. Файл содержит новый снимок на момент запроса.');
    } catch (failure) { if (!next.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не удалось скачать XLSX.'); }
    finally { pending.current = false; if (!next.signal.aborted) setBusy(false); }
  }
  return <div aria-busy={busy}>
    <div role="status" aria-live="polite">{busy ? 'Подготавливаем отчёт…' : status}</div>
    {error && <p role="alert" className={career.error}>{error}</p>}
    <div className={styles.actions}>
      <button className={career.button} type="button" disabled={busy} onClick={() => void load()}>Обновить отчёт</button>
      {report && <button className={`${career.button} ${career.primary}`} type="button" disabled={busy} onClick={() => void download()}>Скачать XLSX</button>}
      {!report && !busy && <Link href="/login">Войти заново</Link>}
    </div>
    {report && <>
      <h2>{report.universityName}</h2>
      <p>Снимок: {new Date(report.asOf).toLocaleString('ru-RU')}. Период: за всё время.</p>
      {report.tasks === 0 && <p className={career.empty}>У этого вуза пока нет карьерных задач. Нулевые показатели отражают отсутствие записей.</p>}
      <table className={styles.table}><caption>Показатели карьерного модуля</caption>
        <thead><tr><th scope="col">Показатель</th><th scope="col">Количество</th></tr></thead>
        <tbody><tr><th scope="row">Задачи</th><td>{report.tasks}</td></tr><tr><th scope="row">Отклики</th><td>{report.applications}</td></tr><tr><th scope="row">Принятые работы</th><td>{report.acceptedWorks}</td></tr></tbody>
      </table>
      <h2>Как читать отчёт</h2><ul>{report.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      <h2>Разбивка по статусам</h2>
      {([['tasks', 'Задачи'], ['applications', 'Отклики'], ['works', 'Работы']] as const).map(([key, title]) => <section key={key}>
        <h3>{title}</h3>{report.byState[key].length ? <table className={styles.table}>
          <caption className={styles.srOnly}>{title}: статусы записей</caption>
          <thead><tr><th scope="col">Статус</th><th scope="col">Количество</th></tr></thead><tbody>{report.byState[key].map(row => <tr key={row.state}><th scope="row">{stateLabels[row.state] || row.state}</th><td>{row.count}</td></tr>)}</tbody>
        </table> : <p>Записей нет.</p>}
      </section>)}
    </>}
  </div>;
}
