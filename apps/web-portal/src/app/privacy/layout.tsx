import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — НаПаре',
};

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
