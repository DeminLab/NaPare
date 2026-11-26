import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Портфолио студента — НаПаре',
};

export default function PublicPortfolioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
