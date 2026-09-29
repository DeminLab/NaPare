# Обзор схемы базы данных

**Актуально на 2026-09-29.** PostgreSQL — основное хранилище backend. Источник схемы — TypeORM entities и миграции в `apps/backend/src`; Prisma-схемы в проекте нет. Изменения схемы оформляются новой миграцией, а не редактированием уже выпущенной.

## Основные области данных

| Область | Основные таблицы | Источник |
|---|---|---|
| Учётные записи и организация | `universities`, `faculties`, `groups`, `teachers`, `users` | `apps/backend/src/users/entities/`, начальная миграция |
| Расписание | `lessons`, `lesson_changes` | `apps/backend/src/schedule/entities/` |
| Пространство пары | `pair_spaces`, `announcements`, `homeworks`, `homework_submissions`, `file_attachments`, `discussion_messages` | `apps/backend/src/pair-space/entities/` |
| Учёт отсутствий | `absences`, `absence_confirmations`, `attendance_records`, `attendance_qr_sessions` | `apps/backend/src/absences/` |
| Уведомления и аудит | `notifications`, `notification_preferences`, `inbox_items`, `device_tokens`, `event_records`, `audit_logs` | `apps/backend/src/notifications/`, `apps/backend/src/events/` |
| Учебный контекст | `academic_courses`, `lesson_series`, `lesson_occurrences`, `course_spaces`, `lesson_spaces`, `academic_events`, `academic_schedule_changes` | `apps/backend/src/academic/` и миграция `1700000000004-AcademicContext.ts` |
| Дополнительные функции | `personal_lesson_notes`, `homework_progress`, `favorites`, Telegram link tables | профильные entities и миграции `1700000000010`–`1700000000016` |

Точные столбцы, ограничения и индексы находятся в сущностях и миграциях. Этот обзор не заменяет их. Полный список миграций: `apps/backend/src/migrations/`.

## Изоляция по университету

Доступ к данным ограничивается backend-контекстом университета, guards и проверками области доступа в сервисах. В миграциях проекта нет включённых PostgreSQL Row Level Security policies; не полагайтесь на RLS как на дополнительный барьер. Для новых запросов проверяйте одновременно tenant и роль/resource scope.

## Создание и применение миграций

Для локальной разработки команды запускаются из корня монорепозитория:

```powershell
pnpm --filter @napare/backend run typeorm:migration:generate -- src/migrations/DescribeChange
pnpm --filter @napare/backend run typeorm:migration:run
pnpm --filter @napare/backend run typeorm -- migration:show -d src/config/database.config.ts
```

The TypeORM CLI DataSource reads individual `DB_*` values from the process environment. Set them in the shell before running CLI migrations; the CLI does not use the NestJS ConfigModule bootstrap.

Production-конфигурация backend включает `migrationsRun: true`, поэтому ожидающие миграции запускаются при старте контейнера. Перед production-релизом сделайте резервную копию БД, проверьте backend logs и убедитесь, что строки в таблице TypeORM `migrations` соответствуют выпущенным миграциям. Не используйте `synchronize` в production.

## Демо-данные

Локальная инфраструктура и подготовка данных описаны в [руководстве seed data](seed.md). Не запускайте команды подготовки демо на production базе.

## См. также

- [Модель данных](../architecture/data-model.md)
- [Backend architecture](../architecture/backend-architecture.md)
- [Руководство по деплою](../../DEPLOY.md)
