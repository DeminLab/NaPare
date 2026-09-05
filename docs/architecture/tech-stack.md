# Технологический стек

## Сводная таблица

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
| **Auth** | JWT (access + refresh) | — | Stateless, см. [ADR-0004](../03_DECISIONS/0004-jwt-auth.md) |
| **API Docs** | OpenAPI 3 (Swagger) | — | Генерируется из кода = source of truth |
| **Аналитика** | PostHog | — | Продуктовые события |
| **Мониторинг ошибок** | Sentry | — | Ошибки на всех клиентах |
| **CI/CD** | GitHub Actions | — | Lint → Test → Build → Deploy |
| **Контейнеризация** | Docker + Docker Compose | — | Локальная разработка + деплой |
| **Оркестрация** | Kubernetes | — | Production (после пилота) |

## Принципы выбора

1. **TypeScript везде** где возможно (web + backend + max-miniapp)
2. **Модульный монолит** на старте — см. [ADR-0001](../03_DECISIONS/0001-modular-monolith.md)
3. **OpenAPI из кода** — генерируется, не рисуется вручную
4. **Мультивузовость** через `university_id` — см. [ADR-0005](../03_DECISIONS/0005-multitenancy-university-id.md)

## Монорепозиторий

```
napare/
├── apps/
│   ├── backend/        # NestJS
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

Альтернатива для команды из 2 человек — отдельные репозитории (см. [architecture/system-overview.md](system-overview.md)).
