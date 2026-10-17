# Module: Admin (Администрирование)

> API route list below is checked against `admin.controller.ts`. UX, latency and unchecked acceptance items are requirements/proposals, not proof of completed UI or operational performance.

## 1. Цель и границы

**Цель:** Управление структурой вуза, пользователями, настройками интеграций, расписанием и базовой статистикой.

**Не делает:** Бизнес-логику модулей (только управляет данными).

---

## 2. Сущности

Управляет данными других модулей:

| Сущность   | Действие                             |
| ---------- | ------------------------------------ |
| University | CRUD, настройка коннектора           |
| Faculty    | CRUD, назначение декана              |
| Group      | Структура групп; кураторство через отдельный модуль curation |
| User       | Назначение ролей, привязка к группам |
| Lesson     | Загрузка расписания                  |

---

## 3. API

| Endpoint                                    | Метод     | Описание                                                      |
| ------------------------------------------- | --------- | ------------------------------------------------------------- |
| `/api/v1/admin/university`                  | GET/PATCH | Управление вузом                                              |
| `/api/v1/admin/faculties`                   | GET/POST  | Факультеты                                                    |
| `/api/v1/admin/groups`                      | GET/POST  | Группы                                                        |
| `/api/v1/admin/users`                       | GET/POST  | Поиск и создание пользователей в своём ВУЗе                   |
| `/api/v1/admin/sibit/teachers`              | GET       | Преподаватели СИБИТ, их расписание и текущие привязки         |
| `/api/v1/admin/users/{id}/sibit-teacher`    | PATCH     | Привязка аккаунта к внешнему ID СИБИТ с синхронизацией занятий |
| `/api/v1/admin/users/{id}/roles`            | PATCH     | Назначение ролей                                              |
| `/api/v1/admin/users/{id}/status`           | PATCH     | Блокировка или разблокировка управляемого пользователя        |
| `/api/v1/admin/users/{id}/reset-password`   | POST      | Выдача нового временного пароля                               |
| `/api/v1/admin/schedule/upload`             | POST      | Загрузка расписания                                           |
| `/api/v1/admin/schedule/sync`               | POST      | Ручной синк                                                   |
| `/api/v1/admin/schedule/sync-status`        | GET       | Статус синка                                                  |
| `/api/v1/admin/connectors/moodle/configure` | POST      | Сохранить HTTPS URL и зашифрованный Moodle Web Services token |
| `/api/v1/admin/connectors/moodle/test`      | POST      | Проверить Moodle через `core_webservice_get_site_info`        |
| `/api/v1/admin/stats`                       | GET       | Базовая статистика                                            |
| `/api/v1/superadmin/universities`           | GET       | Все вузы                                                      |
| `/api/v1/superadmin/connectors`             | GET/PATCH | Управление коннекторами                                       |

Полный OpenAPI: [api/README.md](../api/README.md).

---

## 4. Права доступа

| Действие                                      | Роль             | Ограничение                              |
| --------------------------------------------- | ---------------- | ---------------------------------------- |
| Управление вузом                              | university_admin | Только свой вуз                          |
| Назначение ролей, статуса и временного пароля | university_admin | Только свой вуз и только роли ниже своей |
| Управление коннекторами                       | superadmin       | —                                        |
| Подключение вузов                             | superadmin       | —                                        |
| Базовая статистика                            | university_admin | Только свой вуз                          |

Матрица прав: [architecture/roles-and-permissions.md](../architecture/roles-and-permissions.md).

---

## 5. UX / экраны

- A01. Структура вуза — [ui/screens-admin.md](../ui/screens-admin.md)
- A02. Расписание — [ui/screens-admin.md](../ui/screens-admin.md)
- A03. Пользователи и роли — [ui/screens-admin.md](../ui/screens-admin.md)
- A04. Базовая статистика — [ui/screens-admin.md](../ui/screens-admin.md)
- SA01. Суперадмин — [ui/screens-admin.md](../ui/screens-admin.md)

**Критичные UX-требования:**

- Загрузка расписания с маппингом колонок
- Просмотр статуса синка
- Назначение ролей ≤ 3 кликов

---

## 6. Бизнес-правила и edge-cases

1. **Назначение ролей:** изменение основной роли проверяется по полномочиям оператора; назначение платформенных ролей и защита владельца дополнительно проверяются backend. Кураторство назначается существующему аккаунту через `/api/v1/curation`, а не сменой основной роли или `Group.curatorId`. См. [кураторство](../product/account-curatorship.md) и [управление платформой](../product/platform-control.md).
2. **Привязка преподавателя:** к конкретным парам / группам
3. **Загрузка расписания:** backend upload endpoint uses the current spreadsheet parser/import path. Do not assume iCal, user-defined column mapping or a preview step without checking the controller/UI implementation.
4. **Статистика:** количество активных студентов, % преподавателей с контентом, отсутствия
5. **Суперадмин:** подключение вузов, управление коннекторами, общая аналитика
6. **Moodle:** URL и Web Services token настраивает администратор ВУЗа. Token шифруется AES-256-GCM в `connectorConfig`, в API и UI возвращается только признак настройки. Moodle остаётся источником заданий, сдач и оценок; NaPare не дублирует их.

---

## 7. События и уведомления

| Событие             | Тип уведомления       | Получатель              |
| ------------------- | --------------------- | ----------------------- |
| Назначение роли     | No notification event is currently wired | — |
| Загрузка/синхронизация расписания | In-app/event stream notification where schedule change events are produced; no FCM/APNs push | Affected users |

---

## 8. Нефункциональные требования

| Требование          | Значение               |
| ------------------- | ---------------------- |
| Latency target             | p95 ≤ 500 мс; unmeasured here |
| Upload target | ≤ 10 сек для 10000 пар; not verified here |

---

## 9. Критерии приёмки

- [ ] Админ загружает расписание через файл
- [ ] Назначение ролей работает корректно
- [ ] Роли ограничивают доступ
- [ ] Базовая статистика отображается
- [ ] Суперадмин может подключить новый вуз

---

## 10. Зависимости

**Зависит от:** auth (JWT, roles)
**Зависимость от:** schedule (загрузка/синхронизация расписания), notifications (in-app schedule events; role-assignment notification is not implemented)

---

## 11. Open questions / TODO

- [ ] Аудит действий админа (логирование)
- [ ] Массовое создание пользователей (импорт)
- Роли `faculty_dean` и `department_head` есть в enum; поддержка каждого действия определяется отдельными routes/permissions, не предполагается только по существованию роли.
