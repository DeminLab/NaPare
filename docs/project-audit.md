# Project Audit — NaPare

**Дата инвентаризации:** 2026-09-06
**Репозиторий:** monorepo (pnpm + Turborepo)
**Стек:** NestJS 10 / Next.js 14 / PostgreSQL 16 / Redis 7 / Docker

---

## 1. Структура проекта

```
NaPare/
├── apps/
│   ├── backend/          ✅ 66 .ts файлов, ~1800 строк
│   ├── web/              ⚠️ 4 страницы, ~272 строк
│   └── mobile/           ❌ Отсутствует (заявлен Flutter)
├── packages/
│   ├── shared/           ✅ Типы, константы, валидаторы (~250 строк)
│   └── api-client/       ✅ Axios-клиент (~230 строк)
├── docs/                 ✅ 80+ файлов, полная документация
├── infrastructure/
│   └── nginx/            ✅ nginx.conf (HTTP, HTTPS закомментирован)
├── scripts/              ❌ Пустая директория
├── docker-compose.dev.yml   ✅ PostgreSQL, Redis, MinIO
├── docker-compose.prod.yml  ✅ Backend, Web, Nginx, PostgreSQL, Redis
└── turbo.json            ✅
```

---

## 2. Backend (NestJS) — Детальный аудит

### 2.1 Модули

| Модуль | Файлов | Статус | Комментарии |
|--------|--------|--------|-------------|
| **Core** (main, app.module, health, database, config) | 5 | ✅ Implemented | Полностью рабочий bootstrap |
| **Auth** (login, register, JWT, refresh) | 8 | ✅ Implemented | bcrypt, JWT access+refresh, Swagger |
| **Users** (CRUD, профиль) | 6 | ✅ Implemented | `updateLastLogin` и `deactivate` не вызываются |
| **Schedule** (расписание, коннекторы, diff) | 10 | ⚠️ Partial | `HttpModule` не импортирован в `ScheduleModule` |
| **PairSpace** (объявления, ДЗ) | 8 | ✅ Implemented | CRUD полностью |
| **Absences** (пропуски) | 6 | ⚠️ Partial | **BUG:** локальная `Between()` shadowing TypeORM импорт |
| **Notifications** (push, in-app) | 8 | ⚠️ Partial | Event handler — stub, только `logger.log` |
| **Admin** (роли, импорт, статистика) | 5 | ⚠️ Partial | `importSchedule` — stub, `getUniversityStats` — хардкод |
| **My-Day** (агрегация) | 3 | ⚠️ Partial | TODO: фильтрация по группе студента |
| **Common** (guards, filters, decorators) | 6 | ✅ Implemented | `UniversityGuard` нигде не используется |

### 2.2 Сущности (Entity)

| Entity | Статус | Примечание |
|--------|--------|------------|
| `User` | ✅ | 8 ролей, `@Exclude()` на passwordHash |
| `Lesson` | ✅ | 3 индекса, полный набор полей |
| `LessonChange` | ✅ | ManyToOne → Lesson |
| `PairSpace` | ✅ | OneToMany → Announcement, Homework |
| `Announcement` | ✅ | ManyToOne → PairSpace |
| `Homework` | ✅ | ManyToOne → PairSpace |
| `Absence` | ✅ | Статусы, подтверждения |
| `Notification` | ✅ | Типы: info/warning/success/error |
| `DeviceToken` | ✅ | Для push-уведомлений |

### 2.3 Known Bugs

| # | Файл | Описание |
|---|------|----------|
| 1 | `absences/absences.service.ts:109` | Локальная функция `Between()` возвращает MongoDB-стиль `{ $gte, $lte }` вместо TypeORM `Between`. Метод `findByDateRange()` генерирует некорректный SQL. |
| 2 | `schedule/schedule.module.ts` | `SibitConnectorService` инжектит `HttpService` из `@nestjs/axios`, но `HttpModule` не импортирован в модуль. |
| 3 | `admin/admin.controller.ts:53` | `importSchedule` вызывается с пустым `{ fileUrl: '', format: 'excel' }` — всегда импортирует пустой массив. |

### 2.4 TODO / Заглушки

| Файл | Строки | Содержание |
|------|--------|------------|
| `notifications/events/notification-event.handler.ts` | 23-24 | `// TODO: Find affected students and send notifications` — placeholder |
| `notifications/events/notification-event.handler.ts` | 38 | `// TODO: Send push notifications to affected students` |
| `notifications/events/notification-event.handler.ts` | 52 | `// TODO: Send notifications to students` |
| `notifications/events/notification-event.handler.ts` | 65 | `// TODO: Send notifications to students` |
| `admin/admin.service.ts` | 43-44 | `// TODO: Parse schedule from file` — placeholder |
| `admin/admin.service.ts` | 49 | `// TODO: Implement actual stats` — возвращает хардкод `{ totalUsers: 0, ... }` |
| `my-day/my-day.service.ts` | 23 | `// TODO: Get student's group` — fallback на `findByDate` без фильтрации |

**Итого: 9 TODO, 0 FIXME, 0 HACK**

### 2.5 Неиспользуемый код

| Что | Где определено | Где используется |
|-----|----------------|------------------|
| `UsersService.updateLastLogin()` | `users.service.ts` | Нигде |
| `UsersService.deactivate()` | `users.service.ts` | Нигде |
| `UniversityGuard` | `common/guards/university.guard.ts` | Нигде не подключён |
| `AbsencesService.findByDateRange()` | `absences.service.ts` | Не вызывается из контроллера |

---

## 3. Frontend (Next.js) — Детальный аудит

### 3.1 Страницы

| Страница | Файл | Статус | Строки |
|----------|------|--------|--------|
| Landing | `app/page.tsx` | ✅ Implemented | 49 |
| Root Layout | `app/layout.tsx` | ✅ Implemented | 22 |
| Login | `app/(auth)/login/page.tsx` | ✅ Implemented | 94 |
| Register | `app/(auth)/register/page.tsx` | ❌ Missing | — |
| My Day (Student) | `app/(student)/my-day/page.tsx` | ✅ Implemented | 104 |

### 3.2 Заявленное vs Реальное

| Что заявлено в README | Статус |
|------------------------|--------|
| `src/components/layout/` | ❌ Не существует |
| `src/components/ui/` | ❌ Не существует |
| `src/lib/hooks/` | ❌ Не существует |
| `src/lib/queries/` | ❌ Не существует |
| TanStack Query интеграция | ❌ Установлен, не используется |
| Zustand stores | ❌ Установлен, не используется |
| Axios клиент | ❌ Установлен, не используется (raw `fetch`) |
| Register page | ❌ Ссылка с landing, но файла нет |
| Profile page | ❌ Не реализована |
| PairSpace page | ❌ Не реализована |
| Schedule page (полная) | ❌ Не реализована |
| Auth context/provider | ❌ Токены в `localStorage` напрямую |
| Error boundaries | ❌ Не реализованы |

### 3.3 Проблемы

- `my-day/page.tsx` использует raw `fetch` + `localStorage` вместо TanStack Query/Zustand
- `login/page.tsx` хранит токены в `localStorage` без refresh-логики
- `next.config.js:12-18` — все remote image patterns разрешены (potential security issue)
- `tailwind.config.js:9` — контент путь `src/components/**` ссылается на несуществующую директорию

---

## 4. Mobile (Flutter)

| Что | Статус |
|-----|--------|
| `apps/mobile/` | ❌ Директория отсутствует |
| Flutter-код | ❌ Отсутствует |
| pubspec.yaml | ❌ Отсутствует |

README подробно описывает Flutter-архитектуру (Riverpod, go_router, dio, Clean Architecture), но **ни одного файла** не существует.

---

## 5. Shared Packages

### `@napare/shared`

| Модуль | Статус | Строки |
|--------|--------|--------|
| Constants (ROLES, LESSON_STATUS, PAIR_TIMES) | ✅ Implemented | 55 |
| Types (User, Lesson, PairSpace, etc.) | ✅ Implemented | 148 |
| Validators (email, password, role, etc.) | ✅ Implemented | 45 |

### `@napare/api-client`

| Компонент | Статус | Строки |
|-----------|--------|--------|
| Axios клиент с JWT refresh | ✅ Implemented | 229 |
| Типы (дублируют shared) | ⚠️ Partial | 154 |
| Export barrel | ✅ Implemented | 14 |

**Проблема:** `api-client/src/types.ts` дублирует типы из `@napare/shared` — нарушение DRY. Типы определены заново вместо re-export.

---

## 6. Docker

| Файл | Статус | Сервисы |
|------|--------|---------|
| `docker-compose.dev.yml` | ✅ Implemented | PostgreSQL 16, Redis 7, MinIO |
| `docker-compose.prod.yml` | ✅ Implemented | Backend, Web, PostgreSQL, Redis, Nginx |
| `apps/backend/Dockerfile` | ✅ Present | — |
| `apps/web/Dockerfile` | ✅ Present | — |
| `infrastructure/nginx/nginx.conf` | ✅ Implemented | Rate limiting, gzip, HTTPS (закомментирован) |

**Замечания:**
- Dev compose не включает backend/web (нужно запускать вручную)
- Prod compose не включает MinIO (файловое хранилище не настроено)
- HTTPS в nginx закомментирован — нет SSL сертификатов

---

## 7. Database

| Что | Статус |
|-----|--------|
| TypeORM конфигурация | ✅ `config/database.config.ts` |
| Миграции | ❌ Директория `src/database/migrations/` отсутствует |
| Seed data | ❌ Нет скрипта (только `docs/database/seed.md` — документация) |
| Схема SQL | ⚠️ `docs/database/schema-full.sql` — документация, не применяется |
| 9 entities зарегистрированы | ✅ `database.module.ts` |

---

## 8. Тесты

| Что | Статус |
|-----|--------|
| `.test.ts` файлы | ❌ 0 файлов |
| `.spec.ts` файлы | ❌ 0 файлов |
| Jest конфигурация | ⚠️ `test:e2e` в package.json, но `test/jest-e2e.json` отсутствует |
| Тестовые зависимости | ✅ jest, ts-jest, supertest в devDependencies |
| Coverage | ❌ Нет ни одного теста |

---

## 9. Документация vs Код

### Заявленное в README, но отсутствующее в коде

| Что | README | Код |
|-----|--------|-----|
| `apps/mobile/` (Flutter) | Подробное описание архитектуры | Директория не существует |
| `src/components/` (Web) | `layout/`, `ui/` компоненты | Пусто |
| `src/lib/hooks/` (Web) | Хуки | Пусто |
| `src/lib/queries/` (Web) | TanStack Query | Пусто |
| Тесты | `pnpm test`, `pnpm test:e2e` | 0 тестов |
| Миграции | `pnpm typeorm:migration:generate` | Нет директории миграций |
| CI/CD | GitHub Actions | Нет `.github/workflows/` |
| Kubernetes / Terraform / Helm | Описаны в README | Отсутствуют в репозитории |
| Prometheus / Grafana | Описаны в README | Отсутствуют в репозитории |
| PostHog | Упомянут в README | Не настроен |
| Sentry | Инициализирован в `main.ts` | DSN пустой в `.env.example` |

### Документация, которая существует и соответствует коду

| Документ | Содержание |
|----------|------------|
| `docs/modules/auth.md` | Соответствует реализации |
| `docs/modules/schedule.md` | Соответствует реализации |
| `docs/modules/pair-space.md` | Соответствует реализации |
| `docs/modules/absences.md` | Соответствует реализации |
| `docs/modules/notifications.md` | Частично (push не реализован) |
| `docs/modules/admin.md` | Частично (импорт/stats — stub) |
| `docs/modules/my-day.md` | Частично (группа студента — TODO) |
| `docs/architecture/*` | Актуальны |
| `docs/decisions/*` (7 ADR) | Актуальны |
| `docs/api/contracts.md` | 55 эндпоинтов — полная спецификация |
| `docs/security/*` | Актуальны |
| `docs/strategy/*` | Актуальны |
| `docs/product/*` | Актуальны |

---

## 10. Интеграции

| Интеграция | Статус |
|------------|--------|
| SIBIT API (rasp.sibit.ru) | ⚠️ Код есть, но `HttpModule` не импортирован — не запустится |
| Excel парсер (xlsx) | ✅ Рабочий |
| PostgreSQL (TypeORM) | ✅ Настроен |
| Redis | ⚠️ Подключён в `.env`, но нигде не используется в коде |
| Sentry | ⚠️ Инициализирован, DSN пустой |
| MinIO (файлы) | ⚠️ В docker-compose dev, но интеграции в коде нет |
| JWT (Passport) | ✅ Полностью |
| bcrypt | ✅ Полностью |
| Swagger/OpenAPI | ✅ Настроен в `main.ts` |
| Push (FCM/APNs) | ❌ Упомянут в документации, код — stub |

---

## 11. Итоговая таблица

### Implemented (полностью)

| Компонент | Файлов |
|-----------|--------|
| Backend: Auth module | 8 |
| Backend: Users module | 6 |
| Backend: PairSpace module | 8 |
| Backend: Common (guards, filters, decorators) | 6 |
| Backend: Database config | 1 |
| Backend: Health endpoint | 1 |
| Shared: Constants, Types, Validators | 3 |
| API Client | 3 |
| Docker (dev + prod) | 4 |
| Nginx config | 1 |
| Документация (80+ файлов) | 80+ |

### Partially Implemented (есть TODO / заглушки / баги)

| Компонент | Проблема |
|-----------|----------|
| Schedule module | `HttpModule` не импортирован |
| SibitConnector | Не запустится без `HttpModule` |
| Absences service | BUG: `Between()` shadowing |
| Notifications handler | Stub: только `logger.log`, 4 TODO |
| Admin service | `importSchedule` — stub, `getUniversityStats` — хардкод |
| My-Day service | TODO: фильтрация по группе студента |
| Web: My-Day page | Raw fetch, без TanStack Query |
| Web: Login page | Нет refresh-логики |

### Missing (отсутствует полностью)

| Компонент | Описание |
|-----------|----------|
| **Mobile app (Flutter)** | Нет `apps/mobile/`, ни одного файла |
| **Register page** | Ссылка на landing, но файла нет |
| **Web components** | `layout/`, `ui/` — пусто |
| **Web hooks & queries** | `lib/hooks/`, `lib/queries/` — пусто |
| **Web stores (Zustand)** | Установлен, не используется |
| **Tests** | 0 тестов (.test.ts / .spec.ts) |
| **Migrations** | Нет директории `src/database/migrations/` |
| **CI/CD pipelines** | Нет `.github/workflows/` |
| **K8s / Terraform / Helm** | Описаны, отсутствуют |
| **Prometheus / Grafana** | Описаны, отсутствуют |
| **Scripts** | Директория `scripts/` пуста |
| **Push notifications (FCM/APNs)** | Код — stub |
| **File storage (MinIO)** | Docker есть, интеграции в коде нет |
| **Redis usage** | Подключён, не используется |
| **PostHog** | Упомянут, не настроен |

### Broken (не работает)

| # | Проблема | Файл |
|---|----------|------|
| 1 | `Between()` shadowing → `findByDateRange` генерирует неверный SQL | `absences/absences.service.ts:109` |
| 2 | `SibitConnectorService` упадёт — `HttpModule` не в модуле | `schedule/schedule.module.ts` |
| 3 | `importSchedule` всегда импортирует 0 записей | `admin/admin.service.ts:45` |

### Unknown (требует проверки)

| Что | Причина |
|-----|---------|
| Swagger endpoint `/api/v1/docs` | Работает ли при запуске |
| JWT refresh flow end-to-end | Нет интеграционных тестов |
| Multi-tenancy filtering | `UniversityGuard` не подключён к маршрутам |
| Event emitter (lesson.changed, etc.) | События генерируются, но обработчики — stub |

---

## 12. Количественная сводка

| Метрика | Значение |
|---------|----------|
| Backend модулей | 9 |
| Backend .ts файлов | 66 |
| Backend строк кода | ~1800 |
| Web страниц | 4 (из ~10 запланированных) |
| Web строк кода | ~272 |
| Shared packages | 2 (shared + api-client) |
| Shared строк кода | ~650 |
| Документов в docs/ | 80+ |
| TODO комментариев | 9 |
| Known bugs | 3 |
| Тестов | 0 |
| Сущностей (Entity) | 9 |
| API эндпоинтов (по contracts.md) | 55 |
| Реализовано эндпоинтов | ~25 |

---

*Audit completed — docs/project-audit.md*
