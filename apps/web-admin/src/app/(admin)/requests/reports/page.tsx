import type { Metadata } from 'next';
import OfficeReports from './OfficeReports';

export const metadata: Metadata = { title: 'Контингент и задолженности — НаПаре', robots: { index: false, follow: false } };
export default function Page() { return <OfficeReports />; }
