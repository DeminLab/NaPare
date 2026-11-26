import type { Metadata } from 'next';
import Link from 'next/link';
import MyComplaintHistory from './MyComplaintHistory';
import career from '../career.module.css';
import layout from '../reports/report.module.css';

export const metadata: Metadata={title:'Мои обращения по задачам — НаПаре',robots:{index:false,follow:false}};
export default function MyComplaintsPage(){
  return <main className={career.page}><div className={layout.document}>
    <Link className={layout.backLink} href="/career?workspace=student">← Практика и работа</Link>
    <header className={layout.pageHeader}>
      <p className={layout.eyebrow}>Практика и работа · История</p>
      <h1>Мои обращения по задачам</h1>
      <p>Ваши обращения и решения карьерного центра сохраняются здесь, даже если задача больше не показывается в каталоге.</p>
    </header>
    <MyComplaintHistory />
  </div></main>;
}
