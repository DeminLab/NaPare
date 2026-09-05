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
  "phone": "+79991234567",     // Опционально
  "email": "user@example.com"  // Опционально (одно из двух обязательно)
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

### 2.2 GET `/schedule/my-day`

Агрегированные данные для экрана "Мой день".

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**
```json
{
  "data": {
    "date": "2024-01-15",
    "dayOfWeek": 1,
    "lessons": [
      {
        "id": "uuid",
        "subject": "Программирование",
        "teacher": "Петров П.П.",
        "room": "301",
        "startTime": "09:00",
        "endTime": "10:30",
        "pairNumber": 1,
        "hasChanges": true,
        "changeType": "room_changed",
        "pairSpaceId": "uuid"
      }
    ],
    "changes": [
      {
        "lessonId": "uuid",
        "subject": "Программирование",
        "changeType": "room_changed",
        "oldValue": "201",
        "newValue": "301",
        "changedAt": "2024-01-15T08:00:00Z"
      }
    ],
    "hotDeadlines": [
      {
        "id": "uuid",
        "title": "Лабораторная №3",
        "deadline": "2024-01-15T23:59:59Z",
        "subject": "Программирование",
        "pairSpaceId": "uuid"
      }
    ],
    "newContent": [
      {
        "type": "announcement",
        "subject": "Программирование",
        "title": "Новое объявление",
        "createdAt": "2024-01-15T08:00:00Z",
        "pairSpaceId": "uuid"
      }
    ],
    "absenceStatus": null
  }
}
```

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
  "data": {
    "syncId": "uuid",
    "status": "started",
    "startedAt": "2024-01-15T10:00:00Z"
  }
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

### 3.2 POST `/pair-spaces/:lessonId/announcements`

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

### 3.3 POST `/pair-spaces/:lessonId/homeworks`

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

### 3.4 POST `/pair-spaces/:lessonId/files`

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

### 3.5 PATCH `/homeworks/:id/submit`

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

### 3.6 GET `/pair-spaces/:lessonId/messages`

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

### 3.7 POST `/pair-spaces/:lessonId/messages`

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

### 5.5 GET `/notifications/settings`

Настройки уведомлений.

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**
```json
{
  "data": {
    "pushEnabled": true,
    "emailEnabled": false,
    "types": {
      "schedule_changed": true,
      "announcement_created": true,
      "homework_created": true,
      "homework_deadline": true,
      "file_uploaded": true,
      "absence_created": true,
      "absence_confirmed": true,
      "absence_rejected": true
    },
    "quietHours": {
      "enabled": false,
      "start": "22:00",
      "end": "08:00"
    }
  }
}
```

---

### 5.6 PATCH `/notifications/settings`

Обновить настройки.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{
  "pushEnabled": true,
  "types": {
    "schedule_changed": true,
    "homework_deadline": true
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  }
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
  "groupId": "uuid"  // Опционально, для curator
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

| # | Endpoint | Метод | Роль | Rate Limit |
|---|----------|-------|------|------------|
| 1 | `/auth/request-code` | POST | Public | 1/60s |
| 2 | `/auth/verify-code` | POST | Public | 5/мин |
| 3 | `/auth/login` | POST | Public | 5/мин |
| 4 | `/auth/refresh` | POST | Public | 10/мин |
| 5 | `/auth/logout` | POST | Auth | — |
| 6 | `/users/me` | GET | Auth | — |
| 7 | `/users/me` | PATCH | Auth | — |
| 8 | `/users/me/bind-group` | POST | Auth | — |
| 9 | `/users/me` | DELETE | Auth | — |
| 10 | `/schedule/my` | GET | student, teacher | — |
| 11 | `/schedule/my-day` | GET | student | — |
| 12 | `/schedule/lessons/:id` | GET | Auth | — |
| 13 | `/schedule/lessons/:id/changes` | GET | Auth | — |
| 14 | `/admin/schedule/upload` | POST | admin | 1/час |
| 15 | `/admin/schedule/sync` | POST | admin | — |
| 16 | `/admin/schedule/sync-status` | GET | admin | — |
| 17 | `/pair-spaces/:lessonId` | GET | Auth | — |
| 18 | `/pair-spaces/:lessonId/announcements` | POST | teacher | — |
| 19 | `/pair-spaces/:lessonId/homeworks` | POST | teacher | — |
| 20 | `/pair-spaces/:lessonId/files` | POST | teacher | — |
| 21 | `/homeworks/:id/submit` | PATCH | student | — |
| 22 | `/pair-spaces/:lessonId/messages` | GET | Auth | — |
| 23 | `/pair-spaces/:lessonId/messages` | POST | Auth | 10/мин |
| 24 | `/absences` | POST | student | — |
| 25 | `/absences/my` | GET | student | — |
| 26 | `/absences/:id` | PATCH | student | — |
| 27 | `/absences/:id` | DELETE | student | — |
| 28 | `/curator/absences` | GET | curator | — |
| 29 | `/curator/absences/:id/confirm` | PATCH | curator | — |
| 30 | `/curator/absences/:id/reject` | PATCH | curator | — |
| 31 | `/notifications` | GET | Auth | — |
| 32 | `/notifications/:id/read` | PATCH | Auth | — |
| 33 | `/notifications/read-all` | POST | Auth | — |
| 34 | `/devices/token` | POST | Auth | — |
| 35 | `/notifications/settings` | GET | Auth | — |
| 36 | `/notifications/settings` | PATCH | Auth | — |
| 37 | `/admin/university` | GET | admin | — |
| 38 | `/admin/university` | PATCH | admin | — |
| 39 | `/admin/faculties` | GET | admin | — |
| 40 | `/admin/faculties` | POST | admin | — |
| 41 | `/admin/faculties/:id` | PATCH | admin | — |
| 42 | `/admin/faculties/:id` | DELETE | admin | — |
| 43 | `/admin/groups` | GET | admin | — |
| 44 | `/admin/groups` | POST | admin | — |
| 45 | `/admin/groups/:id` | PATCH | admin | — |
| 46 | `/admin/groups/:id` | DELETE | admin | — |
| 47 | `/admin/users` | GET | admin | — |
| 48 | `/admin/users/:id/roles` | PATCH | admin | — |
| 49 | `/admin/stats` | GET | admin | — |
| 50 | `/superadmin/universities` | GET | superadmin | — |
| 51 | `/superadmin/universities` | POST | superadmin | — |
| 52 | `/superadmin/universities/:id` | PATCH | superadmin | — |
| 53 | `/superadmin/universities/:id` | DELETE | superadmin | — |
| 54 | `/superadmin/connectors` | GET | superadmin | — |
| 55 | `/superadmin/connectors/:id` | PATCH | superadmin | — |
