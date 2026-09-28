# API — Примеры нестандартных кейсов

Только сложные / нестандартные сценарии. Основные endpoints — в [api/README.md](README.md).

---

## 1. Вход и привязка к группе (полный flow)

Самостоятельная регистрация отключена: `POST /api/v1/auth/register` всегда отвечает `403` — аккаунты создаёт университет.

### Шаг 1: Вход по email и паролю

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "student@university.ru",
  "password": "password123"
}
```

Ответ (пароль — минимум 6 символов):
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "550e8400-...",
    "email": "student@university.ru",
    "firstName": "Иван",
    "lastName": "Иванов",
    "role": "student"
  }
}
```

Для единых кабинетов используйте `POST /api/v1/auth/portal-login` — то же тело, но в ответ добавляется `workspace` (`student` | `staff` | `admin` | `developer`). Все роли, включая разработчика, входят через общую форму; developer workspace открывается по `/developer/` того же домена.

### Шаг 2: Привязка к группе

`PATCH /api/v1/users/me` принимает только `firstName`/`lastName`/`phone`/`avatarUrl`. Привязка к группе — отдельный endpoint с телом `{ groupId }`:

```http
POST /api/v1/users/me/bind-group
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "groupId": "550e8400-..."
}
```

Ответ — обновлённый пользователь (без обёртки `data`):
```json
{
  "id": "550e8400-...",
  "email": "student@university.ru",
  "firstName": "Иван",
  "lastName": "Иванов",
  "role": "student",
  "universityId": "550e8400-...",
  "groupId": "550e8400-...",
  "isActive": true
}
```

---

## 2. Отсутствие + затронутые пары

### Создание статуса отсутствия

```http
POST /api/v1/absences
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "type": "sick",
  "startDate": "2025-09-08",
  "endDate": "2025-09-10",
  "comment": "Температура 38.5"
}
```

Ответ:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "type": "sick",
    "affectedLessons": 4,
    "affectedLessonIds": ["...", "...", "...", "..."],
    "status": "pending_confirmation"
  }
}
```

Система автоматически определяет какие пары попадают под период отсутствия.

---

## 3. Детект изменений расписания

### Загрузка нового расписания

```http
POST /api/v1/admin/schedule/upload
Authorization: Bearer eyJ...
Content-Type: multipart/form-data

file: schedule.xlsx
universityId: 550e8400-...
```

Ответ (если есть изменения):
```json
{
  "success": true,
  "data": {
    "totalLessons": 150,
    "changes": [
      {
        "lessonId": "...",
        "changeType": "room_changed",
        "oldValues": { "room": "304" },
        "newValues": { "room": "305" },
        "affectedStudents": 30
      },
      {
        "lessonId": "...",
        "changeType": "cancelled",
        "oldValues": { "subject": "Математика" },
        "newValues": null,
        "affectedStudents": 25
      }
    ],
    "notificationsQueued": 55
  }
}
```

---

## 4. «Мой день» — агрегация

```http
GET /api/v1/schedule/my-day
Authorization: Bearer eyJ...
```

```json
{
  "success": true,
  "data": {
    "date": "2025-09-08",
    "greeting": "Привет, Иван",
    "absence": {
      "type": "sick",
      "until": "2025-09-10",
      "label": "🤒 Болен"
    },
    "summary": {
      "lessonsCount": 4,
      "changesCount": 1,
      "hotDeadlinesCount": 2,
      "newContentCount": 3
    },
    "lessons": [...],
    "changes": [...],
    "hotDeadlines": [...],
    "newContent": [...]
  }
}
```

---

## 5. Дашборд куратора

```http
GET /api/v1/curator/absences?status=pending&groupId=...
Authorization: Bearer eyJ...
```

```json
{
  "success": true,
  "data": [
    {
      "studentId": "...",
      "studentName": "Иванов Иван",
      "type": "sick",
      "period": { "from": "2025-09-08", "to": "2025-09-10" },
      "affectedLessons": 4,
      "comment": "Температура 38.5",
      "confirmationStatus": "pending",
      "createdAt": "2025-09-07T20:00:00Z"
    }
  ],
  "meta": { "total": 1, "pending": 1 }
}
```
