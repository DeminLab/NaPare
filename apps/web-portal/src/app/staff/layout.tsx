import type { Metadata } from 'next';
import { OrganizationSchema } from '../../components/SEO';

export const metadata: Metadata = {
  title: 'NaPare для преподавателей и персонала',
  description: 'Управление расписанием, отметки посещаемости, объявления и домашние задания для преподавателей',
  keywords: 'расписание преподавателей, отметки, посещаемость, преподаватели, персонал, университет',
  authors: [{ name: 'Данила Алексеевич — ИП, Разработчик' }],
  creator: 'Данила Алексеевич',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://napare.sano.ru/staff',
    title: 'NaPare для преподавателей',
    description: 'Управление расписанием, отметки, ДЗ',
    siteName: 'NaPare',
    images: [
      {
        url: '/brand/napare-brand-board.jpg',
        width: 1200,
        height: 630,
        alt: 'NaPare для преподавателей',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NaPare для преподавателей',
    description: 'Управление расписанием, отметки, ДЗ',
    images: ['/brand/napare-brand-board.jpg'],
  },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <OrganizationSchema
          name="NaPare"
          description="B2B2C SaaS платформа для преподавателей"
          url="https://napare.sano.ru/staff"
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
