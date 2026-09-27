# Module: My Day (Мой день)

## 1. Цель и границы

**Цель:** Главный экран студента — персональная сводка учебного дня без AI. Агрегирует данные из других модулей.

**Не делает:** Хранение данных (только читает из других модулей), управление расписанием, публикация контента.

---

## 2. Сущности

Модуль не имеет собственных сущностей. Агрегирует данные из:

| Источник                                              | Что берётся                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Schedule (lessons)                                    | Пары на сегодня (`isChanged` — индикатор изменений)                                  |
| PairSpace (announcements, homeworks, files, messages) | Пространства сегодняшних пар; `homeworks` — legacy-имя ориентира «подготовка к паре» |
| Absences (`Absence`)                                  | Отсутствия за сегодня                                                                |
| Notifications                                         | Количество непрочитанных (`unreadCount`)                                             |

---

## 3. API

| Endpoint         | Метод | Описание                             |
| ---------------- | ----- | ------------------------------------ |
| `/api/v1/my-day` | GET   | Агрегированные данные для «Мой день» |

Ответ (`apps/backend/src/my-day/my-day.service.ts:49-64`):

```json
{
  "date": "2026-09-26",
  "lessons": [],
  "pairSpaces": [],
  "absences": [],
  "notifications": { "unreadCount": 0 },
  "summary": { "totalLessons": 0, "changedLessons": 0, "totalAbsences": 0 }
}
```

Полный OpenAPI: [api/README.md](../api/README.md).

---

## 4. Права доступа

| Действие            | Роль                                 | Ограничение                                                                           |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Просмотр «Мой день» | Любая аутентифицированная роль (JWT) | Выборка по роли: `student` — своя группа, `teacher` — свои пары, остальные — весь вуз |

Матрица прав: [architecture/roles-and-permissions.md](../architecture/roles-and-permissions.md).

---

## 5. UX / экраны

- S09. Мой день (главный экран студента) — [ui/screens-student.md](../ui/screens-student.md)

**Критичные UX-требования:**

- Первый экран после входа (для `workspace: student` из `POST /auth/portal-login`)
- Время загрузки ≤ 1.5–2 сек
- Pull-to-refresh
- Понятные пустые состояния («Сегодня пар нет», «Нет горящих дедлайнов»)
- Тёмная тема

---

## 6. Бизнес-правила и edge-cases

**Фактическая логика агрегации (без AI, `my-day.service.ts`):**

```
lessons    = по роли: student → findForStudentDate(university, group, today)
                       teacher → findByTeacher(university, user, today)
                       иначе   → findByDate(university, today)
pairSpaces = pairSpaceService.getOrCreateByLesson(lesson.id, universityId) для каждой доступной пары
absences   = absencesService.findByStudent(userId), фильтр startDate == today
unread     = notificationsService.getUnreadCount(userId)
summary    = { totalLessons, changedLessons (lessons.isChanged), totalAbsences (все пропуски) }
```

Горящие дедлайны и новый контент отдельно не вычисляются: клиент может получить подготовку к паре и объявления из `pairSpaces[].homeworks` / `pairSpaces[].announcements`. Сдачи и оценки в этот агрегат не входят — ими управляет Moodle.

1. **Пустые состояния:** «Сегодня пар нет», «Нет горящих дедлайнов», «Нет нового контента»
2. **Кэширование:** при слабом интернете показывать последнее состояние
3. **Статус отсутствия:** цветной чип с возможностью изменения (см. absences)
4. **Навигация:** тап по карточке пары → Пространство пары, тап по ориентиру подготовки → вкладка «Подготовка» внутри пространства

---

## 7. События и уведомления

Модуль не генерирует событий. Только читает данные.

---

## 8. Нефункциональные требования

| Требование | Значение                 |
| ---------- | ------------------------ |
| Latency    | p95 ≤ 1.5 сек            |
| Offline    | Кэш последнего состояния |
| Refresh    | Pull-to-refresh          |

---

## 9. Критерии приёмки

- [ ] После входа студент сразу видит актуальную сводку
- [ ] Изменения пар отмечаются (`summary.changedLessons`)
- [ ] Тап по любой карточке ведёт в нужное место
- [ ] Работает при слабом интернете
- [ ] Пустые состояния понятны

---

## 10. Зависимости

**Зависит от:** auth (JWT), schedule (lessons), pair-space (pair spaces), absences (Absence), notifications (unreadCount)
**Зависимость от:** — (только читает данные)

---

## 11. Open questions / TODO

- [ ] Виджет для home screen (mobile)
- [ ] Кэширование на клиенте (offline-first)

---

## 12. Новое в коде (не описано ранее)

- Реальный путь — `GET /api/v1/my-day` (`my-day.controller.ts`, `@Controller('my-day')` + глобальный префикс `api/v1`), а не `/schedule/my-day`; форма ответа — см. раздел 3.
- `POST /auth/portal-login` возвращает `workspace` — от него зависит, какой кабинет открывается первым экраном (student → «Мой день»).
- Права: на модуле только `JwtAuthGuard` (без `@Roles`/`@RequiresPermission`); фильтрация идёт по роли внутри `MyDayService`.
- Для каждой доступной сегодняшней пары My Day запрашивает `getOrCreateByLesson`, поэтому у занятия всегда есть безопасный контекст для объявлений, материалов и подготовки.
- Изоляция тенанта: `universityId` берётся из JWT, глобальный `apps/backend/src/common/tenant/tenant-context.module.ts`.
- Данные расписания могут поступать из rasp.\* (`apps/backend/src/rasp/rasp.module.ts`, `sibit-university-bootstrap.service.ts`) — отдельного эндпоинта «my-day из rasp» нет.
- Сущность аудита `apps/backend/src/common/entities/audit-log.entity.ts` / `GET /admin/audit-log` к этому модулю не применяется (только чтение данных).
