# Changelog

## [2.1.0] — 2026-09-05

### Архитектура кода

Детальное проектирование архитектуры кода для всех компонентов системы.

#### Архитектурные решения (ADR)
- `03_DECISIONS/0001-modular-monolith.md` — модульный монолит
- `03_DECISIONS/0002-multitenancy-university-id.md` — мультивузовость
- `03_DECISIONS/0003-jwt-auth.md` — JWT-авторизация
- `03_DECISIONS/0004-openapi-source-of-truth.md` — OpenAPI
- `03_DECISIONS/0005-tech-stack.md` — стек технологий
- `03_DECISIONS/0006-monorepo-vs-polyrepo.md` — монорепозиторий
- `03_DECISIONS/0007-deployment-strategy.md` — стратегия деплоя

#### Архитектура кода (общая)
- `architecture/backend-architecture.md` — структура NestJS: модули, сервисы, контроллеры, паттерны
- `architecture/mobile-architecture.md` — структура Flutter: провайдеры, репозитории, модели
- `architecture/web-architecture.md` — структура Next.js: компоненты, хуки, страницы
- `architecture/max-miniapp-architecture.md` — структура React: MAX интеграция
- `architecture/shared-types-architecture.md` — общие типы и интерфейсы

#### Детальные реализации модулей
- `architecture/modules/auth-module.md` — Auth: сервис, контроллер, JWT стратегии, DTO, тесты
- `architecture/modules/schedule-module.md` — Schedule: сущности, коннекторы, детект изменений
- `architecture/modules/pair-space-module.md` — PairSpace: объявления, ДЗ, файлы, обсуждение

#### Инфраструктура
- `architecture/common-components.md` — Guards, Interceptors, Filters, Decorators
- `architecture/docker-cicd.md` — Docker Compose, Dockerfile, GitHub Actions CI/CD

#### Безопасность
- `security/threat-model.md` — модель угроз

---

## [2.0.0] — 2026-09-05

### Реорганизация документации

Полная перестройка структуры документации проекта «НаПаре»: от монолитного `MASTER_TZ` к модульной, AI-first, multi-developer ready документации enterprise-уровня.

#### Что сделано

**Точки входа:**
- `00_START_HERE.md` — обзор продукта, ссылки на все разделы
- `01_ONBOARDING.md` — путь нового разработчика / AI за 15 и 30 минут
- `02_GLOSSARY.md` — единая терминология

**Архитектурные решения (ADR):**
- `decisions/0001-modular-monolith.md` — модульный монолит
- `decisions/0002-flutter-mobile.md` — Flutter для mobile
- `decisions/0003-nestjs-backend.md` — NestJS для backend
- `decisions/0004-jwt-auth.md` — JWT access + refresh
- `decisions/0005-multitenancy-university-id.md` — мультивузовость
- `decisions/0006-connectors-layer.md` — слой коннекторов
- `decisions/0007-no-ai-in-mvp.md` — нет AI в MVP

**Архитектура:**
- `architecture/system-overview.md` — системная схема + Mermaid
- `architecture/tech-stack.md` — стек технологий
- `architecture/data-model.md` — модель данных + ER-диаграмма
- `architecture/roles-and-permissions.md` — единая матрица 8x17
- `architecture/connectors.md` — слой коннекторов расписания

**Модули (единый шаблон):**
- `modules/auth.md` — регистрация и авторизация
- `modules/schedule.md` — расписание
- `modules/pair-space.md` — пространство пары
- `modules/absences.md` — отсутствия
- `modules/my-day.md` — мой день
- `modules/notifications.md` — уведомления
- `modules/admin.md` — администрирование
- `modules/_TEMPLATE.md` — шаблон для новых модулей

**Клиенты:**
- `clients/mobile.md` — Flutter (iOS + Android)
- `clients/web.md` — Next.js
- `clients/max-miniapp.md` — MAX Mini-App

**API и БД:**
- `api/README.md` — OpenAPI = source of truth
- `api/examples.md` — нестандартные кейсы
- `database/schema-overview.md` — обзор схемы
- `database/seed.md` — seed data для СИБИТ

**UI:**
- `ui/design-system.md` — дизайн-система
- `ui/screens-student.md` — экраны студента (26 экранов)
- `ui/screens-teacher.md` — экраны преподавателя (4 экрана)
- `ui/screens-curator.md` — экраны куратора (4 экрана)
- `ui/screens-admin.md` — экраны админа (8 экранов)
- `ui/flows.md` — пользовательские потоки
- `ui/ui-states.md` — состояния UI

**Безопасность:**
- `security/152-fz.md` — 152-ФЗ чеклист
- `security/threat-model.md` — модель угроз

**Ops:**
- `ops/cicd.md` — CI/CD pipeline
- `ops/testing.md` — тестирование
- `ops/monitoring.md` — мониторинг
- `ops/runbooks.md` — runbook'и (парсер, SMS, push, БД, Redis, backend)

**Process:**
- `process/contributing.md` — PR процесс
- `process/definition-of-done.md` — DoD
- `process/branching.md` — ветвление
- `process/ownership.md` — ownership
- `process/sprint-playbook.md` — спринт-процесс

**Стратегия и продукт:**
- `strategy/vision.md` — видение
- `strategy/monetization.md` — монетизация
- `strategy/roadmap.md` — роадмап
- `strategy/investor-pitch.md` — питч для инвесторов
- `product/overview.md` — обзор продукта
- `product/personas.md` — персоны
- `product/success-metrics.md` — метрики успеха

**Конфигурация и инфраструктура:**
- `architecture/config-files.md` — все конфигурационные файлы (docker-compose, .env, turbo.json, package.json)
- `architecture/shared-types.md` — общие типы, константы и валидаторы (Zod)

**API и спецификации:**
- `api/contracts.md` — полная спецификация 55 API-эндпоинтов с валидацией, статус-кодами, rate limits

**UI:**
- `ui/screen-specs.md` — детальные компонентные спецификации всех экранов

**DevOps и архитектура:**
- `ops/deployment.md` — пошаговое руководство по деплою (local, staging, production, App Store, Google Play)
- `ops/infrastructure.md` — инфраструктура (Yandex Cloud, K8s, Terraform, Helm)
- `architecture/error-handling.md` — стратегия обработки ошибок ( NestJS, Flutter, Next.js)
- `architecture/logging.md` — стратегия логирования и мониторинга (Sentry, PostHog, Prometheus, Grafana)

**Архив:**
- `archive/TZ_00_MASTER_TZ.md` — старый полный документ (не редактировать)

#### Что удалено как дубль

- `00_Strategy/00_README.md` — заменён на `00_START_HERE.md`
- `00_Strategy/QUICK_START.md` — интегрирован в `01_ONBOARDING.md`
- Все `TZ_*.md` в `02_Technical/` — данные перенесены в модули, architecture, api, database, ops

#### Принципы

1. Single Source of Truth
2. AI-first (файлы ≤ 500 строк)
3. Module-bounded (единый шаблон)
4. Living docs (OpenAPI из кода)

---

## [1.0.0] — 2025

- Начальная документация (MASTER_TZ + модульные TZ)
