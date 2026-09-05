# NaPare — Операционная система учебного дня

**B2B2C SaaS-платформа** для университетов, которая собирает расписание, задания, материалы, общение и посещаемость в одном месте — вокруг каждой пары.

## Идея

Студентская учебная жизнь размазана по десяткам мест: расписание на сайте вуза, изменения в Telegram, домашки в чатах, файлы в облаке, пропуски — устно куратору. **NaPare** объединяет всё это в единой точке входа — экране «Мой день» — без ИИ, на чистой агрегации данных.

## Ключевые понятия

| Термин | Описание |
|--------|----------|
| **Пара** | Конкретное занятие — центральная сущность системы |
| **PairSpace** | Страница пары: объявления, домашки, файлы, обсуждения |
| **Мой день** | Главный экран студента — персональная сводка на день |
| **Коннектор** | Модуль загрузки расписания из внешних источников (парсеры, Excel, iCal) |
| **LessonChange** | Запись об изменении расписания (отмена, перенос, замена аудитории/преподавателя) |

## Как работает

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Мобильное  │     │   Веб-прил. │     │ MAX Мини-   │
│  приложение │     │  (Next.js)  │     │   приложение│
│  (Flutter)  │     │             │     │ (React/Vite)│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  REST API   │
                    │  (NestJS)   │
                    │  /api/docs  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │PostgreSQL │ │ Redis │ │   Sentry  │
        │    16     │ │   7   │ │ PostHog   │
        └───────────┘ └───────┘ └───────────┘
```

### Поток данных

1. **Коннектор** загружает расписание из источника вуза (Excel, iCal, парсер сайта)
2. **Schedule Module** обрабатывает данные, определяет изменения (аналог diff)
3. **LessonChange** генерируется при любом отличии от предыдущего состояния
4. **Notifications Module** отправляет push по FCM/APNs и внутри приложения
5. **My Day** агрегирует пары, объявления, домашки и статусы пропусков на экране

### Аутентификация

- Регистрация через email/пароль (bcrypt)
- JWT access-токен (15–30 мин) + refresh-токен (7 дней)
- 8 ролей: `student`, `teacher`, `curator`, `faculty_dean`, `department_head`, `university_admin`, `superadmin`, `developer`
- Multi-tenancy: каждый запрос фильтруется по `universityId`

## Технологии

| Слой | Технологии |
|------|-----------|
| **Backend** | NestJS 10+, TypeScript 5.3+, TypeORM 0.3+, PostgreSQL 16, Redis 7 |
| **Web** | Next.js 14+ (App Router), TanStack Query 5+, Tailwind CSS 3+ |
| **Mobile** | Flutter 3.x, Riverpod 2+, go_router, dio |
| **MAX Mini-App** | React + Vite |
| **Monorepo** | pnpm 9+, Turborepo 2+ |
| **Инфраструктура** | Docker, Kubernetes, Terraform, Helm, Yandex Cloud |
| **CI/CD** | GitHub Actions |
| **Мониторинг** | Sentry, PostHog, Prometheus, Grafana |
| **API** | OpenAPI (генерируется из декораторов NestJS) |

## Структура проекта

```
NaPare/
├── apps/
│   ├── backend/          # NestJS API-сервер
│   │   └── src/
│   │       ├── auth/          # Аутентификация (логин, регистрация, JWT)
│   │       ├── users/         # Пользователи (CRUD, профиль)
│   │       ├── schedule/      # Расписание (пары, изменения, коннекторы)
│   │       ├── pair-space/    # PairSpace (объявления, ДЗ, файлы, обсуждения)
│   │       ├── absences/      # Пропуски (статусы, подтверждения)
│   │       ├── notifications/ # Уведомления (push, in-app)
│   │       ├── admin/         # Администрирование
│   │       └── common/        # Guards, filters, interceptors, decorators
│   ├── web/              # Next.js веб-приложение
│   └── mobile/           # Flutter мобильное приложение
├── packages/
│   ├── api-client/       # Автогенерируемый клиент (из OpenAPI)
│   └── shared/           # Общие типы, константы, валидаторы
├── docs/                 # Документация (160+ файлов)
├── infrastructure/       # Конфигурации инфраструктуры
└── scripts/              # Утилиты
```

## Быстрый старт

```bash
# 1. Клонировать и запустить зависимые сервисы
git clone https://github.com/napare/napare.git
cd napare
docker compose up -d

# 2. Backend
cd apps/backend
cp .env.example .env
pnpm install
pnpm dev                  # http://localhost:3000

# 3. Web
cd ../web
pnpm install
pnpm dev                  # http://localhost:3001

# 4. Mobile
cd ../mobile
flutter pub get
flutter run
```

### Команды

```bash
# Корневой уровень (Turborepo)
pnpm dev          # Запустить все приложения
pnpm build        # Собрать все
pnpm lint         # Линтер
pnpm test         # Тесты

# Backend
pnpm dev                          # Разработка с hot-reload
pnpm test                         # Jest
pnpm test:e2e                     # E2E тесты
pnpm typeorm:migration:generate   # Генерация миграции
pnpm typeorm:migration:run        # Применение миграций
```

### Полезные ссылки

| Ресурс | URL |
|--------|-----|
| API документация | http://localhost:3000/api/docs |
| Staging API | https://staging.napare.ru/api/docs |
| Staging Web | https://staging.napare.ru |

---

## Информация для команды

### Для разработчиков (Backend)

- **Вход в проект**: `docs/01_ONBOARDING.md`
- **Архитектура**: `docs/architecture/system-overview.md`
- **Модульная спецификация**: `docs/modules/` — каждый модуль описан по шаблону (цели, сущности, эндпоинты, права, UX, бизнес-правила, события, NFR)
- **Решения (ADR)**: `docs/decisions/` — 7 архитектурных решений
- **Миграции**: `pnpm typeorm:migration:generate -- src/database/migrations/НазваниеМиграции`
- **Контрибьютинг**: `docs/process/contributing.md`

**Ключевые принципы:**
- Модульный монолит на NestJS, не микросервисы
- Каждая сущность имеет `universityId` — multi-tenancy на уровне данных
- OpenAPI — источник правды для API (генерируется из декораторов)
- class-validator + DTO для валидации
- Roles Guard + University Guard на защищённых маршрутах

### Для разработчиков (Web)

- **Стек**: Next.js 14+ (App Router), TanStack Query, Tailwind CSS
- **Структура**: `apps/web/src/app/` — роуты по сценариям (auth, student)
- **Компоненты**: `apps/web/src/components/` — layout/, ui/
- **Хуки и запросы**: `apps/web/src/lib/hooks/`, `apps/web/src/lib/queries/`

### Для мобильного разработчика (Flutter)

- **Стек**: Flutter 3.x, Riverpod, go_router, dio
- **Архитектура**: Clean Architecture — `core/`, `features/`, `shared/`
- **Фичи**: `lib/features/{auth,my_day,schedule}/` — data/, presentation/, providers/
- **API клиент**: `lib/core/api/`

### Для дизайнера

- **Дизайн-система**: `docs/ui/` — спецификации экранов и компонентов
- **Глоссарий**: `docs/02_GLOSSARY.md` — единая терминология (50+ определений)
- **Персоны**: `docs/product/` — описания пользователей
- **Видение продукта**: `docs/strategy/vision.md`

**Экраны:**
- «Мой день» — главный экран студента (агрегация без ИИ)
- PairSpace — страница пары (объявления, ДЗ, файлы)
- Расписание — список пар с фильтрами
- Профиль — настройки, роль, уведомления

### Для DevOps / SRE

- **Деплой**: `docs/ops/deployment.md`
- **Инфраструктура**: `docs/ops/infrastructure.md` — полная настройка K8s, Terraform, Helm для Yandex Cloud
- **CI/CD**: `docs/ops/cicd.md` — GitHub Actions пайплайн
- **Мониторинг**: `docs/ops/monitoring.md` — Prometheus, Grafana, Sentry

### Для менеджера / продакта

- **Видение**: `docs/strategy/vision.md`
- **Монетизация**: `docs/strategy/monetization.md` — B2B2C SaaS с тарифами
- **Роадмап**: `docs/strategy/roadmap.md` — 4 фазы (0–24+ мес)
- **Метрики**: `docs/product/`

### Безопасность

- **152-ФЗ**: `docs/security/152-fz.md` — чеклист соответствия закону о защите персональных данных
- **Угрозы**: `docs/security/threat-model.md`

---

## Лицензия

См. [LICENSE](./LICENSE).

---

*NaPare — потому что «на паре» всё и начинается.*
