# API Contracts — Full Specification

Полная спецификация всех API-эндпоинтов с валидацией, статус-кодами и rate limits.

**Base URL:** `/api/v1`

**Формат ошибок:** см. [api/README.md](README.md)

---

## 1. Auth (Регистрация и авторизация)

### 1.1 POST `/auth/request-code`

Запрос SMS/email кода для входа.

**Rate Limit:** 1 запрос в 60 секунд на номер/email.

**Request:**

```json
{
  "phone": "+79991234567", // Опционально
  "email": "user@example.com" // Опционально (одно из двух обязательно)
}
```

**Validation:**

- `phone`: regex `^\+7\d{10}$` (если передан)
- `email`: валидный email (если передан)
- Одно из двух обязательно

**Response 200:**

```json
{
  "data": {
    "expiresIn": 300,
    "maskedContact": "+7***1234567"
  }
}
```

**Errors:**
| Код | Описание |
|-----|----------|
| `VALIDATION_ERROR` | Неверный формат телефона/email |
| `RATE_LIMIT_EXCEEDED` | Слишком частые запросы |
| `INTERNAL_ERROR` | Ошибка отправки SMS/email |

---

### 1.2 POST `/auth/verify-code`

Проверка кода, выдача JWT.

**Rate Limit:** 5 попыток в минуту на номер/email.

**Request:**

```json
{
  "phone": "+79991234567",
  "code": "1234"
}
```

**Validation:**

- `phone`: regex `^\+7\d{10}$`
- `code`: string, length 4-6

**Response 200 (существующий пользователь):**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "firstName": "Иван",
      "lastName": "Иванов",
      "roles": ["student"],
      "universityId": "uuid",
      "groupId": "uuid"
    },
    "isNewUser": false
  }
}
```

**Response 200 (новый пользователь):**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": null,
    "isNewUser": true
  }
}
```

**Errors:**
| Код | Описание |
|-----|----------|
| `INVALID_CODE` | Неверный код |
| `CODE_EXPIRED` | Код истёк |
| `RATE_LIMIT_EXCEEDED` | Превышено число попыток |

---

### 1.3 POST `/auth/login`

Вход по email/паролю (для преподавателей).

**Rate Limit:** 5 попыток в минуту на email.

**Request:**

```json
{
  "email": "teacher@university.ru",
  "password": "securePassword123"
}
```

**Validation:**

- `email`: валидный email
- `password`: string, min 8

**Response 200:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "firstName": "Петр",
      "lastName": "Петров",
      "roles": ["teacher", "curator"],
      "universityId": "uuid"
    }
  }
}
```

**Errors:**
| Код | Описание |
|-----|----------|
| `INVALID_CREDENTIALS` | Неверный email или пароль |
| `ACCOUNT_LOCKED` | Аккаунт заблокирован |

---

### 1.4 POST `/auth/refresh`

Обновление access token.

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**
| Код | Описание |
|-----|----------|
| `UNAUTHORIZED` | Невалидный refresh token |
| `TOKEN_EXPIRED` | Refresh token истёк |

---

### 1.5 POST `/auth/logout`

Выход (инвалидация refresh token).

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": { "success": true }
}
```

---

### 1.6 GET `/users/me`

Текущий пользователь.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "phone": "+79991234567",
    "email": null,
    "firstName": "Иван",
    "lastName": "Иванов",
    "avatarUrl": "https://...",
    "roles": ["student"],
    "universityId": "uuid",
    "universityName": "СИБИТ",
    "groupId": "uuid",
    "groupName": "ПМИ-201",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 1.6.1 GET `/users/me/favorites`

Получить избранные группы и преподавателей. Доступно только авторизованному студенту; записи ограничены его пользователем и университетом.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:** массив объектов `{ id, kind, externalId, label, createdAt, updatedAt }`, где `kind` — `group` или `teacher`.

### 1.6.2 POST `/users/me/favorites`

Создать или обновить избранный объект (идемпотентно по типу и внешнему идентификатору).

**Request:** `{ "kind": "group", "externalId": "123", "label": "ПМИ-201" }` или `kind: "teacher"`.

`group.externalId` должен быть числовым ID открытого каталога расписаний; teacher ID нормализуется без учёта регистра. `label` ограничен 220 символами.

**Response 201:** `{ "success": true }`.

### 1.6.3 DELETE `/users/me/favorites`

Удалить избранный объект текущего студента.

**Request:** `{ "kind": "teacher", "externalId": "Иванов И.И." }`.

**Response 200:** `{ "success": true }`.

### 1.7 PATCH `/users/me`

Обновление профиля.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**

```json
{
  "firstName": "Иван",
  "lastName": "Иванов",
  "avatarUrl": "https://..."
}
```

**Validation:**

- `firstName`: string, min 1, max 100 (опционально)
- `lastName`: string, min 1, max 100 (опционально)
- `avatarUrl`: string URL (опционально)

**Response 200:** Обновлённый пользователь.

---

### 1.8 POST `/users/me/bind-group`

Привязка к группе.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**

```json
{
  "universityId": "uuid",
  "facultyId": "uuid",
  "course": 2,
  "groupId": "uuid"
}
```

**Response 200:**

```json
{
  "data": {
    "success": true,
    "group": {
      "id": "uuid",
      "name": "ПМИ-201"
    }
  }
}
```

---

### 1.9 DELETE `/users/me`

Удаление аккаунта (soft-delete).

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": {
    "message": "Аккаунт будет удалён через 30 дней",
    "restoreDeadline": "2024-02-15T10:00:00Z"
  }
}
```

---

### 1.10 POST `/auth/max`

Вход на существующий сайт NaPare из MAX WebApp. Сервер валидирует подпись `window.WebApp.initData` токеном `MAX_BOT_TOKEN` и выдаёт JWT НаПаре. При первом входе вместе с `email`/`password` аккаунт университета привязывается к MAX-идентификатору (`users.maxUserId`) — дальше вход в MAX автоматический.

**Request:**

```json
{
  "initData": "auth_date=1758700000&user=%7B%22id%22%3A424242%7D&hash=…",
  "email": "student@university.ru",
  "password": "securePassword123"
}
```

**Validation:**

- `initData`: string, 1–8192 (обязательно)
- `email`, `password`: опционально, только вместе (первичная привязка); `password` min 6

**Подпись:** HMAC-SHA256 по алгоритму MAX (секрет `WebAppData` + `MAX_BOT_TOKEN`), сравнение timing-safe; `auth_date` не старше `MAX_INIT_DATA_TTL_SECONDS` (по умолчанию 900 секунд / 15 минут) и не «из будущего».

**Rate Limit:** 10 запросов за 60 секунд на IP (дополнительно к общему лимиту API). Существующую привязку MAX нельзя заменить этим endpoint; уже занятый MAX ID возвращает `409 CONFLICT`.

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "student@university.ru",
    "firstName": "Иван",
    "lastName": "Иванов",
    "role": "student"
  }
}
```

**Errors:**
| Код | Статус | Описание |
|-----|--------|----------|
| `MAX_INVALID_INIT_DATA` | 401 | Подпись неверна или `auth_date` устарел |
| `MAX_ACCOUNT_NOT_LINKED` | 401 | Аккаунт не привязан — передайте email/password |
| `MAX_INVALID_CREDENTIALS` | 401 | Email или пароль не подходят; одинаковый ответ для неизвестного, неверного и неактивного аккаунта |
| `CONFLICT` | 409 | MAX-идентификатор уже привязан к другому аккаунту |
| `MAX_NOT_CONFIGURED` | 503 | Не задан `MAX_BOT_TOKEN` |
| `VALIDATION_ERROR` | 400 | Некорректное тело запроса |

### 1.10.1 POST `/auth/max/link`

Требует `Authorization: Bearer <accessToken>` действующей сессии. Принимает только `{ "initData": "..." }`, повторно проверяет подпись и свежесть данных MAX и атомарно связывает MAX-идентификатор с текущим пользователем. Возвращает стандартный ответ авторизации. MAX, уже привязанный к другому пользователю, отклоняется с `409`; существующая связь аккаунта с другим MAX также не заменяется.

**Rate Limit:** 10 запросов за 60 секунд на IP. Ошибки валидации и конфликт привязки соответствуют `POST /auth/max`.

### 1.10.2 GET `/auth/telegram/status`

Требует JWT; возвращает `{ "linked": true | false, "notificationsConfigured": true | false }` для текущего пользователя, не раскрывая Telegram user ID или секреты.

### 1.10.3 POST `/auth/telegram/link`

Требует действующий JWT. Создаёт ссылку `https://t.me/<bot>?start=<code>` для привязки текущего аккаунта к Telegram. Код содержит 192 бита случайности, в базе хранится его SHA-256; срок действия — 10 минут. Новая ссылка аннулирует предыдущую активную ссылку этого аккаунта. Если к аккаунту уже привязан Telegram, ответ `409 CONFLICT`; если интеграция не настроена, `503 TELEGRAM_NOT_CONFIGURED`. Rate limit — 3 запроса за 60 секунд.

**Response 200:** `{ "botLink": "https://t.me/napare_bot?start=…", "expiresAt": "2026-09-28T12:34:56.000Z" }`.

### 1.10.4 POST `/integrations/telegram/webhook`

Принимает Telegram Bot API update. Доступ разрешён только с совпадающим `X-Telegram-Bot-Api-Secret-Token`; обрабатывается только приватное сообщение `/start <code>` (или `/link <code>`). Код и Telegram user ID связываются атомарно, Telegram ID уникален. Бот не принимает пароль пользователя. Неверные/истёкшие/уже погашенные коды не создают привязку.

---

## 2. Schedule (Расписание)

### 2.1 GET `/schedule/my`

Персональное расписание текущего пользователя.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `startDate` | string (ISO) | Сегодня | Начало периода |
| `endDate` | string (ISO) | Сегодня + 7 дней | Конец периода |
| `page` | number | 1 | Номер страницы |
| `limit` | number | 50 | Элементов на странице |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "subject": "Программирование",
      "teacher": "Петров П.П.",
      "room": "301",
      "building": "Корпус А",
      "dayOfWeek": 1,
      "date": "2024-01-15",
      "startTime": "09:00",
      "endTime": "10:30",
      "pairNumber": 1,
      "weekType": "odd",
      "hasChanges": true,
      "changeType": "room_changed",
      "pairSpaceId": "uuid",
      "announcementCount": 2,
      "homeworkCount": 1,
      "deadlineSoon": false
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "totalPages": 1
  }
}
```

---

### 2.2 GET `/my-day`

Агрегированные данные для экрана «Мой день» (`apps/backend/src/my-day/my-day.service.ts`). Ответ — JSON-объект без оболочки `data`.

**Headers:** `Authorization: Bearer <accessToken>`

**Query:** `timeZone` — необязательная IANA timezone клиента (например, `Asia/Omsk`); при отсутствии используется UTC. Невалидная timezone возвращает 400.

**Response 200:**

```json
{
  "date": "2026-09-28",
  "lessons": [
    {
      "id": "lesson-uuid",
      "subject": "Программирование",
      "startTime": "2026-09-28T07:00:00.000Z",
      "endTime": "2026-09-28T08:30:00.000Z",
      "isChanged": false
    }
  ],
  "pairSpaces": [],
  "upcomingPreparations": [
    {
      "id": "preparation-uuid",
      "title": "Повторить тему",
      "description": null,
      "deadline": "2026-09-30T12:00:00.000Z",
      "lessonId": "lesson-uuid",
      "subject": "Программирование",
      "progress": "todo",
      "subtasks": []
    }
  ],
  "absences": [],
  "notifications": { "unreadCount": 2 },
  "summary": { "totalLessons": 1, "changedLessons": 0, "totalAbsences": 0 }
}
```

`upcomingPreparations` содержит опубликованную подготовку и личный статус студента в пределах следующих 30 дней, связанную с его role-scoped расписанием и отсортированную по сроку; элементы без срока идут последними. `progress` принимает `todo`, `in_progress` или `done`; `subtasks` содержит личные шаги студента. Для остальных ролей массив пуст. Это личный план, не сдача: отправка и оценивание остаются в Moodle.

---

### 2.3 GET `/schedule/lessons/:id`

Детали пары.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "subject": "Программирование",
    "teacher": {
      "id": "uuid",
      "name": "Петров П.П.",
      "email": "petrov@university.ru"
    },
    "room": "301",
    "building": "Корпус А",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "10:30",
    "pairNumber": 1,
    "weekType": "odd",
    "group": {
      "id": "uuid",
      "name": "ПМИ-201"
    },
    "pairSpace": {
      "id": "uuid",
      "announcementCount": 2,
      "homeworkCount": 1,
      "fileCount": 3
    },
    "changes": []
  }
}
```

---

### 2.4 GET `/schedule/lessons/:id/changes`

История изменений пары.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "changeType": "room_changed",
      "oldValues": { "room": "201" },
      "newValues": { "room": "301" },
      "changedAt": "2024-01-15T08:00:00Z",
      "changedBy": "Админ"
    }
  ]
}
```

---

### 2.5 POST `/admin/schedule/upload`

Загрузка файла расписания.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`, `department_head`
**Content-Type:** `multipart/form-data`

**Request:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `file` | File | Да | Excel/CSV/iCal файл |
| `semesterStart` | string | Да | Дата начала семестра (ISO) |
| `semesterEnd` | string | Да | Дата конца семестра (ISO) |
| `mapping` | string (JSON) | Да | Маппинг колонок |

**Rate Limit:** 1 запрос в час на вуз.

**Response 200:**

```json
{
  "data": {
    "uploadId": "uuid",
    "status": "processing",
    "totalRows": 1500,
    "preview": [
      {
        "subject": "Программирование",
        "teacher": "Петров П.П.",
        "room": "301",
        "group": "ПМИ-201",
        "dayOfWeek": 1,
        "startTime": "09:00",
        "endTime": "10:30"
      }
    ]
  }
}
```

---

### 2.6 POST `/admin/schedule/sync`

Ручной запуск синхронизации.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Response 200:**

```json
{
  "status": "synced",
  "timestamp": "2026-09-26T10:00:00.000Z",
  "groups": 26,
  "lessons": 3000,
  "teachers": 120,
  "imported": 3000,
  "updated": 0,
  "studentsLinked": 42
}
```

---

### 2.7 GET `/admin/schedule/sync-status`

Статус последней синхронизации.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Response 200:**

```json
{
  "data": {
    "syncId": "uuid",
    "status": "completed",
    "startedAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:00:05Z",
    "changesDetected": 3,
    "errors": []
  }
}
```

---

## 3. Pair Space (Пространство пары)

### 3.1 GET `/pair-spaces/:lessonId`

Пространство пары.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "lessonId": "uuid",
    "subject": "Программирование",
    "activeUntil": "2024-03-15T00:00:00Z",
    "announcements": [
      {
        "id": "uuid",
        "authorName": "Петров П.П.",
        "text": "Не забудьте принести ноутбуки",
        "isPinned": true,
        "createdAt": "2024-01-15T08:00:00Z"
      }
    ],
    "homeworks": [
      {
        "id": "uuid",
        "title": "Лабораторная №3",
        "description": "Реализовать алгоритм...",
        "deadline": "2024-01-20T23:59:59Z",
        "submissionStatus": "not_submitted",
        "createdAt": "2024-01-15T08:00:00Z"
      }
    ],
    "files": [
      {
        "id": "uuid",
        "fileName": "Методичка.pdf",
        "fileUrl": "https://...",
        "fileType": "application/pdf",
        "size": 1048576,
        "uploadedBy": "Петров П.П.",
        "createdAt": "2024-01-15T08:00:00Z"
      }
    ],
    "messagesCount": 5
  }
}
```

---

### 3.1a GET `/pair-spaces/:lessonId/timeline`

Хронология недавних занятий того же курса/предмета. Tenant берётся из JWT. Студент видит только свою группу, преподаватель — собственные занятия; прочие роли остаются в пределах текущего tenant и курса (либо группы, если `courseId` не задан). Возвращается первая страница пагинации: 20 занятий в порядке от новых к старым; `meta.total` содержит полное количество подходящих занятий. `pairSpace` может быть `null`, если для занятия ещё не публиковали контент.

**Response 200:** стандартный пагинированный ответ; `data` содержит элементы `{ lesson, pairSpace }`, а `pairSpace` — только `announcements`, `homeworks` и `files`.

---

### 3.2 GET `/pair-spaces/:lessonId/personal-note`

Получить личную заметку текущего пользователя. Доступ к занятию и tenant проверяются так же, как для Pair Space.

**Response 200:** объект заметки (`content`, `updatedAt`) или `null`, если заметка ещё не создана.

### 3.3 PUT `/pair-spaces/:lessonId/personal-note`

Создать или обновить личную заметку (до 20 000 символов). Пустая строка удаляет сохранённое содержимое.

**Request:** `{ "content": "Повторить примеры с доски" }`

Заметка принадлежит только текущему пользователю. Клиент сохраняет локальную копию для офлайн-доступа и синхронизирует её с этим API.

---

### 3.4 POST `/pair-spaces/:lessonId/announcements`

Создать объявление.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `teacher`

**Request:**

```json
{
  "text": "Не забудьте принести ноутбуки на следующую пару",
  "isPinned": true
}
```

**Validation:**

- `text`: string, min 1, max 2000
- `isPinned`: boolean (опционально, default false)

**Response 201:**

```json
{
  "data": {
    "id": "uuid",
    "text": "Не забудьте принести ноутбуки на следующую пару",
    "isPinned": true,
    "createdAt": "2024-01-15T08:00:00Z"
  }
}
```

---

### 3.5 POST `/pair-spaces/:lessonId/homeworks`

Создать ДЗ.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `teacher`

**Request:**

```json
{
  "title": "Лабораторная №3",
  "description": "Реализовать алгоритм сортировки...",
  "deadline": "2024-01-20T23:59:59Z",
  "isRecurring": false
}
```

**Validation:**

- `title`: string, min 1, max 200
- `description`: string, max 5000 (опционально)
- `deadline`: ISO datetime, min now + 1 hour (опционально)
- `isRecurring`: boolean (опционально, default false)
- `recurringRule`: string (опционально, required if isRecurring=true)

**Response 201:**

```json
{
  "data": {
    "id": "uuid",
    "title": "Лабораторная №3",
    "deadline": "2024-01-20T23:59:59Z",
    "createdAt": "2024-01-15T08:00:00Z"
  }
}
```

---

### 3.6 POST `/pair-spaces/:lessonId/files`

Загрузить файл.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `teacher`
**Content-Type:** `multipart/form-data`

**Request:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `file` | File | Да | Файл (pdf, doc, ppt, jpg, png) |

**Validation:**

- File size: max 50 MB
- Allowed types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`, `image/jpeg`, `image/png`

**Response 201:**

```json
{
  "data": {
    "id": "uuid",
    "fileName": "Методичка.pdf",
    "fileUrl": "https://...",
    "fileType": "application/pdf",
    "size": 1048576,
    "createdAt": "2024-01-15T08:00:00Z"
  }
}
```

---

### 3.7 PATCH `/homeworks/:id/submit`

Отметить ДЗ как сданное.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `student`

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "submissionStatus": "submitted",
    "submittedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 3.7a PATCH `/pair-spaces/homeworks/:id/progress`

Сохранить личный статус подготовки и/или чек-лист текущего студента. Endpoint проверяет, что пользователь студент и занятие принадлежит его доступной группе. Эти данные не меняют и не создают Moodle-сдачу.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `student`
**Body:** `{ "state"?: "todo" | "in_progress" | "done", "subtasks"?: [{ "id": "uuid", "title": "Прочитать главу", "done": false }] }` (максимум 20 шагов, заголовок до 160 символов)
**Response 200:** `{ "id": "uuid", "homeworkId": "uuid", "studentId": "uuid", "state": "in_progress" }`

---
### 3.8 GET `/pair-spaces/:lessonId/messages`

Сообщения обсуждения.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | number | 1 | Номер страницы |
| `limit` | number | 50 | Элементов на странице |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userName": "Иванов И.И.",
      "text": "Когда будет следующая пара?",
      "parentId": null,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 3.9 POST `/pair-spaces/:lessonId/messages`

Написать сообщение.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**

```json
{
  "text": "Когда будет следующая пара?",
  "parentId": null
}
```

**Validation:**

- `text`: string, min 1, max 2000
- `parentId`: UUID (опционально, для ответа)

**Rate Limit:** 10 сообщений в минуту на пользователя.

**Response 201:**

```json
{
  "data": {
    "id": "uuid",
    "text": "Когда будет следующая пара?",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

## 4. Absences (Отсутствия)

### 4.1 POST `/absences`

Создать статус отсутствия.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `student`

**Request:**

```json
{
  "type": "sick",
  "startDate": "2024-01-15",
  "endDate": "2024-01-17",
  "comment": "Температура 38.5"
}
```

**Validation:**

- `type`: enum ['learning', 'sick', 'work', 'other_city', 'other']
- `startDate`: ISO date, min today
- `endDate`: ISO date, min startDate
- `comment`: string, max 500 (опционально)

**Response 201:**

```json
{
  "data": {
    "id": "uuid",
    "type": "sick",
    "startDate": "2024-01-15",
    "endDate": "2024-01-17",
    "affectedLessonsCount": 4,
    "confirmationRequired": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 4.2 GET `/absences/my`

Мои статусы отсутствий.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `student`

**Query Parameters:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `status` | string | all | Фильтр: pending, confirmed, rejected |
| `page` | number | 1 | Номер страницы |
| `limit` | number | 20 | Элементов на странице |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "sick",
      "startDate": "2024-01-15",
      "endDate": "2024-01-17",
      "comment": "Температура 38.5",
      "affectedLessonsCount": 4,
      "confirmation": {
        "status": "pending",
        "curatorName": "Сидорова А.А."
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

---

### 4.3 PATCH `/absences/:id`

Обновить статус отсутствия.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `student`
**Ограничение:** Только свои статусы со статусом `pending`

**Request:**

```json
{
  "type": "sick",
  "startDate": "2024-01-15",
  "endDate": "2024-01-18",
  "comment": "Температура 39.0"
}
```

**Response 200:** Обновлённый статус.

---

### 4.4 DELETE `/absences/:id`

Отменить статус отсутствия.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `student`
**Ограничение:** Только свои статусы со статусом `pending`

**Response 200:**

```json
{
  "data": { "success": true }
}
```

---

### 4.5 GET `/curator/absences`

Дашборд куратора.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `curator`

**Query Parameters:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `status` | string | pending | Фильтр: pending, confirmed, rejected, all |
| `date` | string | today | Дата для фильтрации |
| `page` | number | 1 | Номер страницы |
| `limit` | number | 20 | Элементов на странице |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "student": {
        "id": "uuid",
        "name": "Иванов И.И.",
        "group": "ПМИ-201"
      },
      "type": "sick",
      "startDate": "2024-01-15",
      "endDate": "2024-01-17",
      "comment": "Температура 38.5",
      "isSensitive": true,
      "affectedLessonsCount": 4,
      "status": "pending",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 4.6 PATCH `/curator/absences/:id/confirm`

Подтвердить отсутствие.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `curator`

**Request:**

```json
{
  "comment": "Принято"
}
```

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "confirmedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### 4.7 PATCH `/curator/absences/:id/reject`

Отклонить отсутствие.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `curator`

**Request:**

```json
{
  "comment": "Необходима справка"
}
```

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "status": "rejected",
    "rejectedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

## 5. Notifications (Уведомления)

### 5.1 GET `/notifications`

Список уведомлений.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `isRead` | boolean | all | Фильтр по прочитанным |
| `page` | number | 1 | Номер страницы |
| `limit` | number | 20 | Элементов на странице |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "schedule_changed",
      "title": "Изменение расписания",
      "body": "Пара «Программирование» перенесена на 14:00",
      "deepLink": "/schedule",
      "isRead": false,
      "createdAt": "2024-01-15T08:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

### 5.2 PATCH `/notifications/:id/read`

Отметить прочитанным.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "isRead": true
  }
}
```

---

### 5.3 POST `/notifications/read-all`

Отметить все прочитанными.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "data": {
    "updatedCount": 15
  }
}
```

---

### 5.4 POST `/devices/token`

Зарегистрировать/обновить push token.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**

```json
{
  "platform": "android",
  "token": "fcm_token_here"
}
```

**Validation:**

- `platform`: enum ['ios', 'android', 'web']
- `token`: string, min 10

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "platform": "android",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 5.5 GET `/notifications/preferences`

Настройки уведомлений текущего пользователя в текущем университете.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

```json
{
  "scheduleChanges": true,
  "cancellations": true,
  "roomChanges": true,
  "homeworkCreated": true,
  "deadlines": true,
  "messages": true,
  "announcements": true,
  "systemAlerts": true,
  "quietHoursEnabled": false,
  "quietHoursStart": "22:00:00",
  "quietHoursEnd": "07:00:00",
  "timeZone": "Asia/Omsk",
  "telegramEnabled": true
}
```

`telegramEnabled` выключен по умолчанию. Для обычных событий категории и тихие часы применяются до доставки; события `urgent` проходят фильтры согласно общему правилу уведомлений. Пользователь может включить канал после привязки Telegram.

---

### 5.6 PATCH `/notifications/preferences`

Обновить настройки.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**

```json
{
  "scheduleChanges": true,
  "deadlines": false,
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00",
  "timeZone": "Asia/Omsk"
}
```

**Response 200:** Обновлённые настройки.

---

## 6. Admin (Администрирование)

### 6.1 GET `/admin/university`

Данные вуза.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "name": "СИБИТ",
    "connectorType": "excel",
    "connectorConfig": {
      "columnMapping": {}
    },
    "stats": {
      "totalStudents": 500,
      "totalTeachers": 30,
      "totalGroups": 20
    }
  }
}
```

---

### 6.2 PATCH `/admin/university`

Обновить данные вуза.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Request:**

```json
{
  "name": "СИБИТ (обновлено)",
  "connectorType": "sibit"
}
```

**Response 200:** Обновлённые данные.

---

### 6.3 GET `/admin/faculties`

Список факультетов.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Информатика",
      "dean": {
        "id": "uuid",
        "name": "Петров П.П."
      },
      "coursesCount": 4,
      "groupsCount": 10
    }
  ]
}
```

---

### 6.4 POST `/admin/faculties`

Создать факультет.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Request:**

```json
{
  "name": "Информатика",
  "deanId": "uuid"
}
```

**Response 201:** Созданный факультет.

---

### 6.5 PATCH `/admin/faculties/:id`

Обновить факультет.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Response 200:** Обновлённый факультет.

---

### 6.6 DELETE `/admin/faculties/:id`

Удалить факультет.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`
**Ограничение:** Только пустые факультеты (без групп)

**Response 200:**

```json
{
  "data": { "success": true }
}
```

---

### 6.7 GET `/admin/groups`

Список групп.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `facultyId` | UUID | Фильтр по факультету |
| `course` | number | Фильтр по курсу |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "ПМИ-201",
      "faculty": {
        "id": "uuid",
        "name": "Информатика"
      },
      "course": 2,
      "studentsCount": 25,
      "curator": {
        "id": "uuid",
        "name": "Сидорова А.А."
      }
    }
  ]
}
```

---

### 6.8 POST `/admin/groups`

Создать группу.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Request:**

```json
{
  "name": "ПМИ-201",
  "facultyId": "uuid",
  "course": 2,
  "curatorId": "uuid"
}
```

**Response 201:** Созданная группа.

---

### 6.9 GET `/admin/users`

Поиск пользователей.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `search` | string | Поиск по имени/email/телефону |
| `role` | string | Фильтр по роли |
| `page` | number | Номер страницы |
| `limit` | number | Элементов на странице |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Иванов И.И.",
      "email": "ivanov@university.ru",
      "phone": "+79991234567",
      "roles": ["student"],
      "group": {
        "id": "uuid",
        "name": "ПМИ-201"
      },
      "lastActiveAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

### 6.10 PATCH `/admin/users/:id/roles`

Назначение ролей.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`, `superadmin`

**Request:**

```json
{
  "roles": ["teacher", "curator"],
  "groupId": "uuid" // Опционально, для curator
}
```

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "roles": ["teacher", "curator"],
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 6.11 GET `/admin/stats`

Базовая статистика.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `university_admin`

**Response 200:**

```json
{
  "data": {
    "students": {
      "total": 500,
      "active30d": 450,
      "registeredThisWeek": 15
    },
    "teachers": {
      "total": 30,
      "withContent": 25,
      "contentPercentage": 83
    },
    "absences": {
      "pending": 12,
      "confirmedToday": 8,
      "totalThisWeek": 45
    },
    "schedule": {
      "lastSyncAt": "2024-01-15T06:00:00Z",
      "totalLessons": 1500,
      "changesThisWeek": 3
    }
  }
}
```

---

### 6.12 GET `/superadmin/universities`

Все вузы (суперадмин).

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `superadmin`

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "СИБИТ",
      "studentsCount": 500,
      "teachersCount": 30,
      "connectorType": "excel",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 6.13 POST `/superadmin/universities`

Подключить новый вуз.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `superadmin`

**Request:**

```json
{
  "name": "ОмГУ",
  "connectorType": "sibit",
  "adminEmail": "admin@omgu.ru"
}
```

**Response 201:** Созданный вуз.

---

### 6.14 GET `/superadmin/connectors`

Управление коннекторами.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `superadmin`

**Response 200:**

```json
{
  "data": [
    {
      "id": "sibit",
      "name": "СИБИТ API",
      "description": "Интеграция с расписанием СИБИТ",
      "status": "active",
      "universitiesUsing": 1,
      "lastSyncAt": "2024-01-15T06:00:00Z"
    }
  ]
}
```

---

### 6.15 PATCH `/superadmin/connectors/:id`

Обновить коннектор.

**Headers:** `Authorization: Bearer <accessToken>`
**Roles:** `superadmin`

**Request:**

```json
{
  "status": "active",
  "config": {
    "apiKey": "new-api-key"
  }
}
```

**Response 200:** Обновлённый коннектор.

---

## Сводная таблица эндпоинтов

| #   | Endpoint                               | Метод  | Роль                  | Rate Limit |
| --- | -------------------------------------- | ------ | --------------------- | ---------- |
| 1   | `/auth/request-code`                   | POST   | Public                | 1/60s      |
| 2   | `/auth/verify-code`                    | POST   | Public                | 5/мин      |
| 3   | `/auth/login`                          | POST   | Public                | 5/мин      |
| 4   | `/auth/refresh`                        | POST   | Public                | 10/мин     |
| 5   | `/auth/logout`                         | POST   | Auth                  | —          |
| 6   | `/users/me`                            | GET    | Auth                  | —          |
| 6a  | `/users/me/favorites`                  | GET    | Student               | —          |
| 6b  | `/users/me/favorites`                  | POST   | Student               | favorite   |
| 6c  | `/users/me/favorites`                  | DELETE | Student               | favorite   |
| 7   | `/users/me`                            | PATCH  | Auth                  | —          |
| 8   | `/users/me/bind-group`                 | POST   | Auth                  | —          |
| 9   | `/users/me`                            | DELETE | Auth                  | —          |
| 10  | `/schedule/my`                         | GET    | student, teacher      | —          |
| 11  | `/my-day`                              | GET    | Auth                  | —          |
| 12  | `/schedule/lessons/:id`                | GET    | Auth                  | —          |
| 13  | `/schedule/lessons/:id/changes`        | GET    | Auth                  | —          |
| 14  | `/admin/schedule/upload`               | POST   | admin                 | 1/час      |
| 15  | `/admin/schedule/sync`                 | POST   | admin                 | —          |
| 16  | `/admin/schedule/sync-status`          | GET    | admin                 | —          |
| 17  | `/pair-spaces/:lessonId`               | GET    | Auth                  | —          |
| 17c | `/pair-spaces/:lessonId/timeline`      | GET    | Auth / role scope     | —          |
| 17a | `/pair-spaces/:lessonId/personal-note` | GET    | Auth / lesson scope    | —          |
| 17b | `/pair-spaces/:lessonId/personal-note` | PUT    | Auth / lesson scope    | —          |
| 18  | `/pair-spaces/:lessonId/announcements` | POST   | teacher               | —          |
| 19  | `/pair-spaces/:lessonId/homeworks`     | POST   | teacher               | —          |
| 20  | `/pair-spaces/:lessonId/files`         | POST   | teacher               | —          |
| 21  | `/homeworks/:id/submit`                | PATCH  | student               | —          |
| 21a | `/pair-spaces/homeworks/:id/progress`  | PATCH  | student, lesson scope | —          |
| 22  | `/pair-spaces/:lessonId/messages`      | GET    | Auth                  | —          |
| 23  | `/pair-spaces/:lessonId/messages`      | POST   | Auth                  | 10/мин     |
| 24  | `/absences`                            | POST   | student               | —          |
| 25  | `/absences/my`                         | GET    | student               | —          |
| 26  | `/absences/:id`                        | PATCH  | student               | —          |
| 27  | `/absences/:id`                        | DELETE | student               | —          |
| 28  | `/curator/absences`                    | GET    | curator               | —          |
| 29  | `/curator/absences/:id/confirm`        | PATCH  | curator               | —          |
| 30  | `/curator/absences/:id/reject`         | PATCH  | curator               | —          |
| 31  | `/notifications`                       | GET    | Auth                  | —          |
| 32  | `/notifications/:id/read`              | PATCH  | Auth                  | —          |
| 33  | `/notifications/read-all`              | POST   | Auth                  | —          |
| 34  | `/devices/token`                       | POST   | Auth                  | —          |
| 35  | `/notifications/settings`              | GET    | Auth                  | —          |
| 36  | `/notifications/settings`              | PATCH  | Auth                  | —          |
| 37  | `/admin/university`                    | GET    | admin                 | —          |
| 38  | `/admin/university`                    | PATCH  | admin                 | —          |
| 39  | `/admin/faculties`                     | GET    | admin                 | —          |
| 40  | `/admin/faculties`                     | POST   | admin                 | —          |
| 41  | `/admin/faculties/:id`                 | PATCH  | admin                 | —          |
| 42  | `/admin/faculties/:id`                 | DELETE | admin                 | —          |
| 43  | `/admin/groups`                        | GET    | admin                 | —          |
| 44  | `/admin/groups`                        | POST   | admin                 | —          |
| 45  | `/admin/groups/:id`                    | PATCH  | admin                 | —          |
| 46  | `/admin/groups/:id`                    | DELETE | admin                 | —          |
| 47  | `/admin/users`                         | GET    | admin                 | —          |
| 48  | `/admin/users/:id/roles`               | PATCH  | admin                 | —          |
| 49  | `/admin/stats`                         | GET    | admin                 | —          |
| 50  | `/superadmin/universities`             | GET    | superadmin            | —          |
| 51  | `/superadmin/universities`             | POST   | superadmin            | —          |
| 52  | `/superadmin/universities/:id`         | PATCH  | superadmin            | —          |
| 53  | `/superadmin/universities/:id`         | DELETE | superadmin            | —          |
| 54  | `/superadmin/connectors`               | GET    | superadmin            | —          |
| 55  | `/superadmin/connectors/:id`           | PATCH  | superadmin            | —          |
| 56  | `/auth/max`                            | POST   | Public (MAX initData) | —          |
| 57  | `/auth/max/link`                       | POST   | JWT user              | —          |
| 58  | `/auth/telegram/link`                  | POST   | JWT user              | —          |
| 59  | `/auth/telegram/status`                | GET    | JWT user              | —          |
| 60  | `/integrations/telegram/webhook`        | POST   | Secret header         | —          |
