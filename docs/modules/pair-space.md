# Module: Pair Space (Пространство пары)

> API and persisted fields below follow the current backend where source-linked. Timings, NFRs, acceptance checklist and target UX are not measured or evidence of full completion.

## 1. Цель и границы

**Цель:** Ключевой дифференциатор продукта — у каждого занятия своя страница с объявлениями, материалами, обсуждением и ориентиром «что подготовить к паре». Сдача работ, проверка и оценки остаются в Moodle.

**Не делает:** Управление расписанием (schedule), статусы отсутствий (absences), загрузку файлов на хранилище (принимает готовые ссылки).

---

## 2. Сущности

| Сущность           | Описание                                   | Ключевые поля                                                                                                                             |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PairSpace          | Пространство пары                          | id, university_id, lesson_id (unique), subject, date, pair_number, teacher_name, group, room, is_active, active_until, source/sync_status |
| Announcement       | Объявление                                 | id, pair_space_id, author_id, text, is_pinned, source/sync_status                                                                         |
| Homework           | Подготовка к паре (техническое legacy-имя) | id, pair_space_id, author_id, title, description, deadline, is_recurring, recurring_rule, is_completed                                    |
| HomeworkSubmission | Legacy-статус сдачи                        | id, homework_id, student_id, status (`not_submitted`/`submitted`), submitted_at, file_url, comment; в актуальном UX не используется       |
| FileAttachment     | Файл                                       | id, pair_space_id, uploaded_by, file_url, file_name, file_type (enum pdf/doc/docx/ppt/pptx/jpg/png), size                                 |
| DiscussionMessage  | Сообщение обсуждения                       | id, pair_space_id, user_id, text, parent_id, moderation_state (`visible`/`hidden`), moderation_reason, moderated_by, moderated_at             |
| PersonalLessonNote | Личная заметка к занятию                   | id, university_id, pair_space_id, user_id, content; уникальна для пользователя и занятия                                                    |
| HomeworkProgress  | Личный статус и чек-лист студента           | id, homework_id, student_id, state, subtasks (JSONB, до 20 шагов); уникален для студента и подготовки; не отражает сдачу в Moodle       |

Подробнее: [architecture/data-model.md](../architecture/data-model.md).

---

## 3. API

| Endpoint                                       | Метод | Описание                                                                                                      |
| ---------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `/api/v1/pair-spaces/groups/{groupId}`          | GET   | Только уже существующие пространства группы, summary-поля и пагинация; university admin/superadmin; чтение не создаёт PairSpace |
| `/api/v1/pair-spaces/{lessonId}`               | GET   | Пространство пары; если его ещё нет, безопасно создаётся из доступного пользователю занятия                   |
| `/api/v1/pair-spaces/{lessonId}/timeline`      | GET   | Первая страница (20 записей) недавних занятий того же предмета в tenant- и role-scoped контексте с подготовкой, объявлениями и файлами |
| `/api/v1/pair-spaces/{lessonId}/announcements` | POST  | Создать объявление                                                                                            |
| `/api/v1/pair-spaces/{lessonId}/homeworks`     | POST  | Опубликовать подготовку к паре (legacy-путь контракта)                                                        |
| `/api/v1/pair-spaces/{lessonId}/files`         | POST  | Добавить файл (JSON: `{ fileUrl, fileName, fileType, size }`)                                                 |
| `/api/v1/pair-spaces/homeworks/{id}/submit`    | PATCH | Legacy-путь отметки сдачи; не используется актуальными кабинетами, потому что сдачи и оценки ведутся в Moodle |
| `/api/v1/pair-spaces/homeworks/{id}/progress`  | PATCH | Изменить личный статус подготовки (`todo`, `in_progress`, `done`); доступен студенту своей группы и не меняет статус сдачи в Moodle |
| `/api/v1/pair-spaces/{lessonId}/messages`      | GET   | Сообщения обсуждения (пагинация `page`/`limit`)                                                               |
| `/api/v1/pair-spaces/{lessonId}/messages`      | POST  | Написать сообщение                                                                                            |
| `/api/v1/pair-spaces/{lessonId}/personal-note` | GET   | Получить личную заметку текущего пользователя                                                                  |
| `/api/v1/pair-spaces/{lessonId}/personal-note` | PUT   | Создать/обновить личную заметку; пустое содержимое удаляет заметку                                             |

Multipart/FileInterceptor **нет**: `POST .../files` принимает обычный JSON по `CreateFileDto` (`apps/backend/src/pair-space/dto/create-file.dto.ts`) — клиент загружает файл самостоятельно и присылает `fileUrl`, `fileName`, `fileType`, `size`.

Групповой список проверяет принадлежность группы и её занятий к `universityId` текущего JWT, возвращает только существующие записи и не вызывает create-on-read `GET /pair-spaces/{lessonId}`. Ответ ограничен сводочными полями без содержимого объявлений, файлов и обсуждений.

Полный OpenAPI: [api/README.md](../api/README.md).

---

## 4. Права доступа

| Действие               | Роль                                                                          | Ограничение                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Просмотр               | student (только своя группа), teacher (только свои пары), остальные роли вуза | Проверка в `PairSpaceService.assertRoleScopedAccess`                                         |
| Публикация объявления  | teacher, curator, department_head, faculty_dean, university_admin, superadmin | `@Roles` на маршруте; для teacher — только своя пара                                         |
| Публикация подготовки  | те же роли                                                                    | Только тема, описание и дата конкретной пары; без сдачи и оценки                             |
| Добавление файла       | те же роли                                                                    | —                                                                                            |
| Legacy-отметка «сдано» | student                                                                       | Сохраняется для обратной совместимости API, но не является пользовательским сценарием NaPare |
| Сообщения в обсуждении | Любая роль                                                                    | Студент — только своя группа; teacher — только своя пара; пагинация                          |
| Личная заметка         | Любая роль с доступом к занятию                                               | Читается и записывается только для текущего пользователя; максимум 20 000 символов          |

Матрица прав: [architecture/roles-and-permissions.md](../architecture/roles-and-permissions.md).

---

## 5. UX / экраны

- Просмотр пространства пары (student) — [ui/screens-student.md](../ui/screens-student.md)
- T02. Пространство пары (teacher) — [ui/screens-teacher.md](../ui/screens-teacher.md)
- T03. Быстрая публикация — ≤ 40 секунд

**Критичные UX-требования:**

- Публикация контента ≤ 30–40 секунд
- Вкладки: Обзор | Материалы | Подготовка | Обсуждение
- История предмета связывает доступные занятия с опубликованной подготовкой, объявлениями и материалами.

---

## 6. Бизнес-правила и edge-cases

1. **Время жизни:** поле `PairSpace.activeUntil` есть в сущности, но бэкенд его не заполняет — фактическое окно жизни задаётся данными, а не расчётом «+30–60 дней».
2. **Создание PairSpace:** `getOrCreateByLesson` создаёт пространство при первом обращении к существующему занятию. Перед созданием сервер сверяет тенант и роль: студент — свою группу, преподаватель — только собственную пару. Если в ещё действующем JWT студента хранится числовой внешний ID СИБИТа, сервис резолвит его через `Group.externalId` к локальной группе. Уникальность `lessonId` защищает от дублей при параллельных запросах.
3. **Moodle — источник истины для работ:** NaPare не моделирует сдачу, прогресс или оценивание. Старый путь `submit` и его поля остаются в API только для обратной совместимости и не выводятся в кабинетах.
4. **Переход в Moodle:** когда в кабинете ВУЗа активирован Moodle-коннектор, staff-экран показывает только безопасную HTTPS-ссылку на Moodle. Его сервисный токен не попадает в ответ Pair Space и не доступен браузеру.
5. **Файлы:** тип огранич enum'ом DTO (`pdf, doc, docx, ppt, pptx, jpg, png`); размер (`size`) — просто число, не валидируется; multipart-загрузки и ограничения «≤ 50 МБ» в коде нет.
6. **Обсуждение:** тред, привязанный к паре (`parentId`); сообщения пагинируются.
7. **Закрепление:** `isPinned` объявления; сортировка — pinned first, затем по дате.
8. **Rate limiting:** the global `ThrottlerGuard` applies to backend requests; this module does not define a separate Pair Space-specific quota such as 10 messages/minute.
9. **События:** публикации уходят на шину `EventBusService` с типами `announcement.created`, `homework.created`, `homework.updated`, `message.created`.
10. **Глобальная модерация:** отдельный platform-раздел может исправить, скрыть или восстановить сообщение по отдельному разрешению. Скрытие обратимо, сохраняет оригинальный текст, а обычные Pair Space ответы показывают только сообщения со статусом `visible`.

---

## 7. События и уведомления

| Событие                                 | Тип уведомления                                         | Получатель                      |
| --------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| `announcement.created`                  | In-app notification/event stream; no FCM/APNs push | Студенты группы + преподаватель |
| `homework.created` / `homework.updated` | In-app notification/event stream; no FCM/APNs push | Студенты группы + преподаватель |
| `message.created`                       | In-app (`other`)                                        | Студенты группы + преподаватель |

---

## 8. Нефункциональные требования

| Требование  | Значение                                     |
| ----------- | -------------------------------------------- |
| Latency     | p95 ≤ 300 мс                                 |
| Offline     | Аккаунтный кэш посещённых Pair Space (занятие, материалы, подготовка, обсуждение, история изменений); только чтение офлайн, действия требуют сети. Subject timeline загружается с сервера и пока требует соединения |
| Rate limits | Global backend `ThrottlerGuard`; no module-specific quota. |

---

## 9. Критерии приёмки

- [x] Преподаватель (и другие staff-роли) создают объявление / подготовку к паре / файл за минимальное число шагов
- [x] Доступ к существующему занятию возвращает рабочее пространство, создавая его при первом обращении в рамках роли и тенанта
- [x] История предмета показывает последние занятия и опубликованный контент в tenant- и role-scoped контексте
- [ ] Обсуждение привязано только к этой паре, сообщения пагинируются
- [x] Актуальные кабинеты не предлагают сдачу, прогресс или оценивание; эти процессы остаются в Moodle
- [ ] Файлы отдаются по готовым `fileUrl` (multipart-загрузки нет)

---

## 10. Зависимости

**Зависит от:** auth (JWT, roles), schedule (Lesson → PairSpace, связь по `lessonId`)
**Зависимость от:** notifications (события публикации контента)

---

## 11. Open questions / TODO

- [ ] Интеграция Moodle Web Services (после получения URL и сервисного токена ВУЗа)
- [ ] Фоновое создание PairSpace при импорте расписания (сейчас используется безопасное создание при первом обращении)
- [ ] Повторяющиеся ДЗ: поля `isRecurring`/`recurringRule` есть в entity, но DTO их не принимает
- [ ] Загрузка файлов на хранилище (сейчас клиент присылает готовый `fileUrl`)

---

## 12. Новое в коде (не описано ранее)

- `homeworks` в контракте — legacy-техническое имя подготовки к паре. Новый UX использует только тему, контекст и дату; сдачи и оценки ведутся в Moodle.
- Единый студенческий список сроков собирает Pair Space подготовку только для lesson ID из role-scoped расписания ближайших 30 дней; записи вне tenant или доступных уроков не читаются.
- `GET /pair-spaces/:lessonId` и публикации в пространство используют `getOrCreateByLesson`: пустое пространство создаётся из данных `Lesson` после проверки доступа, а не вручную или из клиентских данных.
- `GET /pair-spaces/:lessonId/timeline` выбирает последние 20 занятий того же курса (или предмета внутри разрешённой группы/преподавателя), фильтрует университет и возвращает только объявления, подготовку и файлы; отсутствующее PairSpace для занятия возвращается как `null`.
- Роли на create-маршрутах: `teacher, curator, department_head, faculty_dean, university_admin, superadmin` (`pair-space.controller.ts`), не только teacher.
- Личная заметка привязана к пользователю и Pair Space; сервер повторно проверяет доступ к уроку и tenant перед чтением/сохранением. Уникальность `(pairSpaceId, userId)` обеспечивает безопасное upsert; UI держит локальную копию для офлайна.
- Файлы — JSON-объект `{ fileUrl, fileName, fileType, size }` (`create-file.dto.ts`), multipart нет.
- `POST /auth/portal-login` (`workspace`) определяет, какой кабинет открывает просмотр пространства.
- Изоляция тенанта: `TenantContext.assertAccess(universityId)` внутри `PairSpaceService`; `universityId` — из JWT (глобальный `apps/backend/src/common/tenant/tenant-context.module.ts`).
- Слой разрешений `apps/backend/src/common/authorization/permissions.ts` (`@RequiresPermission`/`PermissionsGuard`) на `/academic` маршрутах; в этом модуле используются `@Roles` + `RolesGuard`.
- Аудит: `apps/backend/src/common/entities/audit-log.entity.ts` + `GET /admin/audit-log` — публикации контента в журнал не пишутся.

### Личный прогресс подготовки

`PATCH /pair-spaces/homeworks/:id/progress` сохраняет личный статус текущего студента (`todo`, `in_progress`, `done`) и/или список из максимум 20 личных шагов (UUID, название до 160 символов, признак готовности). Сервер проверяет tenant и группу урока. Статус и чек-лист не меняют `Homework.isCompleted` и `HomeworkSubmission`, не отправляют файлы и не считаются сдачей в Moodle. Офлайн-изменения в клиенте изолированы по аккаунту и синхронизируются при восстановлении сети.
