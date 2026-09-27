# Module: Notifications (Уведомления)

## 1. Цель и границы

**Цель:** Сообщать пользователям о важных событиях: in-app уведомления, «входящие» (inbox) и счётчики непрочитанного.

**Не делает:** Бизнес-логику (только реагирует на события из других модулей); отправку push через FCM/APNs (см. раздел 8 — интеграции с push-провайдерами в коде нет).

---

## 2. Сущности

| Сущность               | Описание                       | Ключевые поля                                                                                                                                                                 |
| ---------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notification           | Уведомление                    | id, user_id, university_id, type, title, body, deep_link, is_read, read_at, data, category, priority, actions, event_id                                                       |
| DeviceToken            | Токен устройства               | id, user_id, platform, token, device_name, is_active                                                                                                                          |
| NotificationPreference | Настройки по типам             | id, user_id, university_id, schedule_changes, cancellations, room_changes, homework_created, deadlines, messages, announcements, system_alerts, quiet_hours_enabled/start/end |
| InboxItem              | «Входящие» (задачи к действию) | id, event_id, user_id, university_id, type, title, description, deep_link, priority, status (`open`/`snoozed`/`done`), due_at, actions, completed_at                          |

Все четыре регистрируются в `apps/backend/src/database/database.module.ts`.

Типы уведомлений (`NOTIFICATION_TYPES`): `schedule_change`, `new_announcement`, `new_homework`, `new_file`, `deadline`, `absence_decision`, `new_absence`, `system`, `other`.

Подробнее: [architecture/data-model.md](../architecture/data-model.md).

---

## 3. API

| Endpoint                                    | Метод  | Описание                          |
| ------------------------------------------- | ------ | --------------------------------- |
| `/api/v1/notifications`                     | GET    | Список уведомлений (пагинация)    |
| `/api/v1/notifications/unread-count`        | GET    | Количество непрочитанных          |
| `/api/v1/notifications/{id}/read`           | PATCH  | Отметить прочитанным              |
| `/api/v1/notifications/read-all`            | POST   | Отметить все прочитанными         |
| `/api/v1/notifications/preferences`         | GET    | Настройки уведомлений             |
| `/api/v1/notifications/preferences`         | PATCH  | Обновить настройки                |
| `/api/v1/notifications/inbox`               | GET    | Входящие (`status`, `limit`)      |
| `/api/v1/notifications/inbox/{id}/complete` | PATCH  | Отметить выполненным              |
| `/api/v1/notifications/inbox/{id}/snooze`   | PATCH  | Отложить (тело: `{ until }`)      |
| `/api/v1/devices/token`                     | POST   | Зарегистрировать/обновить token   |
| `/api/v1/devices/token`                     | DELETE | Удалить token (тело: `{ token }`) |

Эндпоинтов `/notifications/settings` **нет** — настройки живут под `/notifications/preferences`.

Полный OpenAPI: [api/README.md](../api/README.md).

---

## 4. Права доступа

| Действие                     | Роль  | Ограничение                                                            |
| ---------------------------- | ----- | ---------------------------------------------------------------------- |
| Просмотр уведомлений / inbox | Любая | Только свои (`userId` из JWT)                                          |
| Настройки                    | Любая | Свои записи `NotificationPreference` (user_id + university_id, unique) |
| Регистрация/удаление token   | Любая | Только свой token                                                      |

---

## 5. UX / экраны

- Центр уведомлений — [ui/screens-student.md](../ui/screens-student.md)
- Бейдж на иконке уведомлений (`GET /notifications/unread-count`)

**Критичные UX-требования:**

- Deep link: нажатие открывает нужный экран (`deepLink` у Notification и InboxItem)
- Группировка однотипных уведомлений (антиспам)
- Настройки по типам событий (`/notifications/preferences`)

---

## 6. Бизнес-правила и edge-cases

**Типы уведомлений (MVP):**

| Событие                 | Текст (пример)                                           | Получатель                              |
| ----------------------- | -------------------------------------------------------- | --------------------------------------- |
| Изменение расписания    | «Пара "Программирование" перенесена на 14:00»            | Студенты группы, преподаватель          |
| Новое объявление        | «Новое объявление в паре "Математика"»                   | Студенты группы                         |
| Новая подготовка к паре | «Подготовьте сообщение: применение нейросетей (к 10.09)» | Студенты группы                         |
| Дедлайн                 | «Завтра дедлайн: Лабораторная №3»                        | Студент                                 |
| Решение по отсутствию   | «Куратор подтвердил ваш статус "Болен"»                  | Студент                                 |
| Новое отсутствие        | «Иванов А. установил статус "Болен"»                     | Куратор                                 |
| Итог синхронизации      | «Синхронизация завершена» / «Ошибка синхронизации»       | developer, university_admin, superadmin |

**Антиспам:**

- `NotificationPreference.quietHours*` (тихие часы) реализованы в сущности и DTO
- Настройки по типам событий (`scheduleChanges`, `cancellations`, `roomChanges`, `homeworkCreated`, `deadlines`, `messages`, `announcements`, `systemAlerts`)

**Техническая реализация:**

```
Событие → EventBusService.publish (type из NAPARE_EVENT_TYPES, запись в EventRecord)
        → eventEmitter.emit('napare.event')
        → NotificationEventHandler.resolveRecipients
        → NotificationsService.processEvent → Notification (+ InboxItem)
```

`processEvent` маппит тип события в текст/категорию и применяет настройки пользователя; получатели: явный `recipients` события, иначе `groupId` → студенты группы + преподаватель, для `sync.*` → операторы вуза, иначе все активные пользователи вуза.

---

## 7. События и уведомления

Модуль **потребляет** события шины (`apps/backend/src/events/event.types.ts`, обработчик `notifications/events/notification-event.handler.ts`):

- schedule / academic: `lesson.changed`, `lesson.rescheduled`, `lesson.cancelled`, `room.changed`, `sync.completed`, `sync.failed`
- pair-space: `announcement.created`, `homework.created`, `homework.updated`, `message.created`
- absences: `absence.created`, `absence.updated`, `attendance.updated`
- отложенные: `homework.deadline_soon`, `grade.created` (маппинги есть, публикующие модули — TODO)

---

## 8. Нефункциональные требования

| Требование      | Значение                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------- |
| Доставка        | In-app создание записи + SSE-стрим событий (`GET /events/stream`, `EventBusService.stream`) |
| Push (FCM/APNs) | **Не реализовано**: push-SDK в бэкенде нет, `DeviceToken` только сохраняется                |
| Retry           | Не реализован (TODO)                                                                        |
| История         | Хранится без автоочистки (ретеншн не настроен)                                              |
| Часовые пояса   | Учёт через `quietHoursStart/End` (настройки пользователя)                                   |

---

## 9. Критерии приёмки

- [ ] При изменении расписания студент получает in-app уведомление
- [ ] При публикации ДЗ / объявления приходит уведомление
- [ ] Нажатие на уведомление открывает правильный экран (`deepLink`)
- [ ] Пользователь может отключить отдельные типы (`PATCH /notifications/preferences`)
- [ ] Куратор получает уведомление о новом отсутствии (`absence.created`)
- [ ] Нет массового спама (настройки + тихие часы)
- [ ] Push на iOS и Android — **не проверяемо, интеграции нет**

---

## 10. Зависимости

**Зависит от:** auth (JWT, device tokens), events (шина `napare.event`)
**Зависимость от:** — (только реагирует на события)

---

## 11. Open questions / TODO

- [ ] Интеграция с FCM/APNs (сейчас токены только хранятся)
- [ ] Email-уведомления (после MVP)
- [ ] SMS-уведомления (для критических событий)
- [ ] Web push (для web-клиента)
- [ ] Публикаторы для `homework.deadline_soon` и `grade.created`

---

## 12. Новое в коде (не описано ранее)

- Настройки — `/notifications/preferences` (не `/notifications/settings`).
- Новые эндпоинты: `GET /notifications/unread-count`, `GET /notifications/inbox`, `PATCH /notifications/inbox/:id/complete`, `PATCH /notifications/inbox/:id/snooze`, `DELETE /devices/token`.
- Новые сущности: `NotificationPreference`, `InboxItem` (помимо `Notification` и `DeviceToken`) — все в `apps/backend/src/database/database.module.ts`.
- Обработка событий — `NotificationEventHandler` на шине `napare.event` (`EventBusService`), плюс SSE-стрим (`GET /events/stream`) и сущность `EventRecord`.
- Изоляция тенанта: `universityId` в JWT + глобальный `apps/backend/src/common/tenant/tenant-context.module.ts`; уведомления фильтруются по `userId` + `universityId`.
- Слой разрешений `apps/backend/src/common/authorization/permissions.ts` (`@RequiresPermission`/`PermissionsGuard`) — применяется на `/academic`; здесь только `JwtAuthGuard`.
- Аудит: `apps/backend/src/common/entities/audit-log.entity.ts` + `GET /admin/audit-log` — к уведомлениям не применяется.
- `POST /auth/portal-login` (`workspace`) — вход определяет кабинет, из которого открывается центр уведомлений; `rasp.*`/`RaspModule` дают данные для событий расписания.
