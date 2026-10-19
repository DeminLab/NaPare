# Технологический стек

## Сводная таблица

Android-клиент уже реализован отдельно от целевого Flutter-стека: Java 17, Android WebView, AndroidX WebKit 1.12.1, compile/target SDK 35, minSdk 26. Содержит ручной локальный план. Сборка Gradle и её ограничения описаны в [Android README](../clients/android-webview.md); публикация и runtime на устройстве требуют отдельных проверок.

> Статус: строки **Mobile** — целевой стек, `apps/mobile` и Flutter/Dart-кода в репозитории нет
> (см. [mobile-architecture.md](mobile-architecture.md) — спецификация, не реализация).
> Redis runtime service есть в Compose, но backend client/queues не подключены; S3, push delivery, PostHog и Kubernetes deployment не настроены.

| Слой | Технология | Версия | Обоснование |
|------|------------|--------|-------------|
| **Mobile** (целевой, не реализован) | Flutter | 3.x | Один кодобаза iOS + Android, нативная производительность |
| **Mobile State** (целевой) | Riverpod | 2.x | Простой, тестируемый стейт-менеджмент |
| **Mobile Router** (целевой) | go_router | latest | Декларативная навигация, deep links |
| **Mobile HTTP** (целевой) | dio | latest | Interceptors, retry, cancel |
| **Web** | Next.js | 15.5.x (App Router) | SSR, отличный DX, адаптивность; все 6 Next-приложений на 15.5.24 |
| **Web State** | React state + localStorage | — | Рабочие пространства работают на `useState`/`useEffect`; TanStack Query, Zustand и axios есть только в legacy `apps/web` |
| **Web Styling** | Tailwind CSS | 3.x | Утилитарный CSS; токены — `packages/design-tokens` (preset + `styles.css`) |
| **MAX WebApp** | Next.js `web-portal` + MAX Bridge | — | MAX открывает существующий сайт; backend проверяет `initData` и возвращает обычную сессию NaPare |
| **Backend** | NestJS | 10+ | Модульный монолит, OpenAPI из коробки |
| **ORM** | TypeORM | 0.3+ | Миграции, декораторы, интеграция с NestJS (Prisma не используется) |
| **БД** | PostgreSQL | 16 | Основная реляционная БД; текущие миграции не включают RLS policies |
| **Кэш / очереди** | Redis | 7 | Контейнер есть в Compose; backend client/queues не подключены. Rate limiting работает через global `ThrottlerGuard` с process-local storage |
| **Файлы** | S3-совместимое | — | Только переменные `STORAGE_*` в `apps/backend/.env.example`; SDK в коде не используется |
| **Push (Android)** | Firebase Cloud Messaging | — | Целевой канал; device token регистрируется (`POST /devices/token`), отправка не реализована |
| **Push (iOS)** | Apple Push Notification | — | Целевой канал, отправка не реализована |
| **Auth** | JWT (access + refresh) | — | Stateless, см. [ADR-0003](../decisions/0003-jwt-auth.md) |
| **API Docs** | OpenAPI 3 (Swagger) | — | Генерируется из кода = source of truth, `/api/v1/docs` |
| **Аналитика** | PostHog | — | Не подключён (ни в backend, ни в клиентах) |
| **Мониторинг ошибок** | Sentry | 7.x | `@sentry/node` в `apps/backend/src/main.ts` при наличии `SENTRY_DSN` |
| **CI/CD** | GitHub Actions | — | PR CI и staging workflow на push `main`; production rollout описан отдельно в [docs/deployment/production.md](../deployment/production.md) |
| **Контейнеризация** | Docker + Docker Compose | — | Локальная разработка + деплой |
| **Оркестрация** | Docker Compose | — | Используется текущими deployment файлами; Kubernetes — не настроенный будущий вариант |

## Принципы выбора

1. **TypeScript** для текущих web и backend приложений
2. **Модульный монолит** на старте — см. [ADR-0001](../decisions/0001-modular-monolith.md)
3. **OpenAPI из кода** — генерируется, не рисуется вручную
4. **Мультивузовость** через `university_id` — см. [ADR-0002](../decisions/0002-multitenancy-university-id.md)

## Монорепозиторий

```
napare/
├── apps/
│   ├── backend/        # NestJS API (порт 3000)
│   ├── web-portal/     # Next.js 15.5 — единый вход (порт 3006)
│   ├── web-student/    # Next.js 15.5 — студент, basePath /student (порт 3001)
│   ├── web-staff/      # Next.js 15.5 — преподаватель, basePath /staff (порт 3002)
│   ├── web-admin/      # Next.js 15.5 — деканат, basePath /deanery (порт 3003)
│   ├── web-developer/  # Next.js 15.5 — диагностика (порт 3004)
│   ├── web/            # Next.js 15.5 — legacy-лендинг, не деплоится
│   └── max-miniapp/    # React + Vite (порт 3005)
├── packages/
│   ├── shared/         # Общие типы и константы (приложениями пока не импортируется)
│   ├── api-client/     # API-клиент (приложениями пока не импортируется)
│   ├── design-tokens/  # Tailwind preset, styles.css, src/index.ts
│   └── ui/             # Общие UI-компоненты (index.tsx, icons.tsx, WorkspaceShell.tsx)
├── docs/               # Документация
├── infrastructure/     # Docker, nginx
├── deploy/             # Примеры nginx-конфигов
├── scripts/            # Утилиты
└── docker-compose{,.dev,.prod}.yml
```

Альтернатива для команды из 2 человек — отдельные репозитории (см. [architecture/system-overview.md](system-overview.md)).
