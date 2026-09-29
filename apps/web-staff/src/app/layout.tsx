import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { NetworkStatus } from '@/components/ui';
import { MaxBridgeNavigation } from './MaxBridgeNavigation';

export const metadata: Metadata = {
  title: 'НаПаре — Преподаватель',
  description: 'Расписание, группы и управление — всё в одном месте',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased">
        <Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" />
        {children}
        <NetworkStatus />
        <MaxBridgeNavigation />
      </body>
    </html>
  );
}
