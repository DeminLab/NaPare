import type { Metadata } from 'next';
import Link from 'next/link';
import ReportView from './ReportView';
import career from '../career.module.css';
import styles from './report.module.css';

export const metadata: Metadata = { title: 'Отчёт карьерного центра — НаПаре', robots: { index: false, follow: false } };
export default function CareerReportsPage() {
  return <main className={career.page}><div className={styles.document}>
    <Link href="/career?workspace=center">← Карьерный центр</Link>
    <h1>Задачи, отклики и принятые работы</h1>
    <p>Агрегированный отчёт своего вуза за всё время. Скачайте XLSX для дальнейшего анализа.</p>
    <ReportView />
  </div></main>;
}
