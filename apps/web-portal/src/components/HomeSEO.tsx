'use client';

import { OrganizationSchema } from './SEO';

export default function HomeSEO() {
  return (
    <>
      {/* Schema.org JSON-LD for Homepage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'NaPare',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'RUB',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              ratingCount: '125',
            },
            description: 'B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента: расписание, изменения, задания, материалы, обсуждения и учёт отсутствий',
            author: {
              '@type': 'Person',
              name: 'Демин Данила Алексеевич',
              jobTitle: 'ИП, Разработчик',
            },
            creator: {
              '@type': 'Organization',
              name: 'NaPare',
              url: 'https://napare.sano.ru',
            },
            about: {
              '@type': 'Thing',
              name: 'Учебный процесс',
              description: 'Управление учебным процессом студентов, преподавателей и администрации вузов',
            },
          }),
        }}
      />

      {/* Additional Schema.org for Person */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: 'Демин Данила Алексеевич',
            jobTitle: 'ИП, Разработчик',
            url: 'https://napare.sano.ru/owner',
            sameAs: [
              'https://github.com/DeminLab/NaPare',
              'https://t.me/napare_bot',
            ],
            knowsAbout: [
              'Software Development',
              'NestJS',
              'Next.js',
              'TypeScript',
              'PostgreSQL',
              'Web Development',
            ],
          }),
        }}
      />
    </>
  );
}
