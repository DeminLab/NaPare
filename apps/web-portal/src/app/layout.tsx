import type { Metadata } from 'next';
import './portal.css';
import { TelemetryProvider } from '../components/TelemetryProvider';
import { OrganizationSchema } from '../components/SEO';

export const metadata: Metadata = {
  title: 'NaPare — Операционная система учебного дня студента',
  description: 'B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента: расписание, изменения, задания, материалы, обсуждения и учёт отсутствий',
  keywords: 'NaPare, расписание, учеба, студенты, пара, уроки, домашние задания, преподаватели, университет, образование',
  authors: [{ name: 'Демин Данила Алексеевич — ИП, Разработчик' }],
  creator: 'Демин Данила Алексеевич',
  publisher: 'NaPare',
  metadataBase: new URL('https://napare.sano.ru'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://napare.sano.ru',
    title: 'NaPare — Операционная система учебного дня студента',
    description: 'B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента',
    siteName: 'NaPare',
    images: [
      {
        url: '/brand/napare-brand-board.jpg',
        width: 1200,
        height: 630,
        alt: 'NaPare — Операционная система учебного дня студента',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NaPare — Операционная система учебного дня студента',
    description: 'B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента',
    images: ['/brand/napare-brand-board.jpg'],
  },
  icons: {
    icon: '/brand/np-mark.png',
    apple: '/brand/np-mark.png',
    shortcut: '/brand/np-mark.png',
  },
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <OrganizationSchema
          name="NaPare"
          description="B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента"
          url="https://napare.sano.ru"
          logo="https://napare.sano.ru/brand/napare-brand-board.jpg"
          founder={{
            name: 'Демин Данила Алексеевич',
            jobTitle: 'ИП, Разработчик',
          }}
        />
      </head>
      <body>
        <TelemetryProvider>{children}</TelemetryProvider>
      </body>
    </html>
  );
}

