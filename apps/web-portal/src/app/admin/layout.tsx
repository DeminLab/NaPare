import type { Metadata } from 'next';
import { OrganizationSchema } from '../../components/SEO';

export const metadata: Metadata = {
  title: 'NaPare для администрации вуза',
  description: 'Управление университетом, группами, пользователями и настройками платформы',
  keywords: 'администрация вуза, управление группами, пользователи, настройки, университет, администрирование',
  authors: [{ name: 'Данила Алексеевич — ИП, Разработчик' }],
  creator: 'Данила Алексеевич',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://napare.sano.ru/admin',
    title: 'NaPare для администрации',
    description: 'Управление университетом, группами, пользователями',
    siteName: 'NaPare',
    images: [
      {
        url: '/brand/napare-brand-board.jpg',
        width: 1200,
        height: 630,
        alt: 'NaPare для администрации',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NaPare для администрации',
    description: 'Управление университетом, группами, пользователями',
    images: ['/brand/napare-brand-board.jpg'],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <OrganizationSchema
          name="NaPare"
          description="B2B2C SaaS платформа для администрации вузов"
          url="https://napare.sano.ru/admin"
          logo="https://napare.sano.ru/brand/napare-brand-board.jpg"
          founder={{
            name: 'Данила Алексеевич',
            jobTitle: 'ИП, Разработчик',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
