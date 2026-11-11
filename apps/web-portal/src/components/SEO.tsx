'use client';

interface SEOMetaProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: string;
  canonical?: string;
  type?: string;
}

export default function SEOMeta({
  title = 'NaPare — Операционная система учебного дня студента',
  description = 'B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента: расписание, изменения, задания, материалы, обсуждения и учёт отсутствий',
  keywords = 'NaPare, расписание, учеба, студенты, пара, уроки, домашние задания, преподаватели, университет, образование',
  ogTitle,
  ogDescription,
  ogImage = 'https://napare.sano.ru/brand/napare-brand-board.jpg',
  ogUrl,
  twitterCard = 'summary_large_image',
  canonical,
  type = 'website',
}: SEOMetaProps) {
  const siteUrl = 'https://napare.sano.ru';
  const fullTitle = ogTitle || title;
  const fullDescription = ogDescription || description;
  const fullUrl = ogUrl || canonical || `${siteUrl}${canonical || ''}`;
  const fullImage = ogImage || `${siteUrl}/brand/napare-brand-board.jpg`;

  return (
    <>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Демин Данила Алексеевич — ИП, Разработчик" />
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="google-site-verification" content="napare-verification" />

      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={fullUrl} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:site_name" content="NaPare" />
      <meta property="og:locale" content="ru_RU" />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={fullImage} />

      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'NaPare',
            url: siteUrl,
            description: description,
            author: {
              '@type': 'Person',
              name: 'Демин Данила Алексеевич',
              jobTitle: 'ИП, Разработчик',
            },
            publisher: {
              '@type': 'Organization',
              name: 'NaPare',
              url: siteUrl,
              logo: {
                '@type': 'ImageObject',
                url: fullImage,
              },
            },
          }),
        }}
      />

      {/* Additional SEO Tags */}
      <meta name="theme-color" content="#4F46E5" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="format-detection" content="telephone=no" />
    </>
  );
}

interface OrganizationSchemaProps {
  name: string;
  description: string;
  url: string;
  logo: string;
  founder: {
    name: string;
    jobTitle: string;
  };
}

export function OrganizationSchema({ name, description, url, logo, founder }: OrganizationSchemaProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: name,
          description: description,
          url: url,
          logo: logo,
          founder: {
            '@type': 'Person',
            name: founder.name,
            jobTitle: founder.jobTitle,
          },
          sameAs: [
            'https://github.com/DeminLab/NaPare',
            'https://t.me/napare_bot',
          ],
        }),
      }}
    />
  );
}
