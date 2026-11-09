# Быстрый старт SEO для NaPare

## Что уже сделано

✅ Мета-теги на всех страницах
✅ Карта сайта (sitemap.xml) для всех разделов
✅ Robots.txt для всех приложений
✅ Schema.org структурированные данные
✅ Open Graph и Twitter Card метки
✅ Логотипы и иконки
✅ Страница владельца проекта
✅ Информация о разработчике во всех мета-тегах

## Что нужно сделать

### 1. Создать иконки

Следуйте инструкции в [docs/SEO_ICONS.md](SEO_ICONS.md):

```bash
# Создайте иконки с помощью AI-инструмента
# Используйте промпты из docs/SEO_ICONS.md

# Или используйте онлайн-инструменты:
# - favicon.io
# - RealFaviconGenerator
# - Canva
```

### 2. Загрузить иконки на сервер

```bash
# Замените файлы иконок в соответствующих директориях
# public/favicon.ico
# public/apple-touch-icon.png
# public/mstile-150x150.png
# public/manifest.json
```

### 3. Зарегистрироваться в поисковых системах

Следуйте инструкции в [docs/SEO_REGISTRATION.md](SEO_REGISTRATION.md):

#### Google Search Console

1. Перейдите на https://search.google.com/search-console
2. Добавьте сайт: `https://napare.sano.ru`
3. Верифицируйте сайт
4. Добавьте карту сайта: `https://napare.sano.ru/sitemap.xml`
5. Проверьте robots.txt

#### Яндекс.Вебмастер

1. Перейдите на https://webmaster.yandex.ru
2. Добавьте сайт: `https://napare.sano.ru`
3. Верифицируйте сайт
4. Добавьте карту сайта: `https://napare.sano.ru/sitemap.xml`
5. Проверьте robots.txt

### 4. Настроить Яндекс.Метрика

1. Перейдите на https://metrika.yandex.ru
2. Создайте метрику для сайта
3. Добавьте код метрики на все страницы
4. Создайте цели для:
   - Регистрации пользователя
   - Входа в кабинет
   - Просмотра страницы владельца
   - Просмотра страницы о проекте

### 5. Добавить сайт в Яндекс.Справку

1. Перейдите на https://yandex.ru/support/spravka
2. Зарегистрируйте сайт
3. Заполните информацию о проекте и владельце

### 6. Постановка на учет в Роскомнадзор

1. Подготовьте документы (см. SEO_REGISTRATION.md)
2. Зарегистрируйтесь на портале e-gov
3. Заполните заявку на постановку на учет

## Проверка SEO

### Проверка мета-тегов

```bash
# Проверьте мета-теги в браузере
# Откройте https://napare.sano.ru и нажмите F12
# Перейдите в раздел "Elements"
# Проверьте теги <meta> в <head>
```

### Проверка карты сайта

```bash
# Проверьте карту сайта в браузере
# Откройте https://napare.sano.ru/sitemap.xml
```

### Проверка robots.txt

```bash
# Проверьте robots.txt в браузере
# Откройте https://napare.sano.ru/robots.txt
```

### Проверка Schema.org

```bash
# Проверьте Schema.org в браузере
# Откройте https://napare.sano.ru
# Нажмите F12
# Перейдите в раздел "Elements"
# Проверьте теги <script> с type="application/ld+json"
```

## Изменение информации о владельце

### Изменить имя владельца

1. Отредактируйте `apps/web-portal/src/app/layout.tsx`
2. Измените мета-тег `author`:
   ```typescript
   authors: [{ name: 'НОВОЕ ИМЯ' }]
   ```

3. Отредактируйте `apps/web-portal/src/app/owner/page.tsx`
4. Измените текст на странице владельца

5. Обновите Schema.org данные:
   ```typescript
   <OrganizationSchema
     founder={{
       name: 'НОВОЕ ИМЯ',
       jobTitle: 'НОВАЯ ДОЛЖНОСТЬ',
     }}
   />
   ```

6. Перезапустите сервер
7. Проверьте изменения в браузере

## Изменение карты сайта

1. Отредактируйте соответствующий файл sitemap:
   - `public/sitemap.xml` - главная карта
   - `public/sitemap-student.xml` - студенты
   - `public/sitemap-staff.xml` - преподаватели
   - `public/sitemap-admin.xml` - администрация
   - `public/sitemap-developer.xml` - разработчики

2. Добавьте новые URL в нужный файл

3. Обновите robots.txt, добавив новый sitemap

4. Перезапустите сервер

## Изменение robots.txt

1. Отредактируйте соответствующий файл robots.txt:
   - `public/robots.txt` - корневой
   - `apps/web-portal/public/robots.txt` - portal
   - `apps/web-student/public/robots.txt` - student
   - `apps/web-staff/public/robots.txt` - staff
   - `apps/web-admin/public/robots.txt` - admin
   - `apps/web-developer/public/robots.txt` - developer

2. Добавьте или измените правила

3. Перезапустите сервер

## Частые задачи

### Добавить новую страницу

1. Создайте файл страницы (например, `apps/web-portal/src/app/new-page/page.tsx`)
2. Добавьте мета-теги в `layout.tsx` (если есть layout)
3. Добавьте URL в соответствующий sitemap-файл
4. Добавьте URL в robots.txt
5. Обновите мета-теги keywords и description

### Добавить новый раздел

1. Создайте отдельный layout (например, `apps/web-portal/src/app/new-section/layout.tsx`)
2. Добавьте мета-теги для раздела
3. Добавьте URL в соответствующий sitemap-файл
4. Добавьте URL в robots.txt
5. Обновите мета-теги keywords и description

## Контактная информация

- **Email:** support@napare.ru
- **Telegram:** @napare_bot
- **GitHub:** https://github.com/DeminLab/NaPare

## Дополнительная информация

- [Полная SEO документация](docs/SEO.md)
- [Информация о владельце](docs/OWNER.md)
- [Регистрация в поисковых системах](docs/SEO_REGISTRATION.md)
- [Создание иконок](docs/SEO_ICONS.md)

---

**Версия:** 1.0
**Дата:** 2026-11-09
**Автор:** Данила Алексеевич
