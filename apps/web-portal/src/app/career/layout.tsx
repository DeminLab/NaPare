import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Практика и работа — НаПаре',
};

export default function CareerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
