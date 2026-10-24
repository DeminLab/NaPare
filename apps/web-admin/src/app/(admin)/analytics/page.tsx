import type { Metadata } from 'next';
import AnalyticsDashboard from './AnalyticsDashboard';

export const metadata:Metadata={title:'Аналитика вуза — НаПаре',robots:{index:false,follow:false}};
export default function AnalyticsPage(){return <AnalyticsDashboard/>;}
