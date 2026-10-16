import type { Metadata } from 'next';
import './globals.css';
import { NetworkStatus } from '@/components/ui';
import { MaxBridgeNavigation } from './MaxBridgeNavigation';

export const metadata: Metadata = {
  title: 'НаПаре — Консоль разработчика',
  description: 'Служебная панель разработчика: состояние API, документация и данные текущей сессии',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased">
        {children}
        <NetworkStatus />
        <MaxBridgeNavigation />
      </body>
    </html>
  );
}
