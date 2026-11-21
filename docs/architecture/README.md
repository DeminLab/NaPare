# Архитектура NaPare

Этот раздел описывает текущий монорепозиторий и отделяет реализованные компоненты от проектных заметок.

## Текущая система

| Область | Реализация | Источник |
|---|---|---|
| Backend API | NestJS modular monolith, PostgreSQL, TypeORM | [Backend architecture](backend-architecture.md), `apps/backend/src/app.module.ts` |
| Web | Next.js 15.5 portal и четыре role workspaces | [Project map](../ai/project-map.md) |
| MAX | Существующий `web-portal` + MAX Bridge; аккаунт связывается после серверной проверки `initData` | [MAX guide](../clients/max-miniapp.md) |
| Tenant access | University context, role guards и resource checks в backend | [Roles and permissions](roles-and-permissions.md) |
| Database | Entities и миграции TypeORM | [Schema overview](../database/schema-overview.md) |
| Кураторство | Назначения на группы независимо от основной роли | [Описание](../product/account-curatorship.md) |
| Управление платформой | Владелец, делегирование и host-агент | [Описание](../product/platform-control.md), [установка](../deployment/platform-control.md) |
| Android | WebView и ручной локальный план | [Мобильный клиент](../clients/mobile.md) |
| Deployment | Docker Compose, shared-origin Nginx, GitHub Actions staging | [Deployment guide](../deployment/production.md), [CI/CD](../ops/cicd.md) |

Tenant RLS реализован миграцией [`1700000000029-TenantRowSecurity`](../../apps/backend/src/migrations/1700000000029-TenantRowSecurity.ts), а backend при старте проверяет RLS-политики и права роли PostgreSQL в [`app.module.ts`](../../apps/backend/src/app.module.ts) и [`tenant-database.ts`](../../apps/backend/src/common/tenant/tenant-database.ts). Это описание реализации в репозитории; оно не подтверждает, что миграции применены и база доступна в конкретном окружении.

Для доставки уведомлений в backend есть Redis-клиент, BullMQ queue и worker в [`NotificationDeliveryService`](../../apps/backend/src/notifications/delivery/notification-delivery.service.ts). Очередь создаётся только при `NOTIFICATIONS_QUEUE_ENABLED=true`; отправка по каналам дополнительно зависит от `NOTIFICATIONS_DELIVERY_ENABLED`, выбранного провайдера и его конфигурации. Наличие кода не подтверждает подключение Redis или успешную доставку в конкретном окружении.

S3 storage adapter, FCM/APNs delivery, PostHog и Kubernetes deployment не являются реализованными компонентами.

## Документы

- [System overview](system-overview.md) — текущие runtime-связи и границы интеграций.
- [Backend architecture](backend-architecture.md) — модули, конфигурация и миграции.
- [Web architecture](web-architecture.md) — историческая архитектура legacy `apps/web`.
- [MAX architecture](max-miniapp-architecture.md) — историческая отдельная Vite Mini App; текущий MAX flow описан в клиентском руководстве.
- [Mobile architecture](mobile-architecture.md) — проектная заметка для отсутствующего нативного Flutter-клиента.
- [Tech stack](tech-stack.md) — текущие версии библиотек и явно помеченные незадействованные технологии.
- [Data model](data-model.md) и [database schema](../database/schema-overview.md) — доменная модель и схема.
- [Roles and permissions](roles-and-permissions.md) — role enum, policy boundaries и ссылки на реализацию.
- [Connectors](connectors.md) — расписание внешних источников и ограничения.
- [Events](events.md), [error handling](error-handling.md) и [logging](logging.md) — backend runtime patterns.
- [Configuration files](config-files.md) — карта текущих конфигураций; старые примеры помечены как исторические.
- [Common components](common-components.md) и [shared types](shared-types.md) — общие backend/web abstractions.

## Архитектурные решения

Решения ADR фиксируют контекст и принятое направление на момент согласования. Код может реализовывать решение частично или позднее; актуальные implementation notes приведены в ADR и соответствующих runtime-документах.

- [ADR-0001: modular monolith](../decisions/0001-modular-monolith.md)
- [ADR-0002: tenant isolation](../decisions/0002-multitenancy-university-id.md)
- [ADR-0003: JWT](../decisions/0003-jwt-auth.md)
- [ADR-0004: OpenAPI source](../decisions/0004-openapi-source-of-truth.md)
- [ADR-0005: tech stack](../decisions/0005-tech-stack.md)
- [ADR-0006: monorepo](../decisions/0006-monorepo-vs-polyrepo.md)
- [ADR-0007: deployment](../decisions/0007-deployment-strategy.md)
