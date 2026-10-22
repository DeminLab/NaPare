import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Избранное расписание' };

export default function PageLayout({ children }: { children: ReactNode }) {
  return children;
}
