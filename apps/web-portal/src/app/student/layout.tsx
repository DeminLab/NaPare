import type { Metadata } from 'next';
import { OrganizationSchema } from '../../components/SEO';

export const metadata: Metadata = {
  title: 'NaPare для студентов — Расписание, пары, ДЗ',
  description: 'Ваше пространство учебного дня: расписание, объявления, домашние задания, файлы и обсуждения по каждой паре',
  keywords: 'расписание студентов, пара, уроки, домашние задания, материалы, обсуждения, студенты, университет',
  authors: [{ name: 'Данила Алексеевич — ИП, Разработчик' }],
  creator: 'Данила Алексеевич',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://napare.sano.ru/student',
    title: 'NaPare для студентов',
    description: 'Ваше пространство учебного дня: расписание, пары, ДЗ',
    siteName: 'NaPare',
    images: [
      {
        url: '/brand/napare-brand-board.jpg',
        width: 1200,
        height: 630,
        alt: 'NaPare для студентов',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NaPare для студентов',
    description: 'Ваше пространство учебного дня: расписание, пары, ДЗ',
    images: ['/brand/napare-brand-board.jpg'],
  },
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <OrganizationSchema
          name="NaPare"
          description="B2B2C SaaS платформа для студентов"
          url="https://napare.sano.ru/student"
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
