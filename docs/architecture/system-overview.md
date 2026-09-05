# Архитектура системы НаПаре

## Высокоуровневая схема

```mermaid
graph TB
    subgraph Clients["Клиенты"]
        Mobile["Mobile App<br/>(Flutter)"]
        Web["Web App<br/>(Next.js)"]
        MAX["MAX Mini-App<br/>(React + Vite)"]
    end

    subgraph Backend["Backend (NestJS)"]
        Auth["Auth Module"]
        Schedule["Schedule Module"]
        PairSpace["PairSpace Module"]
        Absences["Absences Module"]
        Notifications["Notifications Module"]
        Admin["Admin Module"]
    end

    subgraph Data["Данные"]
        PG["PostgreSQL 16"]
        Redis["Redis 7"]
        S3["S3 Storage"]
    end

    subgraph External["Внешние сервисы"]
        FCM["Firebase Cloud Messaging"]
        APNs["Apple Push Notifications"]
        Connectors["Connectors Layer"]
    end

    Mobile --> Auth
    Web --> Auth
    MAX --> Auth

    Auth --> Schedule
    Auth --> PairSpace
    Auth --> Absences
    Auth --> Notifications
    Auth --> Admin

    Schedule --> PG
    PairSpace --> PG
    Absences --> PG
    Notifications --> PG
    Admin --> PG

    PairSpace --> S3
    Notifications --> Redis
    Auth --> Redis

    Notifications --> FCM
    Notifications --> APNs
    Schedule --> Connectors
```

## Модульный монолит

Единый NestJS-процесс с модульной структурой. См. [ADR-0001](../03_DECISIONS/0001-modular-monolith.md).

Каждый модуль — автономная область ответственности:

| Модуль | Ответственность | Файлы |
|--------|----------------|-------|
| Auth | Регистрация, вход, JWT, роли | `modules/auth.md` |
| Schedule | Расписание, коннекторы, детект изменений | `modules/schedule.md` |
| PairSpace | Объявления, ДЗ, файлы, обсуждение | `modules/pair-space.md` |
| Absences | Статусы отсутствий, подтверждения куратора | `modules/absences.md` |
| Notifications | Push + in-app уведомления | `modules/notifications.md` |
| Admin | Управление вузом, ролями, расписанием | `modules/admin.md` |
| MyDay | Агрегация данных для главного экрана | `modules/my-day.md` |

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
- [03_DECISIONS/](../03_DECISIONS/) — архитектурные решения
