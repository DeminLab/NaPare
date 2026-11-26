import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Регистрация работодателя — НаПаре',
};

export default function EmployerRegistrationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
