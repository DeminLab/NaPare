import type { Metadata } from 'next';
import './portal.css';

export const metadata: Metadata = {
  title: 'НаПаре',
  description: 'Единая цифровая среда университета',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
