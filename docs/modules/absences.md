# Module: Absences (Отсутствия)

## 1. Цель и границы

**Цель:** Учёт отсутствий студентов со статусами, подтверждением со стороны staff-ролей и ведомостью посещаемости (attendance).

**Не делает:** Расписание (schedule), уведомления (notifications).

---

## 2. Сущности

| Сущность             | Описание                                                                 | Ключевые поля                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Absence**          | Заявка на отсутствие (сущность называется `Absence`, не `AbsenceStatus`) | id, university_id, student_id, type, start_date, end_date, comment, is_sensitive, confirmation_required, affected_lesson_ids, affected_lessons_count, source, last_synced_at, source_version, sync_status |
| AbsenceConfirmation  | Подтверждение куратора                                                   | id, absence_id, curator_id, status (`pending`/`confirmed`/`rejected`), comment, confirmed_at                                                                                                              |
| **AttendanceRecord** | Ведомость посещаемости пары                                              | id, university_id, lesson_id, student_id, status (`present`/`absent`/`late`), comment, marked_by_id (unique по паре «урок + студент»)                                                                     |

Типы отсутствия: `learning` (учусь), `sick` (болен), `work` (работа), `other_city` (другой город), `other` (другая причина).

Подробнее: [architecture/data-model.md](../architecture/data-model.md).

---

## 3. API

| Endpoint                                        | Метод  | Описание                                                                   |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `/api/v1/absences`                              | POST   | Создать статус отсутствия (student; опционально `lessonId`)                |
| `/api/v1/absences/my`                           | GET    | Мои статусы (пагинация)                                                    |
| `/api/v1/absences/student/{studentId}`          | GET    | Пропуски студента (staff-роли)                                             |
| `/api/v1/absences/lesson/{lessonId}`            | GET    | Пропуски на уроке (staff-роли)                                             |
| `/api/v1/absences/pending`                      | GET    | Ожидают подтверждения в текущем вузе (staff-роли)                          |
| `/api/v1/absences/stats/{studentId}`            | GET    | Статистика пропусков (staff-роли)                                          |
| `/api/v1/absences/attendance/lesson/{lessonId}` | GET    | Отметки посещаемости занятия (staff-роли)                                  |
| `/api/v1/absences/attendance`                   | POST   | Сохранить посещаемость (staff-роли; тело: `lessonId` + `entries[]` до 500) |
| `/api/v1/absences/attendance/qr-sessions`       | POST   | Создать/обновить короткую QR-сессию занятия (staff-роли; тело: `lessonId`) |
| `/api/v1/absences/attendance/qr-check-in`        | POST   | Отметить своё присутствие по токену QR (student)                            |

| `/api/v1/absences/{id}`                         | PATCH  | Обновить пропуск (student)                                                 |
| `/api/v1/absences/{id}`                         | DELETE | Удалить пропуск (student)                                                  |
| `/api/v1/absences/{id}/confirm`                 | POST   | Подтвердить пропуск (staff-роли)                                           |
| `/api/v1/absences/{id}/excuse`                  | POST   | Освободить от пропуска (staff-роли, тело: `reason`)                        |
| `/api/v1/curator/absences`                      | GET    | Дашборд куратора (фильтр `status=pending`)                                 |
| `/api/v1/curator/absences/{id}/confirm`         | PATCH  | Подтвердить (с комментарием)                                               |
| `/api/v1/curator/absences/{id}/reject`          | PATCH  | Отклонить (с причиной)                                                     |

Staff-роли (`ABSENCE_STAFF_ROLES`, `apps/backend/src/absences/absences.service.ts:21`): `teacher`, `curator`, `department_head`, `faculty_dean`, `university_admin`, `superadmin`.

QR-сессия действует 90 секунд, создаётся только для занятия в текущем ВУЗе и доступна преподавателю только для его пары. В базе сохраняется SHA-256 хэш токена, а не сам токен. Обновление QR отзывает предыдущие активные коды этого занятия. При check-in сервер сверяет tenant и группу студента, создаёт обычную запись посещаемости с уникальностью по паре/студенту и делает повторный check-in идемпотентным для уже присутствующего, в том числе при одновременном сканировании с двух устройств. Время создания ограничено интервалом от 15 минут до пары до 15 минут после её окончания. Короткий TTL и отзыв ограничивают пересылку кода, но не доказывают физическое присутствие, если студент передаст действующий QR одногруппнику.

Студент должен войти в NaPare в том же клиенте, которым отмечается. В веб-браузере QR можно открыть камерой устройства; внутри MAX студент может открыть страницу `/student/attendance/check-in` и отсканировать QR через `window.WebApp.openCodeReader(false)`. Приложение принимает только URL текущего origin и страницы check-in, извлекает токен из URL-фрагмента и отправляет его только в авторизованный check-in endpoint. Токен не уходит на другой домен.

Полный OpenAPI: [api/README.md](../api/README.md).

Студенческая история загружает контекст связанных занятий, а staff-экран календаря — список занятий выбранного дня. Оба экрана запрашивают полный timestamp-диапазон дня, чтобы не потерять пары позднее полуночи. Staff-экран строит дату по локальному часовому поясу браузера.

---

## 4. Права доступа

| Действие                                                | Роль                                                                          | Ограничение                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Создать/изменить/удалить статус                         | student                                                                       | Только свой                                                      |
| Просмотр своих                                          | student                                                                       | Только свои                                                      |
| Дашборд `/curator/absences`                             | curator, department_head, faculty_dean, university_admin, superadmin          | Пропуски всего вуза (`findByUniversity`), не только своей группы |
| Подтверждение/отклонение (curator- и absences-маршруты) | teacher, curator, department_head, faculty_dean, university_admin, superadmin | По умолчанию — весь вуз                                          |
| Посещаемость (attendance)                               | те же staff-роли                                                              | `POST /absences/attendance`                                      |

Матрица прав: [architecture/roles-and-permissions.md](../architecture/roles-and-permissions.md).

---

## 5. UX / экраны

- Виджет отсутствия на «Мой день» — [ui/screens-student.md](../ui/screens-student.md)
- C01. Дашборд отсутствий — [ui/screens-curator.md](../ui/screens-curator.md)

**Критичные UX-требования:**

- Студент ставит статус ≤ 30 секунд
- Система показывает «Будет затронуто N пар»
- Куратор видит понятную таблицу с фильтрами

---

## 6. Бизнес-правила и edge-cases

1. **Затронутые пары:** `affected_lesson_ids` / `affected_lessons_count` заполняются только если студент указал `lessonId` (тогда это одна пара). Полного автоматического расчёта всех пересекающихся пар по периоду в коде нет.
2. **Подтверждение:** статус создаётся с `confirmationRequired=true` (если требуется), staff подтверждает (`confirm`) или освобождает/отклоняет (`excuse`/`reject`) — после этого `confirmationRequired=false`; в `AbsenceConfirmation` пишется строка со статусом.
3. **Чувствительные данные:** поле `is_sensitive` есть, но отдельной фильтрации по нему в сервисе нет; причины хранятся обычным текстом (шард-шифрования нет).
4. **Изменение/отмена:** студент может изменить (`PATCH`) или удалить (`DELETE`) свой статус.
5. **Посещаемость:** `POST /absences/attendance` сохраняет до 500 записей `present`/`absent`/`late` по паре; уникальность — «урок + студент»; событие `attendance.updated`.
6. **История:** записи `Absence` сохраняются; статистика — `GET /absences/stats/:studentId`. Преподаватель получает историю и статистику только студентов групп, для которых у него есть хотя бы одно занятие; остальные staff-роли работают в пределах своего ВУЗа.
7. **Изоляция вуза:** все выборки ограничены `universityId`, проверки — через `TenantContext.assertAccess`.
8. **Внешнее расписание:** строка из live-расписания `rasp.sano.ru` ещё не является сохранённым уроком. MAX отправляет по ней заявку на день без `lessonId`, чтобы заявка не падала и не создавала ложную связь с парой. После серверной синхронизации расписания урок получает UUID: даже если JWT студента ещё содержит числовой внешний ID группы, сервис резолвит его через `Group.externalId` и сохраняет корректную связь с конкретной парой.

---

## 7. События и уведомления

| Событие                                      | Тип уведомления             | Получатель                  |
| -------------------------------------------- | --------------------------- | --------------------------- |
| `absence.created`                            | In-app (`new_absence`)      | Куратор/staff вуза          |
| `absence.updated` (подтверждение/отклонение) | In-app (`absence_decision`) | Студент                     |
| `attendance.updated`                         | In-app (`other`)            | По типу получателей события |

---

## 8. Нефункциональные требования

| Требование  | Значение                                                              |
| ----------- | --------------------------------------------------------------------- |
| Latency     | p95 ≤ 300 мс                                                          |
| Offline     | Кэш последнего статуса                                                |
| Приватность | Причины — обычный текст в БД; `is_sensitive` без отдельной фильтрации |

---

## 9. Критерии приёмки

- [ ] Студент создаёт статус на период; при указанной паре заполняется `affected_*`
- [ ] Staff-роли видят таблицу и подтверждают/отклоняют
- [ ] Посещаемость сохраняется и читается (`GET /absences/attendance/lesson/:id`)
- [ ] Уведомления уходят нужным ролям (`absence.created` / `absence.updated`)
- [ ] Данные не светятся чужому вузу (tenant check)
- [ ] Редактирование и отмена статуса работают

---

## 10. Зависимости

**Зависит от:** auth (JWT, roles), schedule (уроки для attendance и `lessonId`)
**Зависимость от:** notifications (события `absence.*`, `attendance.*`)

---

## 11. Open questions / TODO

- [ ] Массовое подтверждение отсутствий (для куратора)
- [ ] Автоматический расчёт всех пар, попадающих в период отсутствия
- [ ] Фильтрация/шифрование чувствительных причин
- [ ] Экспорт данных об отсутствиях для деканата
- [ ] Интеграция с медицинскими справками (после MVP)

---

## 12. Новое в коде (не описано ранее)

- Сущность — `Absence` (`apps/backend/src/absences/entities/absence.entity.ts`), не `AbsenceStatus`.
- Новые маршруты: `GET /absences/student/:studentId`, `GET /absences/lesson/:lessonId`, `GET /absences/pending`, `GET /absences/attendance/lesson/:lessonId`, `POST /absences/attendance`, `GET /absences/stats/:studentId`, `POST /absences/:id/confirm`, `POST /absences/:id/excuse`.
- Для `GET /absences/student/:studentId` и `GET /absences/stats/:studentId` сервис дополнительно сверяет преподавателю группу студента с его занятиями; tenant-проверки недостаточно для просмотра чужой учебной группы.
- Новая сущность `AttendanceRecord` (`apps/backend/src/absences/entities/attendance-record.entity.ts`).
- Роли curator-маршрутов: `curator, department_head, faculty_dean, university_admin, superadmin` (`curator.controller.ts:31`), не только куратор.
- Изоляция тенанта: `TenantContext.assertAccess` + `universityId` в JWT (глобальный `apps/backend/src/common/tenant/tenant-context.module.ts`).
- Слой разрешений `apps/backend/src/common/authorization/permissions.ts` (`@RequiresPermission`/`PermissionsGuard`) — на `/academic`; здесь — `@Roles` + `RolesGuard`.
- Аудит: `apps/backend/src/common/entities/audit-log.entity.ts`, просмотр — `GET /admin/audit-log`; `POST /auth/portal-login` (`workspace`) и `rasp.*`/`RaspModule` к модулю применяются косвенно (source-данные отсутствий приходят извне: поля `source`, `lastSyncedAt`, `syncStatus`).
