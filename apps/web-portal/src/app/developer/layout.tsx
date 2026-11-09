import type { Metadata } from 'next';
import { OrganizationSchema } from '../../components/SEO';

export const metadata: Metadata = {
  title: 'NaPare для разработчиков — API и документация',
  description: 'Документация API, GitHub репозиторий, техническая документация и разработка платформы',
  keywords: 'NaPare API, документация, разработка, GitHub, NestJS, Next.js, TypeScript',
  authors: [{ name: 'Данила Алексеевич — ИП, Разработчик' }],
  creator: 'Данила Алексеевич',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://napare.sano.ru/developer',
    title: 'NaPare для разработчиков',
    description: 'Документация API, GitHub, разработка',
    siteName: 'NaPare',
    images: [
      {
        url: '/brand/napare-brand-board.jpg',
        width: 1200,
        height: 630,
        alt: 'NaPare для разработчиков',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NaPare для разработчиков',
    description: 'Документация API, GitHub, разработка',
    images: ['/brand/napare-brand-board.jpg'],
  },
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <OrganizationSchema
          name="NaPare"
          description="B2B2C SaaS платформа с открытым кодом"
          url="https://napare.sano.ru/developer"
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
