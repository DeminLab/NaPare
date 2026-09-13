import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'НаПаре — Консоль разработчика',
  description: 'Служебная панель разработчика: состояние API, документация и данные текущей сессии',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-[var(--color-background)] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
