# SEO документация NaPare

## Обзор

NaPare имеет полноценную систему SEO для всех страниц приложения, включая:
- Мета-теги на всех страницах
- Карта сайта (sitemap)
- Robots.txt для всех приложений
- Schema.org структурированные данные
- Open Graph и Twitter Card метки
- Логотипы и иконки для всех платформ

## Структура SEO

### 1. Корневая страница (portal)

**Файлы:**
- `apps/web-portal/src/app/page.tsx` - главная страница
- `apps/web-portal/src/app/layout.tsx` - корневой layout с мета-тегами
- `apps/web-portal/src/components/SEO.tsx` - компонент SEO
- `apps/web-portal/src/components/HomeSEO.tsx` - SEO для главной страницы

**SEO метки:**
```typescript
title: 'NaPare — Операционная система учебного дня студента'
description: 'B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента'
keywords: 'NaPare, расписание, учеба, студенты, пара, уроки, домашние задания, преподаватели, университет, образование'
```

### 2. Страница команды

**Файл:**
- `apps/web-portal/src/app/team/page.tsx`

**SEO метки:**
```typescript
title: 'Команда — НаПаре'
description: 'Команда проекта НаПаре и направления её работы.'
```

### 3. Страница возможностей

**Файл:**
- `apps/web-portal/src/app/features/page.tsx`

**SEO метки:**
```typescript
title: 'Возможности — НаПаре'
description: 'Возможности НаПаре: расписание и изменения, пространство пары, материалы, задания, статусы отсутствий и практика у работодателей.'
```

### 4. Приложения

#### Student (Студенты)
**Файлы:**
- `apps/web-portal/src/app/student/layout.tsx`
- `apps/web-portal/public/robots.txt`

**SEO метки:**
```typescript
title: 'NaPare для студентов — Расписание, пары, ДЗ'
description: 'Ваше пространство учебного дня: расписание, объявления, домашние задания, файлы и обсуждения по каждой паре'
```

#### Staff (Преподаватели)
**Файлы:**
- `apps/web-portal/src/app/staff/layout.tsx`
- `apps/web-portal/public/robots.txt`

**SEO метки:**
```typescript
title: 'NaPare для преподавателей и персонала'
description: 'Управление расписанием, отметки посещаемости, объявления и домашние задания для преподавателей'
```

#### Admin (Администрация)
**Файлы:**
- `apps/web-portal/src/app/admin/layout.tsx`
- `apps/web-portal/public/robots.txt`

**SEO метки:**
```typescript
title: 'NaPare для администрации вуза'
description: 'Управление университетом, группами, пользователями и настройками платформы'
```

#### Developer (Разработчики)
**Файлы:**
- `apps/web-portal/src/app/developer/layout.tsx`
- `apps/web-portal/public/robots.txt`

**SEO метки:**
```typescript
title: 'NaPare для разработчиков — API и документация'
description: 'Документация API, GitHub репозиторий, техническая документация и разработка платформы'
```

## Карта сайта (Sitemap)

### Файлы:
- `apps/web-portal/public/sitemap.xml` - главная карта сайта
- `apps/web-portal/public/sitemap-student.xml` - карта для студентов
- `apps/web-portal/public/sitemap-staff.xml` - карта для преподавателей
- `apps/web-portal/public/sitemap-admin.xml` - карта для администрации
- `apps/web-portal/public/sitemap-developer.xml` - карта для разработчиков

Копии также лежат в корневом `public/`; web-контейнеры отдают только `apps/*/public`, поэтому рабочий источник для portal — `apps/web-portal/public/`. Все пять файлов обслуживаются одним portal-контейнером по путям из `robots.txt`.

### Формат:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://napare.sano.ru/student</loc>
    <lastmod>2026-11-09</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

## Robots.txt

### Файлы:
- `public/robots.txt` - корневой файл
- `apps/web-portal/public/robots.txt` - для portal
- `apps/web-student/public/robots.txt` - для student
- `apps/web-staff/public/robots.txt` - для staff
- `apps/web-admin/public/robots.txt` - для admin
- `apps/web-developer/public/robots.txt` - для developer

### Содержимое:
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /static/
Disallow: /next/image

Sitemap: https://napare.sano.ru/sitemap.xml
Sitemap: https://napare.sano.ru/sitemap-student.xml
Sitemap: https://napare.sano.ru/sitemap-staff.xml
Sitemap: https://napare.sano.ru/sitemap-admin.xml
Sitemap: https://napare.sano.ru/sitemap-developer.xml
```

## Структурированные данные (Schema.org)

### Типы данных:
- `WebSite` - для главной страницы
- `Organization` - для организации
- `Person` - для автора проекта; во всех мета-тегах и Schema.org используется юридическое имя «ИП Демин Данила Алексеевич»
- `SoftwareApplication` - для приложения
- `BreadcrumbList` - для навигации

### Пример для автора:
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Демин Данила Алексеевич",
  "jobTitle": "ИП, Разработчик",
  "url": "https://napare.sano.ru/team",
  "sameAs": [
    "https://github.com/DeminLab/NaPare",
    "https://t.me/napare_bot"
  ]
}
```

## Open Graph и Twitter Card

### Метки:
- `og:title` - заголовок страницы
- `og:description` - описание страницы
- `og:image` - изображение для соцсетей
- `og:url` - URL страницы
- `og:type` - тип страницы
- `og:locale` - локаль
- `twitter:card` - тип карточки Twitter
- `twitter:title` - заголовок Twitter
- `twitter:description` - описание Twitter
- `twitter:image` - изображение Twitter

## Логотипы и иконки

### Файлы:
- `apps/web-portal/src/app/favicon.ico/route.ts` - иконка браузера для всего домена (SVG-ответ)
- `apps/web-portal/public/apple-touch-icon.png` - иконка для iOS
- `apps/web-portal/public/mstile-150x150.png` - иконка для Windows
- `apps/web-portal/public/manifest.json` - PWA манифест
- `apps/web-portal/public/brand/np-mark.png` - логотип NaPare
- `apps/web-portal/public/brand/napare-brand-board.jpg` - бренд-борд

### Манифест:
```json
{
  "name": "NaPare — Операционная система учебного дня студента",
  "short_name": "NaPare",
  "description": "B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "icons": [
    {
      "src": "/brand/np-mark.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## Google Search Console

### Проверка:
1. Зарегистрируйте сайт в Google Search Console
2. Добавьте `https://napare.sano.ru/` как сайт
3. Разместите `apps/web-portal/public/owner-verification.txt` в корне (после сборки доступен как `/owner-verification.txt`)
4. Проверьте карту сайта `apps/web-portal/public/sitemap.xml`
5. Проверьте `apps/web-portal/public/robots.txt`

## Яндекс.Вебмастер

### Проверка:
1. Зарегистрируйте сайт в Яндекс.Вебмастер
2. Добавьте `https://napare.sano.ru/` как сайт
3. Разместите `apps/web-portal/public/robots.txt`
4. Проверьте карту сайта `apps/web-portal/public/sitemap.xml`

## Яндекс.Метрика и Яндекс.Цель

### Настройка:
1. Добавьте код Яндекс.Метрики на все страницы
2. Настройте цели для:
   - Регистрации
   - Входа в кабинет
   - Просмотра страницы возможностей
   - Просмотра страницы команды

## Яндекс.Справка

### Настройка:
1. Добавьте сайт в Яндекс.Справку
2. Заполните информацию о проекте:
   - Название: NaPare
   - Описание: Операционная система учебного дня студента
   - Владелец: ИП Демин Данила Алексеевич
   - Разработчик: ИП Демин Данила Алексеевич

## Постановка на учет в Роскомнадзор

### Инструкция:
1. Зарегистрируйте домен `napare.sano.ru`
2. Добавьте сайт в Яндекс.Вебмастер
3. Разместите контактную информацию на сайте
4. Добавьте ссылку на политику конфиденциальности
5. Зарегистрируйте сайт в Роскомнадзор через e-gov

## Мониторинг SEO

### Инструменты:
- Google Search Console
- Яндекс.Вебмастер
- Яндекс.Метрика
- Яндекс.Цель
- Google Analytics
- Google PageSpeed Insights
- Lighthouse

## Частые вопросы

### Q: Как изменить информацию об авторе проекта?
A: Отредактируйте мета-теги в `apps/web-portal/src/app/layout.tsx`, Schema.org в `apps/web-portal/src/components/HomeSEO.tsx` и карточку на странице `/team`.

### Q: Как добавить новые страницы в карту сайта?
A: Добавьте URL в соответствующий файл `sitemap-*.xml`.

### Q: Как изменить логотип?
A: Замените файлы в `public/brand/` и обновите ссылки в мета-тегах.

### Q: Как добавить новые ключевые слова?
A: Добавьте их в мета-теги keywords на соответствующей странице.

## Следующие шаги

1. ✅ Создать SEO для всех страниц
2. ✅ Добавить карту сайта
3. ✅ Добавить robots.txt
4. ✅ Добавить Schema.org данные
5. ✅ Добавить Open Graph и Twitter Card
6. ⏳ Создать robots.txt для всех приложений
7. ⏳ Настроить Google Search Console
8. ⏳ Настроить Яндекс.Вебмастер
9. ⏳ Настроить Яндекс.Метрика и Яндекс.Цель
10. ⏳ Настроить Яндекс.Справка
11. ⏳ Постановка на учет в Роскомнадзор

## Контакты

- Email: support@napare.ru
- Telegram: @napare_bot
- GitHub: https://github.com/DeminLab/NaPare
