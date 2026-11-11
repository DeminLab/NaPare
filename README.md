# НаПаре

**Операционная система учебного дня студента**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Node.js 20](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)

---

## Содержание

- [Что такое НаПаре](#что-такое-напаре)
- [Проблема и решение](#проблема-и-решение)
- [Ключевые механики](#ключевые-механики)
- [Архитектура системы](#архитектура-системы)
- [Структура репозитория](#структура-репозитория)
- [Технологический стек](#технологический-стек)
- [Быстрый старт](#быстрый-старт)
- [Демо и вход через MAX](#демо-и-вход-через-max)
- [Владелец проекта](#владелец-проекта)
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
| **Student web/PWA** | Next.js | Студенты | Текущая web-поверхность |
| **Staff web** | Next.js | Преподаватели и сотрудники | Текущая web-поверхность |
| **University admin web** | Next.js | Администраторы, деканы, заведующие кафедрами | Текущая web-поверхность |
| **Developer web** | Next.js | Платформенные разработчики | Текущая web-поверхность |
| **Portal / MAX entry** | Next.js `web-portal` | Вход и привязка аккаунта | MAX требует настроенного бота и проверки на платформе |

Android-приложение `apps/android-webview` открывает сайт; текущий релиз-кандидат — 1.1.1 (versionCode 3), Android 8.0+. Нижние кнопки «План офлайн» и «О приложении» удалены по запросу пользователя. Отдельного iOS-клиента нет. Сборка не подтверждает работу на устройстве или публикацию в RuStore: см. [мобильные клиенты](docs/clients/mobile.md) и [инструкцию публикации](docs/deployment/rustore-publication.md).

Актуальные изменения: [кураторство существующего аккаунта](docs/product/account-curatorship.md), [управление платформой](docs/product/platform-control.md), [обзор состояния и проверок](docs/project-log/2026-10-16-repository-sync.md). Эти документы описывают код репозитория; установка новых возможностей на production требует отдельного развёртывания.

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
MAX bot (Open) ──> MAX WebView ──> `/` or `/max/` ──> web-portal
                                                        │ MAX Bridge initData
                                                        ▼
                                                   `/api/v1/auth/max`
                                                        │ verified role
                                                        ▼
                                            student / staff / deanery / developer

web-student ─┐
web-staff ───┼──> NestJS API (/api/v1) ──> PostgreSQL
web-admin ───┤
web-developer┘
```

Redis и BullMQ подключены для outbox-доставки уведомлений (RuStore/WebPush/MAX/Telegram), но внешние каналы выключены по умолчанию и включаются флагами окружения. S3-adapter нет; PostgreSQL — прикладное хранилище данных.

### Архитектурные принципы

1. **Модульный монолит** — единый NestJS-процесс с чёткими границами модулей
2. **Мультивузовость** — tenant и resource-scope checks в backend guards и сервисах, плюс обязательный PostgreSQL RLS (`FORCE ROW LEVEL SECURITY`, миграция `1700000000029-TenantRowSecurity`)
3. **OpenAPI как source of truth** — спецификация генерируется из кода
4. **TypeScript в активных приложениях** — web + backend; MAX запускает существующий `web-portal`

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
│   ├── android-webview/  # Android WebView и ручной локальный план; Gradle
│   ├── web-portal/       # Публичный сайт, вход и MAX Bridge
│   ├── web/              # Legacy монолит до разделения на portal и кабинеты
│   ├── max-miniapp/      # Legacy исходники отдельного клиента; MAX открывает web-portal
│   ├── web-student/      # Next.js для студентов
│   ├── web-staff/        # Next.js для персонала и кураторов
│   ├── web-admin/        # Next.js для администрации вуза
│   └── web-developer/    # Next.js консоль разработчика
├── packages/
│   ├── api-client/       # TypeScript API-клиент
│   ├── ui/               # Общие интерфейсы, включая кураторство
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
| `@napare/web-portal` | Публичный сайт и MAX Bridge вход | `http://localhost:3006` |
| `@napare/api-client` | Общий TypeScript API-клиент | — |
| `@napare/shared` | Общие доменные типы и константы | — |

---

## Технологический стек

| Слой | Технология | Версия | Обоснование |
|------|------------|--------|-------------|
| **Web** | Next.js | 15.5.x (App Router) | SSR, адаптивные role workspaces |
| **Web State** | React state + `localStorage` в соответствующих экранах | — | TanStack Query используется только в сохранённом legacy `apps/web` |
| **Web Styling** | Tailwind CSS | 3.x | Утилитарный CSS, быстрая разработка |
| **MAX WebApp** | `web-portal` + MAX Bridge | — | Открывает существующий сайт; сервер проверяет `initData` и связывает учётную запись |
| **Backend** | NestJS | 10+ | Модульный монолит, OpenAPI из коробки |
| **ORM** | TypeORM | 0.3+ | Миграции, декораторы, интеграция с NestJS |
| **БД** | PostgreSQL | 16 | Основное хранилище; TypeORM tenant/resource checks в приложении |
| **Redis** | Redis | 7 | Очередь BullMQ для outbox-доставки уведомлений; каналы выключены по умолчанию |
| **Файлы** | S3/MinIO | — | Переменные-заготовки есть; фактический storage adapter не подключён |
| **Push** | WebPush/RuStore/MAX/Telegram | — | Серверная доставка реализована и выключена по умолчанию; включение требует флагов и проверки на устройстве |
| **Auth** | JWT (access + refresh) | — | Stateless авторизация |
| **API Docs** | OpenAPI 3 (Swagger) | — | Генерируется из кода = source of truth |
| **Аналитика** | PostHog | — | Не подключён |
| **Мониторинг ошибок** | Sentry | — | Backend при заданном `SENTRY_DSN` |
| **CI/CD** | GitHub Actions | — | PR checks; push `main` запускает staging workflow |
| **Контейнеризация** | Docker + Docker Compose | — | Локальная разработка + деплой |
| **Оркестрация** | Docker Compose | — | Текущий production deployment; Kubernetes не настроен |

---

## Быстрый старт

### Требования

- **Node.js** 20+
- **pnpm** 9+
- **Docker Desktop** с Docker Compose v2

### Установка

```powershell
# 1. Клонировать репозиторий
git clone https://github.com/DeminLab/NaPare.git
cd NaPare

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
pnpm dev:portal
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
| Web Portal | `http://localhost:3006` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO Console | `http://localhost:9001` |

---

## Демо и вход через MAX

MAX открывает существующий сайт NaPare и используется как среда входа: посетитель выбирает MAX или университетские email/пароль, при первом MAX-входе связывает аккаунт в настройках подключений, затем работает в кабинете своей роли. Нативное сканирование QR и самостоятельная отметка посещаемости студентом удалены (миграция `1700000000045-RemoveAttendanceQrSessions`). Текущий сценарий посещаемости — ручная отметка преподавателем в `/staff/attendance`: список группы, статусы «Присутствует», «Отсутствует», «Опоздал» и сохранение.

Исторические материалы кейса сохранены с явной пометкой: [руководство демо](docs/hackathon-demo.md), [карта соответствия кейсу](./docs/deliverables/educational-solutions/CASE-COMPLIANCE.md) и [материалы интервью и пилота](./docs/deliverables/educational-solutions/RESEARCH-PILOT.md). Они описывают сценарий до удаления QR и не являются инструкцией по текущей реализации.

Для отдельной демо-БД можно подготовить связанные аккаунты и тестовую пару скриптом `scripts/prepare-max-attendance-demo.sh`; проверьте выбранный Docker Compose проект и БД до запуска. Скрипт выводит случайные пароли — передавайте их команде отдельно от репозитория. Демо-расписание помечено `source=hackathon-demo` и `syncStatus=synthetic`, а созданная при показе посещаемость не является реальной статистикой.

Для воспроизводимого запуска всех локальных компонентов из Docker подготовьте `.env` по `.env.example`, внесите случайные секреты, укажите `MAX_BOT_TOKEN` и URL тестового запуска, затем выполните одну команду:

```powershell
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

Веб-вход и Mini App открываются через `http://localhost:8080/`; Swagger/OpenAPI — через `http://localhost:8080/api/v1/docs` и `/api/v1/docs-json`. Требуются Docker Compose v2 и доступ в интернет для загрузки базовых образов. Состав переменных и локальные порты перечислены в разделах [переменных окружения](#переменные-окружения), [локальной разработки](#локальная-разработка) и [Docker и деплой](#docker-и-деплой).

Для безопасной демо-БД задайте уникальные `COMPOSE_PROJECT_NAME=napare-demo` и `DB_NAME=napare_demo` в окружении запуска и поднимите стек с отдельным Docker volume. Публичный бот MAX, bot token и HTTPS-сайт являются внешними настройками: MAX Bridge/CDN и клиент MAX невозможно воспроизвести внутри Docker. Остановить стек без удаления базы можно командой `docker compose --env-file .env -f docker-compose.prod.yml down`; повторный запуск выполняется той же командой старта выше. Пароли и `MAX_BOT_TOKEN` не включайте в Git или публичную версию материалов.

## Владелец проекта

NaPare развивает **ИП Демин Данила Алексеевич** — разработчик и владелец проекта. Контакты: [support@napare.ru](mailto:support@napare.ru), Telegram [@napare_bot](https://t.me/napare_bot), GitHub [DeminLab](https://github.com/DeminLab). Публичная страница владельца — [napare.sano.ru/owner](https://napare.sano.ru/owner); подробности и SEO-настройки — в [docs/OWNER.md](docs/OWNER.md) и [docs/SEO.md](docs/SEO.md).

## Локальная разработка

### Инфраструктура

Development Compose файл (`docker-compose.dev.yml`) включает:

| Сервис | Порт | Описание |
|--------|------|----------|
| PostgreSQL 16 | 5432 | Основная база данных |
| Redis 7 | 6379 | Development container для очереди уведомлений; доставка выключена по умолчанию |
| MinIO | 9000/9001 | S3-compatible dev service; backend storage adapter не подключён |

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

### Файлы окружения

Для локального backend скопируйте `apps/backend/.env.example` в `apps/backend/.env`. Корневой `.env.example` предназначен для production Compose: скопируйте его в корневой `.env` только на сервере и замените все `replace-with-*` значения. Эти шаблоны различаются по назначению; источник обязательных backend-переменных — `apps/backend/src/config/validate-environment.ts`.

### Описание переменных

| Переменная | Обязательность | Описание |
|------------|----------------|----------|
| `NODE_ENV` | Да | `development`, `test` или `production` |
| `PORT` | Нет | Порт API; по умолчанию `3000` |
| `DATABASE_URL` | Если используется вместо отдельных полей | Полный URL подключения PostgreSQL |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | При отсутствии `DATABASE_URL` | Поля подключения PostgreSQL |
| `DB_MIGRATION_USERNAME`, `DB_MIGRATION_PASSWORD` | Production | Отдельная ограниченная роль для запуска TypeORM-миграций; runtime-подключение использует `DB_USERNAME`/`DB_PASSWORD` |
| `JWT_SECRET` | Да | Секрет для подписи access-токенов |
| `JWT_REFRESH_SECRET` | Да | Секрет для подписи refresh-токенов |
| `JWT_ACCESS_EXPIRATION` | Да | Время жизни access-токена (например, `15m`) |
| `JWT_REFRESH_EXPIRATION` | Да | Время жизни refresh-токена (например, `30d`) |
| `REDIS_HOST`, `REDIS_PORT` | Для очереди уведомлений | Подключение BullMQ; без флагов доставки очередь не отправляет внешние сообщения. Полный список флагов — в [справочнике доставки](docs/integrations/notification-delivery.md) |
| `CORS_ORIGIN` | Production | Разрешённый web-оригин |
| `MAX_BOT_TOKEN` | Для входа в сайт из MAX WebApp | Токен бота MAX; без него `POST /api/v1/auth/max` отвечает 503 |
| `MAX_INIT_DATA_TTL_SECONDS` | Нет | Срок действия `initData` MAX; по умолчанию `900` |
| `SENTRY_DSN` | Нет | DSN Sentry |
| `CONNECTOR_ENCRYPTION_KEY` | Для Moodle connector | Base64 от 32 случайных bytes для шифрования token; фактическое значение задаётся секретно |

> **Важно:** Никогда не коммитьте заполненные файлы `.env` в репозиторий.

---

## База данных

PostgreSQL является системой записи. TypeORM сущности и миграции находятся в `apps/backend/src`.

### Миграции

```powershell
# Применить миграции
pnpm --filter @napare/backend run typeorm:migration:run

# Откатить последнюю миграцию
pnpm --filter @napare/backend run typeorm:migration:revert
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
| Staging | URL staging-хоста (задаётся на сервере, в репозитории не хранится) |
| Production | `https://napare.sano.ru/api/v1/docs` |

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

Формат ошибки плоский; точные поля и коды описаны в [API guide](docs/api/README.md) и генерируемом Swagger/OpenAPI контракте (`/api/v1/docs-json`):

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": ["email must be an email"],
  "timestamp": "2026-09-26T10:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

Validation `details` contains class-validator messages and appears only when provided by the exception filter.

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
| Разработчик | `developer` | Технические ресурсы; доступ определяется backend policy |
| Работодатель | `employer` | Карьерный модуль: задачи, отклики, профиль компании |
| Сотрудник карьерного центра | `career_staff` | Проверка компаний и модерация карьерных задач |
| Администратор карьерного центра | `career_admin` | Управление карьерным контуром своего вуза |

Это полный enum `UserRole` из `apps/backend/src/auth/interfaces/user-role.ts` (11 значений). Текущая модель хранит одну роль в `users.role`. Проверяйте действие и resource scope по [реальным backend policies](docs/architecture/roles-and-permissions.md); краткая матрица здесь намеренно не дублируется, чтобы не расходиться с route permissions.

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

- Вход по учетным данным; новые аккаунты создаёт университет, самостоятельная регистрация отключена
- JWT access/refresh; время жизни задаётся backend environment configuration
- Rate limiting применяется глобально и отдельными правилами к auth endpoints
- Refresh token flow и logout реализованы в backend; уведомления о новом устройстве не заявляются

### Авторизация

- Role-based access control (RBAC) — 11 ролей; [матрица разрешений и маршрутов](docs/security/role-matrix.md)
- Tenant и role/resource scope проверяются backend guards и сервисами
- PostgreSQL RLS включён и форсирован для tenant-таблиц (`1700000000029-TenantRowSecurity.ts`); запросы tenant-данных идут через `TenantDatabase` с установленным контекстом вуза

### Шифрование

- TLS задаётся production reverse proxy и сертификатом сервера
- Moodle connector tokens шифруются AES-256-GCM при настроенном ключе
- Шифрование резервных копий зависит от процедуры оператора

### Персональные данные

Юридические документы в `docs/legal/` содержат незаполненные поля оператора и даты и требуют проверки владельцем сервиса до публикации. Репозиторий сам по себе не подтверждает юридическое соответствие, фактическое размещение production-данных или настроенный процесс удаления данных.

### Мониторинг

- Backend отправляет ошибки в Sentry только если задан `SENTRY_DSN`.
- Веб-клиенты не подключают Sentry в текущей конфигурации.
- Фактический аудит ограничен событиями, записываемыми соответствующим кодом.
- [Ops monitoring guide](docs/ops/monitoring.md) отделяет текущие логи/health от целевой observability.

---

## Модули системы

| Модуль | Ответственность | Документ |
|--------|----------------|----------|
| **Auth** | Вход, JWT, роли и связь MAX/Telegram | [docs/modules/auth.md](docs/modules/auth.md) |
| **Schedule** | Расписание, коннекторы, детект изменений | [docs/modules/schedule.md](docs/modules/schedule.md) |
| **PairSpace** | Объявления, ДЗ, файлы, обсуждение | [docs/modules/pair-space.md](docs/modules/pair-space.md) |
| **Absences** | Статусы отсутствий, подтверждения куратора | [docs/modules/absences.md](docs/modules/absences.md) |
| **MyDay** | Агрегация данных для главного экрана | [docs/modules/my-day.md](docs/modules/my-day.md) |
| **Notifications** | In-app события, inbox и preferences; push-доставка реализована и по умолчанию выключена | [docs/modules/notifications.md](docs/modules/notifications.md) |
| **Admin** | Управление вузом, ролями, расписанием | [docs/modules/admin.md](docs/modules/admin.md) |

Кроме перечисленных, в backend работают модули `users`, `favorites`, `academic`, `semester`, `events`, `search`, `telemetry`, `analytics`, `career`/`career-billing`, `curation`, `requests`, `moodle`, `rasp` и слой `platform-*` (администрирование платформы, аналитика, данные, записи, карьера, обсуждения, домашние задания, уведомления, кураторство). Полный список групп API и их префиксов — в [docs/api/README.md](docs/api/README.md); границы модулей — в [docs/architecture/system-overview.md](docs/architecture/system-overview.md).

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
├── clients/                      # Mobile, Web, MAX website integration
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
4. Сверьте открытые вопросы с кодом и владельцем задачи; не считайте исторические TODO подтверждёнными дефектами

### Процесс PR

1. Создайте branch от `main`
2. Напишите код и тесты
3. Обновите документацию модуля (`docs/modules/*.md`)
4. Обновите OpenAPI (если изменился API)
5. Отправьте PR в `main`
6. Получите ≥ 1 review

### PR Checklist

- [ ] Код проходит linting
- [ ] Все тесты зелёные
- [ ] Документация модуля обновлена
- [ ] OpenAPI обновлён (если API изменился)
- [ ] Нет секретов в коде
- [ ] Ветка синхронизирована с `main`
- [ ] Не испольузется `synchronize` в production

### Code Style

| Язык | Инструмент |
|------|------------|
| TypeScript | ESLint + Prettier |

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

## Product planning

Документы о целевых пользователях, пилоте, метриках и росте находятся в [product](docs/product/overview.md) и [strategy](docs/strategy/vision.md). Они описывают план и гипотезы; этот репозиторий не подтверждает действующие договорённости, состав команды, активный пилот или измеренные метрики. Проверьте эти сведения у владельца продукта перед внешним использованием.
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
| OpenAPI (production) | `https://napare.sano.ru/api/v1/docs` |
| OpenAPI (staging) | URL staging-хоста (задаётся на сервере) |
| GitHub | `https://github.com/DeminLab/NaPare` |

---

## SEO документация

Полная документация по SEO для NaPare находится в `docs/SEO.md`:

- [SEO документация](docs/SEO.md) - полное описание системы SEO
- [Информация о владельце](docs/OWNER.md) - контактная информация и юридические данные
- [Регистрация в поисковых системах](docs/SEO_REGISTRATION.md) - инструкции по регистрации в Google, Яндекс и других системах
- [Создание иконок](docs/SEO_ICONS.md) - инструкции по созданию иконок для сайта

### Владелец проекта

**Данила Алексеевич — ИП, Разработчик**

- Email: support@napare.ru
- Telegram: @napare_bot
- GitHub: https://github.com/DeminLab

Вся информация о владельце проекта добавлена в мета-теги на всех страницах и в структурированные данные Schema.org.

### Ключевые страницы

- Главная: https://napare.sano.ru/
- Страница владельца: https://napare.sano.ru/owner
- О проекте: https://napare.sano.ru/about
- Возможности: https://napare.sano.ru/features

---

## Лицензия

Проект распространяется под лицензией [Apache License 2.0](LICENSE).

Copyright 2024 NaPare.
