# НаПаре

**Операционная система учебного дня студента**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Node.js 20](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Flutter](https://img.shields.io/badge/Flutter-3.x-blue.svg)](https://flutter.dev/)

---

## Содержание

- [Что такое НаПаре](#что-такое-напаре)
- [Проблема и решение](#проблема-и-решение)
- [Ключевые механики](#ключевые-механики)
- [Архитектура системы](#архитектура-системы)
- [Структура репозитория](#структура-репозитория)
- [Технологический стек](#технологический-стек)
- [Быстрый старт](#быстрый-старт)
- [Локальная разработка](#локальная-разработка)
- [Переменные окружения](#переменные-окружения)
- [База данных](#база-данных)
- [API](#api)
- [Роли и права доступа](#роли-и-права-доступа)
- [Тестирование](#тестирование)
- [Docker и деплой](#docker-и-деплой)
- [CI/CD](#cicd)
- [Безопасность](#безопасность)
- [Модули системы](#модули-системы)
- [Документация](#документация)
- [Вклад в проект](#вклад-в-проект)
- [Команда и пилот](#команда-и-пилот)
- [Лицензия](#лицензия)

---

## Что такое НаПаре

**НаПаре** — это B2B2C SaaS платформа, которая объединяет все аспекты учебного дня студента в одном месте: расписание, изменения, задания, материалы, обсуждения и учёт отсутствий — всё вокруг конкретной пары.

### Клиентские поверхности

| Приложение | Платформа | Аудитория | Приоритет |
|------------|-----------|-----------|-----------|
| **Mobile App** | iOS + Android (Flutter) | Студенты, преподаватели | Критический |
| **Web App** | Браузер (Next.js) | Кураторы, админы, преподаватели | Критический |
| **MAX Mini-App** | Мессенджер MAX (React) | Студенты (быстрый доступ) | Высокий |

---

## Проблема и решение

### Проблема

Учебный процесс студента разбросан по десяткам мест:
- Расписание на сайте вуза
- Изменения в Telegram
- Домашние задания в чатах
- Файлы в облаках
- Отсутствия — устно куратору

**Итог:** студент тратит время на поиск информации об учёбе, а не на учёбу.

### Решение

```
Расписание → Конкретная пара → Контекст пары
                               (преподаватель, группа, файлы,
                                задания, объявления, обсуждение,
                                история изменений, посещаемость)
```

---

## Ключевые механики

| Механика | Описание |
|----------|----------|
| **Пространство пары** | У каждого занятия своя страница со всем контентом |
| **Мой день** | Персональная сводка учебного дня (без AI) |
| **Центр статуса** | Статусы отсутствий с расчётом пар и подтверждением куратора |
| **Мультивузовость** | Архитектура для подключения любых вузов |
| **Коннекторы** | Универсальный интерфейс получения расписания из внешних источников |

---

## Архитектура системы

### Общая схема

```
web-student ─┐
web-staff ───┼──> NestJS API (/api/v1) ──> PostgreSQL
web-admin ───┤              │
web-developer┘              ├────────────> Redis
                             └────────────> S3-compatible file storage
```

### Архитектурные принципы

1. **Модульный монолит** — единый NestJS-процесс с чёткими границами модулей
2. **Мультивузовость** — изоляция данных через `university_id` + Row Level Security
3. **OpenAPI как source of truth** — спецификация генерируется из кода
4. **TypeScript везде** — web + backend + max-miniapp
5. **AI-first** — документы ≤ 500 строк, чёткие заголовки, таблицы

### Архитектурные решения (ADR)

| ADR | Решение | Статус |
|-----|---------|--------|
| ADR-0001 | Модульный монолит | Принято |
| ADR-0002 | Мультивузовость через university_id | Принято |
| ADR-0003 | JWT-авторизация | Принято |
| ADR-0004 | OpenAPI как source of truth | Принято |
| ADR-0005 | Стек технологий | Принято |
| ADR-0006 | Монорепозиторий | Принято |
| ADR-0007 | Стратегия деплоя | Принято |

---

## Структура репозитория

```
napare/
├── apps/
│   ├── backend/          # NestJS API и TypeORM миграции
│   ├── max-miniapp/      # React/Vite Mini App для MAX
│   ├── web-student/      # Next.js для студентов
│   ├── web-staff/        # Next.js для персонала и кураторов
│   ├── web-admin/        # Next.js для администрации вуза
│   └── web-developer/    # Next.js консоль разработчика
├── packages/
│   ├── api-client/       # TypeScript API-клиент
│   └── shared/           # Общие типы, константы и валидаторы
├── infrastructure/       # Docker и nginx конфигурация
├── docs/                 # Документация продукта, архитектуры, безопасности
├── scripts/              # Утилиты
├── .github/              # GitHub Actions
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Приложения

| Пакет | Назначение | URL разработки |
|-------|------------|----------------|
| `@napare/backend` | REST API, Swagger и миграции | `http://localhost:3000` |
| `@napare/web-student` | Рабочее пространство студентов | `http://localhost:3001` |
| `@napare/web-staff` | Рабочее пространство персонала | `http://localhost:3002` |
| `@napare/web-admin` | Администрирование вуза | `http://localhost:3003` |
| `@napare/web-developer` | Консоль разработчика | `http://localhost:3004` |
| `@napare/api-client` | Общий TypeScript API-клиент | — |
| `@napare/shared` | Общие доменные типы и константы | — |

---

## Технологический стек

| Слой | Технология | Версия | Обоснование |
|------|------------|--------|-------------|
| **Mobile** | Flutter | 3.x | Один кодобаза iOS + Android, нативная производительность |
| **Mobile State** | Riverpod | 2.x | Простой, тестируемый стейт-менеджмент |
| **Mobile Router** | go_router | latest | Декларативная навигация, deep links |
| **Mobile HTTP** | dio | latest | Interceptors, retry, cancel |
| **Web** | Next.js | 14+ (App Router) | SSR, отличный DX, адаптивность |
| **Web State** | TanStack Query | 5.x | Кэширование, оптимистичные обновления |
| **Web Styling** | Tailwind CSS | 3.x | Утилитарный CSS, быстрая разработка |
| **MAX Mini-App** | React + Vite | latest | Стандарт для мини-приложений MAX |
| **Backend** | NestJS | 10+ | Модульный монолит, OpenAPI из коробки |
| **ORM** | TypeORM | 0.3+ | Миграции, декораторы, интеграция с NestJS |
| **БД** | PostgreSQL | 16 | Надёжность, JSONB, полнотекстовый поиск, RLS |
| **Кэш / очереди** | Redis | 7 | Сессии, очереди уведомлений, rate limiting |
| **Файлы** | S3-совместимое | — | Yandex Object Storage / MinIO для файлов ДЗ |
| **Push (Android)** | Firebase Cloud Messaging | — | Стандарт |
| **Push (iOS)** | Apple Push Notification | — | Стандарт |
| **Auth** | JWT (access + refresh) | — | Stateless авторизация |
| **API Docs** | OpenAPI 3 (Swagger) | — | Генерируется из кода = source of truth |
| **Аналитика** | PostHog | — | Продуктовые события |
| **Мониторинг ошибок** | Sentry | — | Ошибки на всех клиентах |
| **CI/CD** | GitHub Actions | — | Lint → Test → Build → Deploy |
| **Контейнеризация** | Docker + Docker Compose | — | Локальная разработка + деплой |
| **Оркестрация** | Kubernetes | — | Production (после пилота) |

---

## Быстрый старт

### Требования

- **Node.js** 20+
- **pnpm** 9+
- **Docker Desktop** с Docker Compose v2
- **Flutter** 3.22+ (для мобильного приложения)

### Установка

```powershell
# 1. Клонировать репозиторий
git clone https://github.com/napare/napare.git
cd napare

# 2. Установить зависимости
pnpm install

# 3. Скопировать переменные окружения
Copy-Item apps/backend/.env.example apps/backend/.env

# 4. Поднять инфраструктуру (PostgreSQL, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 5. Запустить все приложения
pnpm dev
```

### Запуск отдельных приложений

```powershell
# Backend
pnpm --filter @napare/backend dev

# Web-приложения
pnpm dev:student
pnpm dev:staff
pnpm dev:admin
pnpm dev:developer
```

### URLs при запуске

| Сервис | URL |
|--------|-----|
| Backend API | `http://localhost:3000` |
| Swagger Docs | `http://localhost:3000/api/v1/docs` |
| Web Student | `http://localhost:3001` |
| Web Staff | `http://localhost:3002` |
| Web Admin | `http://localhost:3003` |
| Web Developer | `http://localhost:3004` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO Console | `http://localhost:9001` |

---

## Локальная разработка

### Инфраструктура

Development Compose файл (`docker-compose.dev.yml`) включает:

| Сервис | Порт | Описание |
|--------|------|----------|
| PostgreSQL 16 | 5432 | Основная база данных |
| Redis 7 | 6379 | Кэш и очереди |
| MinIO | 9000/9001 | S3-совместимое хранилище файлов |

### Запуск инфраструктуры

```powershell
# Запустить все сервисы
docker compose -f docker-compose.dev.yml up -d

# Проверить статус
docker compose -f docker-compose.dev.yml ps

# Остановить
docker compose -f docker-compose.dev.yml down

# Остановить и удалить данные
docker compose -f docker-compose.dev.yml down -v
```

---

## Переменные окружения

### Backend (.env)

Скопируйте `apps/backend/.env.example` в `apps/backend/.env`:

```env
# ===========================================
# Окружение
# ===========================================
NODE_ENV=development
PORT=3000

# ===========================================
# База данных
# ===========================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=napare
DB_PASSWORD=napare
DB_NAME=napare

# ===========================================
# JWT
# ===========================================
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=60d

# ===========================================
# Redis
# ===========================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ===========================================
# S3 / MinIO
# ===========================================
S3_ENDPOINT=localhost:9000
S3_BUCKET=napare
S3_ACCESS_KEY=napare_minio
S3_SECRET_KEY=napare_minio_secret
S3_REGION=us-east-1

# ===========================================
# Push-уведомления
# ===========================================
# Firebase (Android)
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=

# Apple (iOS)
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=ru.napare.mobile
APNS_USE_SANDBOX=true

# ===========================================
# Мониторинг
# ===========================================
SENTRY_DSN=
POSTHOG_API_KEY=
POSTHOG_HOST=https://app.posthog.com

# ===========================================
# Frontend
# ===========================================
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=НаПаре
```

### Описание переменных

| Переменная | Обязательность | Описание |
|------------|----------------|----------|
| `NODE_ENV` | Да | `development`, `test` или `production` |
| `PORT` | Нет | Порт API; по умолчанию `3000` |
| `DATABASE_URL` | Да | Полный URL подключения PostgreSQL |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | При отсутствии `DATABASE_URL` | Поля подключения PostgreSQL |
| `JWT_SECRET` | Да | Секрет для подписи access-токенов |
| `JWT_REFRESH_SECRET` | Да | Секрет для подписи refresh-токенов |
| `JWT_ACCESS_EXPIRATION` | Да | Время жизни access-токена (например, `15m`) |
| `JWT_REFRESH_EXPIRATION` | Да | Время жизни refresh-токена (например, `30d`) |
| `REDIS_HOST`, `REDIS_PORT` или `REDIS_URL` | Зависит от среды | Подключение к Redis |
| `CORS_ORIGIN` | Production | Разрешённый web-оригин |
| `SENTRY_DSN` | Нет | DSN Sentry |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_USE_SSL` | Для хранилища файлов | Конфигурация S3-хранилища |

> **Важно:** Никогда не коммитьте заполненные файлы `.env` в репозиторий.

---

## База данных

PostgreSQL является системой записи. TypeORM сущности и миграции находятся в `apps/backend/src`.

### Миграции

```powershell
# Применить миграции
pnpm --filter @napare/backend typeorm:migration:run

# Откатить последнюю миграцию
pnpm --filter @napare/backend typeorm:migration:revert
```

### Модель данных

```
University → Faculty → Group → User
                            ↓
Lesson → PairSpace → Announcement / Homework / File / Discussion
  ↓
LessonChange

AbsenceStatus → AbsenceConfirmation
Notification / DeviceToken / AuditLog
```

### Ключевые сущности

| Сущность | Описание | Ключевые поля |
|----------|----------|---------------|
| **User** | Пользователь системы | id, phone, email, roles[], university_id, group_id |
| **University** | Учебное заведение | id, name, city, connector_config, status |
| **Faculty** | Факультет | id, university_id, name, code |
| **Group** | Учебная группа | id, faculty_id, name, curriculum_year |
| **Lesson** | Пара (ключевая сущность) | id, university_id, group_id, teacher_id, subject, room, day_of_week, start_time, end_time, week_type |
| **PairSpace** | Пространство пары | id, lesson_id, active_until |
| **Announcement** | Объявление преподавателя | id, pair_space_id, author_id, text, is_pinned |
| **Homework** | Домашнее задание | id, pair_space_id, title, description, deadline |
| **AbsenceStatus** | Статус отсутствия | id, user_id, type, start_date, end_date, comment |
| **Notification** | Уведомление | id, user_id, type, title, body, deep_link, is_read |

---

## API

Базовый путь API: `/api/v1`

### Доступ к документации

| Среда | URL |
|-------|-----|
| Local | `http://localhost:3000/api/v1/docs` |
| Staging | `https://staging.napare.ru/api/v1/docs` |
| Production | `https://api.napare.ru/api/v1/docs` |

### Ключевые группы endpoints

| Группа | Префикс | Модуль |
|--------|---------|--------|
| Auth & Users | `/api/v1/auth`, `/api/v1/users` | Авторизация и пользователи |
| Schedule | `/api/v1/schedule` | Расписание |
| Pair Space | `/api/v1/pair-spaces` | Пространство пары |
| Absences | `/api/v1/absences`, `/api/v1/curator` | Отсутствия |
| Notifications | `/api/v1/notifications`, `/api/v1/devices` | Уведомления |
| Admin | `/api/v1/admin`, `/api/v1/superadmin` | Администрирование |

### Формат ошибок

Единый формат для всех ошибок:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Неверные входные данные",
    "details": [
      { "field": "email", "message": "Неверный формат email" }
    ]
  }
}
```

| Код | HTTP Status | Описание |
|-----|-------------|----------|
| `VALIDATION_ERROR` | 400 | Неверные входные данные |
| `INVALID_CODE` | 400 | Неверный SMS/email код |
| `UNAUTHORIZED` | 401 | Не авторизован |
| `FORBIDDEN` | 403 | Нет доступа |
| `NOT_FOUND` | 404 | Не найдено |
| `RATE_LIMIT_EXCEEDED` | 429 | Слишком много запросов |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка |

### Пагинация

```
GET /api/v1/schedule/my?page=1&limit=20&sort=startTime&order=asc
```

Ответ:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Роли и права доступа

### Роли

| Роль | Код | Описание |
|------|-----|----------|
| Студент | `student` | Основной пользователь |
| Преподаватель | `teacher` | Публикует контент в пространства пар |
| Куратор | `curator` | Видит и подтверждает отсутствия группы |
| Декан факультета | `faculty_dean` | Управление факультетом, аналитика |
| Зав. кафедрой | `department_head` | Управление кафедрой, расписание |
| Админ вуза | `university_admin` | Управление вузом, роли, расписание |
| Суперадмин | `superadmin` | Управление платформой |
| Разработчик | `developer` | Доступ к staging, не production |

> Один пользователь может иметь **несколько ролей** (например, `teacher` + `curator`).

### Матрица прав (ключевые действия)

| Действие | Студент | Преподаватель | Куратор | Админ |
|----------|---------|---------------|---------|-------|
| Смотреть своё расписание | ✅ | ✅ | ❌ | ❌ |
| Смотреть расписание группы | ✅ | ✅ (свои пары) | ✅ (своя группа) | ✅ |
| Публиковать ДЗ | ❌ | ✅ (свои пары) | ❌ | ✅ |
| Публиковать объявления | ❌ | ✅ (свои пары) | ❌ | ✅ |
| Загружать файлы | ❌ | ✅ (свои пары) | ❌ | ✅ |
| Управлять расписанием | ❌ | ❌ | ❌ | ✅ |
| Подтверждать отсутствия | ❌ | ❌ | ✅ (своя группа) | ✅ |
| Назначать роли | ❌ | ❌ | ❌ | ✅ |

### Разграничение данных по ролям

| Роль | Видит данные |
|------|-------------|
| **Студент** | Только свою группу, свои ДЗ, свои отсутствия |
| **Преподаватель** | Свои пары, свои студенты, свои ДЗ |
| **Куратор** | Только свою группу, все отсутствия группы |
| **Админ вуза** | Всё в своём вузе, все роли |
| **Суперадмин** | Всё на платформе |

---

## Тестирование

### Команды

```powershell
# Линтинг
pnpm lint

# Проверка типов
pnpm typecheck

# Unit-тесты
pnpm test:unit

# E2E тесты
pnpm test:e2e

# Тесты с покрытием
pnpm test:coverage

# Production сборка
pnpm build

# Аудит безопасности зависимостей
pnpm security:audit
```

### Требования

- E2E тесты требуют PostgreSQL и Redis
- GitHub Actions предоставляет изолированные контейнеры сервисов
- Локально используйте выделенную тестовую базу данных

---

## Docker и деплой

### Development (локально)

```powershell
docker compose -f docker-compose.dev.yml up -d
```

Сервисы: PostgreSQL (`5432`), Redis (`6379`), MinIO (`9000`/`9001`).

### Production

`docker-compose.prod.yml` включает: nginx, backend, четыре web-приложения, PostgreSQL и Redis.

```powershell
# Валидация конфигурации
docker compose --env-file <secure-env-file> -f docker-compose.prod.yml config

# Запуск
docker compose --env-file <secure-env-file> -f docker-compose.prod.yml up -d
```

> PostgreSQL и Redis доступны только внутри production-сети.

---

## CI/CD

### Workflow CI

Запускается для каждого PR в `main` и каждого push в `main`:

1. **Lint** — проверка стиля кода
2. **Typecheck** — проверка типов TypeScript
3. **Unit tests** — тесты с покрытием
4. **Backend E2E** — E2E тесты с изолированными PostgreSQL и Redis
5. **Production build** — production сборка всех приложений
6. **Dependency audit** — аудит безопасности зависимостей

### Staging деплой

После успешного push в `main`:
1. Сборка иммутабельных GHCR-имиджей с тегом commit SHA
2. Деплой через защищённый GitHub Environment `staging`
3. Проверка `/api/v1/health`

### Production деплой

**Нет автоматического production деплоя.** Production продвижение — отдельный ручной workflow, защищённый GitHub Environment с ревьюерами.

### Защита веток

Рекомендации для `main`:
1. Требовать PR перед слиянием и минимум одно одобрение
2. Требовать прохождения всех проверок CI
3. Требовать актуальность ветки перед слиянием
4. Ограничить force push и удаление веток
5. Ограничить прямой доступ к `main`

---

## Безопасность

### Аутентификация

- SMS/email коды с rate limiting (3 попытки/час)
- JWT с коротким сроком жизни (access: 15–30 мин, refresh: 30–60 дней)
- Refresh token rotation
- Уведомления о входе с нового устройства

### Авторизация

- Role-based access control (RBAC) — 8 ролей
- University_id изоляция — каждый запрос фильтруется по вузу
- Row Level Security (RLS) в PostgreSQL
- Guards в NestJS

### Шифрование

- HTTPS everywhere (TLS 1.3)
- Шифрование паролей (argon2)
- Шифрование причин отсутствий (AES-256)
- Шифрование бэкапов

### Соответствие 152-ФЗ

- Политика обработки ПДн опубликована
- Согласие на обработку ПДн при регистрации
- Данные хранятся на территории РФ
- Пользователь может запросить удаление данных

### Мониторинг

- Sentry для ошибок на всех клиентах
- Аудит критичных действий
- Логирование подозрительной активности

---

## Модули системы

| Модуль | Ответственность | Документ |
|--------|----------------|----------|
| **Auth** | Регистрация, вход, JWT, роли | [docs/modules/auth.md](docs/modules/auth.md) |
| **Schedule** | Расписание, коннекторы, детект изменений | [docs/modules/schedule.md](docs/modules/schedule.md) |
| **PairSpace** | Объявления, ДЗ, файлы, обсуждение | [docs/modules/pair-space.md](docs/modules/pair-space.md) |
| **Absences** | Статусы отсутствий, подтверждения куратора | [docs/modules/absences.md](docs/modules/absences.md) |
| **MyDay** | Агрегация данных для главного экрана | [docs/modules/my-day.md](docs/modules/my-day.md) |
| **Notifications** | Push + in-app уведомления | [docs/modules/notifications.md](docs/modules/notifications.md) |
| **Admin** | Управление вузом, ролями, расписанием | [docs/modules/admin.md](docs/modules/admin.md) |

### Коннекторы расписания

| Коннектор | Тип | Статус |
|-----------|-----|--------|
| Excel/CSV импорт | Ручной | MVP |
| Парсер СИБИТ | HTML + cron | MVP |
| iCal | Формат | После MVP |
| Moodle | LMS | Позже |
| РУЭ | Гос. система | Позже |

---

## Документация

### Точки входа

| Роль | Куда идти |
|------|-----------|
| Новый разработчик | [docs/01_ONBOARDING.md](docs/01_ONBOARDING.md) |
| Команда разработки | [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) |
| AI-агент | [docs/01_ONBOARDING.md](docs/01_ONBOARDING.md) → нужный `docs/modules/*.md` |
| Продукт / CEO | [docs/strategy/vision.md](docs/strategy/vision.md), [docs/product/overview.md](docs/product/overview.md) |
| Новый участник | [docs/02_GLOSSARY.md](docs/02_GLOSSARY.md), [docs/architecture/README.md](docs/architecture/README.md) |

### Структура документации

```
docs/
├── 00_START_HERE.md              # Начало работы
├── 01_ONBOARDING.md              # Путь нового разработчика / AI (≤ 30 мин)
├── 02_GLOSSARY.md                # Единая терминология
├── decisions/                    # Архитектурные решения (ADR)
├── strategy/                     # Видение, монетизация, роадмап, питч
├── product/                      # Обзор продукта, персоны, метрики
├── architecture/                 # Система, стек, модель данных, права
├── modules/                      # Детали модулей
├── clients/                      # Mobile, Web, MAX Mini-App
├── api/                          # OpenAPI = source of truth
├── database/                     # Обзор схемы + seed data
├── ui/                           # Дизайн-система, экраны, флоу
├── security/                     # 152-ФЗ, threat model
├── ops/                          # CI/CD, тестирование, мониторинг
├── process/                      # Contributing, DoD, ownership, branching
├── legal/                        # Политика конфиденциальности, соглашение
└── archive/                      # Исторические документы
```

### Ключевые документы

| Документ | Описание |
|----------|----------|
| [docs/architecture/README.md](docs/architecture/README.md) | Архитектура проекта |
| [docs/architecture/data-model.md](docs/architecture/data-model.md) | Модель данных |
| [docs/architecture/tech-stack.md](docs/architecture/tech-stack.md) | Технологический стек |
| [docs/architecture/roles-and-permissions.md](docs/architecture/roles-and-permissions.md) | Роли и права доступа |
| [docs/api/README.md](docs/api/README.md) | API (OpenAPI) |
| [docs/security/threat-model.md](docs/security/threat-model.md) | Модель угроз |
| [docs/ops/cicd.md](docs/ops/cicd.md) | CI/CD |
| [docs/ops/deployment.md](docs/ops/deployment.md) | Деплой |

---

## Вклад в проект

### Быстрый старт

1. Прочитайте [docs/01_ONBOARDING.md](docs/01_ONBOARDING.md)
2. Изучите [docs/02_GLOSSARY.md](docs/02_GLOSSARY.md)
3. Прочитайте нужный модуль из `docs/modules/*.md`
4. Найдите задачу с меткой **Open questions / TODO**

### Процесс PR

1. Создайте branch от `develop`
2. Напишите код и тесты
3. Обновите документацию модуля (`docs/modules/*.md`)
4. Обновите OpenAPI (если изменился API)
5. Отправьте PR в `develop`
6. Получите ≥ 1 review

### PR Checklist

- [ ] Код проходит linting
- [ ] Все тесты зелёные
- [ ] Документация модуля обновлена
- [ ] OpenAPI обновлён (если API изменился)
- [ ] Нет секретов в коде
- [ ] Нет конфликтов с `develop`
- [ ] Не испольузется `synchronize` в production

### Code Style

| Язык | Инструмент |
|------|------------|
| TypeScript | ESLint + Prettier |
| Flutter | dartfmt + pana |

### Commit Messages (Conventional Commits)

| Префикс | Значение | Пример |
|---------|----------|--------|
| `feat:` | Новая функциональность | `feat: add user profile screen` |
| `fix:` | Исправление бага | `fix: resolve schedule conflict detection` |
| `docs:` | Обновление документации | `docs: update API documentation` |
| `refactor:` | Рефакторинг | `refactor: extract auth service` |
| `test:` | Тесты | `test: add unit tests for absences` |
| `chore:` | Поддерживающие изменения | `chore: update dependencies` |

### Branch Naming

| Префикс | Назначение | Пример |
|---------|------------|--------|
| `feature/` | Новая функциональность | `feature/pair-space-tabs` |
| `fix/` | Исправление бага | `fix/sms-code-expiry` |
| `docs/` | Документация | `docs/add-seed-data` |
| `refactor/` | Рефакторинг | `refactor/extract-api-client` |
| `test/` | Тесты | `test/e2e-registration-flow` |

---

## Команда и пилот

### Команда

| Роль | Описание |
|------|----------|
| CEO/Product | Продуктовая стратегия, встреча с вузами |
| CTO | Архитектура, разработка, DevOps |

### Пилот

| Параметр | Значение |
|----------|----------|
| Вуз | СИБИТ (Омск) |
| Группы | 1–2 реальные группы |
| Цель | Доказать привычку ежедневного использования |
| Метрики | WAU ≥ 60%, % преподавателей с контентом, NPS |

### Стратегия роста

1. **Фаза 0 (0–4 мес)** — MVP + пилот на СИБИТ
2. **Фаза 1 (4–8 мес)** — Расширение внутри СИБИТ, первые платящие клиенты
3. **Фаза 2 (8–14 мес)** — Региональный рост, 5–12 вузов
4. **Фаза 3 (14–24 мес)** — Национальный рост, интеграции, GDPR
5. **Фаза 4 (24+ мес)** — Платформа, маркетплейс интеграций

### Модель монетизации

| Тариф | Кому | Ориентир |
|-------|------|----------|
| Pilot | Пилотный вуз | Бесплатно (0–3 мес) |
| Basic | Небольшой вуз | 50–100 тыс. руб./год |
| Pro | Средний/крупный | Цена за студента в год |
| Enterprise | Крупный вуз, сеть | Индивидуальный контракт |

---

## Полезные ссылки

| Ресурс | URL |
|--------|-----|
| OpenAPI (локально) | `http://localhost:3000/api/v1/docs` |
| OpenAPI (staging) | `https://staging.napare.ru/api/v1/docs` |
| GitHub | `https://github.com/napare/napare` |

---

## Лицензия

Проект распространяется под лицензией [Apache License 2.0](LICENSE).

Copyright 2024 NaPare.
