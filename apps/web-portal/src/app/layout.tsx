import type { Metadata } from 'next';
import './portal.css';
import { TelemetryProvider } from '../components/TelemetryProvider';

export const metadata: Metadata = {
  title: 'НаПаре',
  description: 'Единая цифровая среда университета',
  icons: {
    icon: '/brand/np-mark.png',
    apple: '/brand/np-mark.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <TelemetryProvider>{children}</TelemetryProvider>
      </body>
    </html>
  );
}

