import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Доступ в студенческий кабинет' };

export default function PageLayout({ children }: { children: ReactNode }) {
  return children;
}
