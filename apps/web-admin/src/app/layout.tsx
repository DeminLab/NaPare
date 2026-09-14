import type { Metadata } from 'next';
import './globals.css';
import { NetworkStatus } from '@/components/ui';

export const metadata: Metadata = {
  title: 'НаПаре — Администрирование',
  description: 'Панель администрирования университета',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <NetworkStatus />
      </body>
    </html>
  );
}
