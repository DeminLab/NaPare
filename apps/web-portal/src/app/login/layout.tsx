import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Вход — НаПаре',
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
