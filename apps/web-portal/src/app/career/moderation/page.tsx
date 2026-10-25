import type { Metadata } from 'next';
import Link from 'next/link';
import ModerationWorkspace from './ModerationWorkspace';
import career from '../career.module.css';
import layout from '../reports/report.module.css';

export const metadata: Metadata = { title: 'Модерация задач и жалоб — НаПаре', robots: { index: false, follow: false } };
export default function ModerationPage() {
  return <main className={career.page}><div className={layout.document}>
    <Link href="/career?workspace=center">← Карьерный центр</Link>
    <h1>Модерация задач и жалоб</h1>
    <p>Рассматривайте условия задач и обращения студентов своего вуза. Признаки риска помогают читать условия, а решение принимает сотрудник.</p>
    <ModerationWorkspace />
  </div></main>;
}
