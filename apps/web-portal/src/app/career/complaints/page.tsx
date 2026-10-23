import type { Metadata } from 'next';
import Link from 'next/link';
import MyComplaintHistory from './MyComplaintHistory';
import career from '../career.module.css';
import layout from '../reports/report.module.css';

export const metadata: Metadata={title:'Мои обращения по задачам — НаПаре',robots:{index:false,follow:false}};
export default function MyComplaintsPage(){
  return <main className={career.page}><div className={layout.document}>
    <Link href="/career?workspace=student">← Практика и работа</Link>
    <h1>Мои обращения по задачам</h1>
    <p>Здесь сохраняются ваши жалобы и решения карьерного центра, в том числе после скрытия задачи из списка новых предложений.</p>
    <MyComplaintHistory />
  </div></main>;
}
