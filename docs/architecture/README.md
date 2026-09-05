# Архитектура проекта НаПаре

## Обзор

**НаПаре** — B2B2C SaaS операционная система учебного дня студента. Архитектура построена на принципах модульного монолита, мультивузовости и AI-first подхода.

## Ключевые принципы

1. **Модульный монолит** — единый NestJS-процесс с чёткими границами модулей
2. **Мультивузовость** — изоляция данных через `university_id` + RLS
3. **OpenAPI как source of truth** — спецификация генерируется из кода
4. **TypeScript везде** — web + backend + max-miniapp
5. **AI-first** — документы ≤ 500 строк, чёткие заголовки, таблицы

## Стек технологий

| Слой | Технология |
|------|------------|
| Mobile | Flutter 3.x, Riverpod, go_router, dio |
| Web | Next.js 14+, TanStack Query, Tailwind CSS |
| Backend | NestJS 10+, TypeORM, PostgreSQL 16 |
| Кэш | Redis 7 |
| Файлы | S3-совместимое хранилище |
| Push | FCM (Android) + APNs (iOS) |
| CI/CD | GitHub Actions |
| Мониторинг | Sentry + Grafana + PostHog |

## Модули

| Модуль | Ответственность | Документ |
|--------|----------------|----------|
| Auth | Регистрация, вход, JWT, роли | [modules/auth.md](../modules/auth.md) |
| Schedule | Расписание, коннекторы, детект изменений | [modules/schedule.md](../modules/schedule.md) |
| PairSpace | Объявления, ДЗ, файлы, обсуждение | [modules/pair-space.md](../modules/pair-space.md) |
| Absences | Статусы отсутствий, подтверждения куратора | [modules/absences.md](../modules/absences.md) |
| Notifications | Push + in-app уведомления | [modules/notifications.md](../modules/notifications.md) |
| Admin | Управление вузом, ролями, расписанием | [modules/admin.md](../modules/admin.md) |
| MyDay | Агрегация данных для главного экрана | [modules/my-day.md](../modules/my-day.md) |

## Архитектурные решения (ADR)

| ADR | Решение | Статус |
|-----|---------|--------|
| ADR-0001 | Модульный монолит | Принято |
| ADR-0002 | Мультивузовость через university_id | Принято |
| ADR-0003 | JWT-авторизация | Принято |
| ADR-0004 | OpenAPI как source of truth | Принято |
| ADR-0005 | Стек технологий | Принято |
| ADR-0006 | Монорепозиторий | Принято |
| ADR-0007 | Стратегия деплоя | Принято |

## Архитектура кода

| Компонент | Документ | Описание |
|-----------|----------|----------|
| Backend | [backend-architecture.md](backend-architecture.md) | NestJS: модули, сервисы, контроллеры, паттерны |
| Mobile | [mobile-architecture.md](mobile-architecture.md) | Flutter: провайдеры, репозитории, модели |
| Web | [web-architecture.md](web-architecture.md) | Next.js: компоненты, хуки, страницы |
| MAX Mini-App | [max-miniapp-architecture.md](max-miniapp-architecture.md) | React: MAX интеграция |
| Shared Types | [shared-types-architecture.md](shared-types-architecture.md) | Общие типы и интерфейсы |

## Детальные реализации модулей

| Модуль | Документ | Содержание |
|--------|----------|------------|
| Auth | [modules/auth-module.md](modules/auth-module.md) | Сервис, контроллер, JWT стратегии, DTO, тесты |
| Schedule | [modules/schedule-module.md](modules/schedule-module.md) | Сущности, коннекторы, детект изменений |
| PairSpace | [modules/pair-space-module.md](modules/pair-space-module.md) | Объявления, ДЗ, файлы, обсуждение |

## Инфраструктура

| Компонент | Документ | Содержание |
|-----------|----------|------------|
| Common | [common-components.md](common-components.md) | Guards, Interceptors, Filters, Decorators |
| Docker & CI/CD | [docker-cicd.md](docker-cicd.md) | Docker Compose, Dockerfile, GitHub Actions |

## Структура проекта

```
napare/
├── apps/
│   ├── backend/        # NestJS API
│   ├── mobile/         # Flutter
│   ├── web/            # Next.js
│   └── max-miniapp/    # React + Vite
├── packages/
│   ├── shared/         # Общие типы, константы
│   ├── ui/             # Общие UI-компоненты
│   └── api-client/     # Сгенерированный API-клиент
├── docs/               # Документация
├── infrastructure/     # Docker, K8s
└── scripts/            # Утилиты
```

## Модель данных

Основные сущности:
- **University** → **Faculty** → **Group** → **User**
- **Lesson** → **PairSpace** → **Announcement/Homework/File/Discussion**
- **AbsenceStatus** → **AbsenceConfirmation**
- **Notification** / **DeviceToken** / **AuditLog**

Подробно: [architecture/data-model.md](data-model.md)

## Безопасность

- JWT-авторизация (access + refresh tokens)
- Role-based access control (8 ролей)
- Row Level Security (RLS) в PostgreSQL
- Шифрование чувствительных данных (AES-256)
- Соответствие 152-ФЗ

Подробно: [security/152-fz.md](../security/152-fz.md)

## Деплой

- **Local**: Docker Compose
- **Staging**: Kubernetes (автоматический деплой из develop)
- **Production**: Kubernetes (ручной деплой из main)

Подробно: [ops/deployment.md](../ops/deployment.md)

## Ссылки

- [00_START_HERE.md](../00_START_HERE.md) — начало работы
- [01_ONBOARDING.md](../01_ONBOARDING.md) — онбординг
- [02_GLOSSARY.md](../02_GLOSSARY.md) — глоссарий