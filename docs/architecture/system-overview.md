# Архитектура системы НаПаре

## Высокоуровневая схема

```mermaid
graph TB
    subgraph Clients["Клиенты"]
        Portal["web-Portal<br/>(Next.js, единый вход)"]
        Web["Рабочие пространства<br/>web-student / staff / admin / developer"]
        MAX["MAX Bot / WebApp Bridge<br/>(launches web-portal)"]
        Legacy["apps/web<br/>(legacy-лендинг)"]
    end

    subgraph Backend["Backend (NestJS)"]
        Auth["Auth Module"]
        Users["Users Module"]
        Schedule["Schedule Module"]
        PairSpace["PairSpace Module"]
        Absences["Absences Module"]
        Notifications["Notifications Module"]
        Admin["Admin Module"]
        MyDay["MyDay Module"]
        Academic["Academic Module"]
        Events["Events Module"]
        Tenant["TenantContext Module"]
        DBMod["Database Module"]
    end

    subgraph Data["Данные"]
        PG["PostgreSQL 16"]
    end

    subgraph External["Внешние сервисы"]
        FCM["FCM / APNs<br/>(отправка не реализована)"]
        Connectors["Connectors Layer<br/>SIBIT / rasp.sano.ru / Excel"]
    end

    Portal --> Auth
    Web --> Auth
    MAX --> Portal
    Legacy --> Auth

    Auth --> Users
    Auth --> Schedule
    Auth --> PairSpace
    Auth --> Absences
    Auth --> Notifications
    Auth --> Admin
    Auth --> MyDay

    Schedule --> PG
    PairSpace --> PG
    Absences --> PG
    Notifications --> PG
    Admin --> PG
    MyDay --> PG
    Academic --> PG
    Events --> PG
    Users --> PG
    Tenant --> PG

    Notifications --> FCM
    Schedule --> Connectors
    Events --> Notifications
```

> **Не интегрировано в коде backend**: Redis (контейнер и `REDIS_URL` есть в Docker Compose,
> клиента в коде нет) и S3 (только переменные `STORAGE_*` в `apps/backend/.env.example`).
> Push-отправка (FCM/APNs): загружается `deviceToken` (`POST /devices/token`), сама отправка не реализована.

## Модульный монолит

Единый NestJS-процесс с модульной структурой. См. [ADR-0001](../decisions/0001-modular-monolith.md).

Каждый модуль — автономная область ответственности:

| Модуль | Ответственность | Файлы |
|--------|----------------|-------|
| Auth | Вход (login, portal-login, MAX), JWT, рефреш, каталог rasp.sano.ru | `modules/auth.md`, `apps/backend/src/auth/` |
| Users | Профиль, роли, вузы/факультеты/группы, `POST /users/me/bind-group` | `apps/backend/src/users/` |
| Schedule | Расписание, коннекторы (SIBIT, Excel), детект изменений | `modules/schedule.md`, `apps/backend/src/schedule/` |
| PairSpace | Объявления, ДЗ, файлы, обсуждение | `modules/pair-space.md`, `apps/backend/src/pair-space/` |
| Absences | Статусы отсутствий, посещаемость, подтверждения куратора | `modules/absences.md`, `apps/backend/src/absences/` |
| Notifications | In-app уведомления, inbox, device token | `modules/notifications.md`, `apps/backend/src/notifications/` |
| Admin | Управление вузом, ролями, импорт/синхронизация расписания | `modules/admin.md`, `apps/backend/src/admin/` |
| MyDay | Агрегация данных для главного экрана | `modules/my-day.md`, `apps/backend/src/my-day/` |
| Academic | Курсы, серии/занятия, академические события | `modules/academic.md`, `apps/backend/src/academic/` |
| Events | Шина событий и журнал событий (`event-bus`, `event-record`) | `apps/backend/src/events/` |
| Rasp | Доступ к rasp.sano.ru; подключается в Auth и Schedule | `apps/backend/src/rasp/rasp.module.ts` |
| Database | Инициализация схемы (`init.sql`) | `apps/backend/src/database/` |
| TenantContext | Контекст `tenant_id` / `university_id` для изоляции данных | `apps/backend/src/common/tenant/` |

Модули регистрируются в `apps/backend/src/app.module.ts` (Auth, Users, Schedule, PairSpace, Absences,
Notifications, Admin, MyDay, Database, TenantContext, Events, Academic); `RaspModule` импортируется
модулями Auth и Schedule.

## Потоки данных

### Регистрация студента

```mermaid
sequenceDiagram
    participant S as Студент
    participant API as Backend API
    participant DB as PostgreSQL
    participant Push as Notification Service

    S->>API: POST /auth/request-code (телефон)
    API->>DB: Создать/найти пользователя
    API-->>S: Код отправлен
    S->>API: POST /auth/verify-code (код)
    API->>DB: Сохранить JWT
    API-->>S: accessToken + refreshToken
    S->>API: PATCH /users/me (выбор вуза, группы)
    API->>DB: Привязать university_id, group_id
    API-->>S: Профиль сохранён
    S->>API: GET /schedule/my
    API-->>S: Расписание + дедлайны + контент
```

### Изменение расписания

```mermaid
sequenceDiagram
    participant Admin as Админ
    participant Connector as Коннектор
    participant API as Backend
    participant DB as PostgreSQL
    participant Notif as Notification Service
    participant Student as Студент

    Admin->>API: POST /admin/schedule/upload
    API->>Connector: fetchSchedule()
    Connector->>API: NormalizedLesson[]
    API->>DB: Сравнить с текущими данными
    API->>DB: Создать LessonChange
    API->>Notif: Событие "schedule_change"
    Notif->>Student: Push-уведомление
    Student->>API: GET /schedule/my
    API-->>S: Расписание с индикатором "Изменено"
```

## См. также

- [tech-stack.md](tech-stack.md) — стек технологий
- [data-model.md](data-model.md) — модель данных
- [roles-and-permissions.md](roles-and-permissions.md) — матрица прав
- [connectors.md](connectors.md) — слой коннекторов
- [decisions/](../decisions/) — архитектурные решения
