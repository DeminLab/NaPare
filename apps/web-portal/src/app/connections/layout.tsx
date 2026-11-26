import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Подключения аккаунта — НаПаре',
  robots: { index: false, follow: false },
};

export default function ConnectionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
