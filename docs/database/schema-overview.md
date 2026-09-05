# Схема базы данных — обзор

**Source of truth:** SQL-схема в репозитории (`prisma/schema.prisma` или `migrations/`).

Полная SQL-схема: `docs/02_Technical/TZ_01_DATABASE_SCHEMA.md` (архив) или `prisma/schema.prisma` в коде.

---

## Ключевые таблицы

| Таблица | Описание | Индексы |
|---------|----------|---------|
| `users` | Пользователи | university_id, group_id, phone, email, roles (GIN) |
| `universities` | Вузы | name (trigram), city, status |
| `faculties` | Факультеты | university_id |
| `groups` | Группы | faculty_id, (faculty_id, name) unique |
| `teachers` | Преподаватели | user_id, university_id |
| `lessons` | Пары | university_id, group_id, teacher_id, day_of_week+start_time |
| `lesson_changes` | Изменения пар | lesson_id, change_type, created_at |
| `pair_spaces` | Пространства пар | lesson_id (unique) |
| `announcements` | Объявления | pair_space_id, author_id |
| `homeworks` | ДЗ | pair_space_id |
| `homework_submissions` | Статусы сдачи | homework_id, student_id |
| `file_attachments` | Файлы | pair_space_id |
| `discussion_messages` | Обсуждения | pair_space_id, parent_id |
| `absence_statuses` | Статусы отсутствий | user_id, start_date, end_date |
| `absence_confirmations` | Подтверждения | absence_id, curator_id |
| `notifications` | Уведомления | user_id, is_read |
| `device_tokens` | Токены устройств | user_id, platform |
| `audit_logs` | Аудит | user_id, action, created_at |
| `preferences` | Настройки | user_id |

---

## Мультивузовость

Все доменные таблицы имеют `university_id UUID REFERENCES universities(id)`.

RLS (Row Level Security) в PostgreSQL как дополнительная защита:

```sql
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY university_isolation ON lessons
  USING (university_id = current_setting('app.university_id')::uuid);
```

---

## Миграции

- TypeORM миграции: `pnpm run typeorm:migration:run`
- Просмотр: `pnpm run typeorm:migration:show`
- Откат: `pnpm run typeorm:migration:revert`

---

## Seed data

Для пилота на СИБИТ: [database/seed.md](seed.md).

---

## См. также

- [architecture/data-model.md](../architecture/data-model.md) — ER-диаграмма
- [architecture/system-overview.md](../architecture/system-overview.md) — архитектура
