import type { Metadata } from 'next';
import Link from 'next/link';
import ReportView from './ReportView';
import career from '../career.module.css';
import styles from './report.module.css';

export const metadata: Metadata = { title: 'Отчёт карьерного центра — НаПаре', robots: { index: false, follow: false } };
export default function CareerReportsPage() {
  return <main className={career.page}><div className={styles.document}>
    <Link className={styles.backLink} href="/career?workspace=center">← Карьерный центр</Link>
    <header className={styles.pageHeader}>
      <p className={styles.eyebrow}>Карьерный центр · Аналитика</p>
      <h1>Задачи, отклики и принятые работы</h1>
      <p>Сводные показатели вашего вуза за всё время. Скачайте XLSX, чтобы продолжить анализ.</p>
    </header>
    <ReportView />
  </div></main>;
}
