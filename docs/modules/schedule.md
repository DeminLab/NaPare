# Module: Schedule (Расписание)

## 1. Цель и границы

**Цель:** Надёжное получение, хранение, обновление и отображение расписания + детект изменений.

**Не делает:** Публикация контента в пространство пары (pair-space), уведомления (notifications).

---

## 2. Сущности

| Сущность | Описание | Ключевые поля |
|----------|----------|---------------|
| Lesson | Пара в расписании | id, university_id, group_id, teacher_id, subject, room, day_of_week, start_time, end_time, week_type, start_date, end_date |
| LessonChange | Изменение пары | id, lesson_id, change_type, old_values, new_values |
| University | Вуз (с connector_config) | id, name, connector_config |

Подробнее: [architecture/data-model.md](../architecture/data-model.md).

---

## 3. API

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/schedule/my` | GET | Персональное расписание |
| `/api/v1/schedule/lessons/{id}` | GET | Детали пары |
| `/api/v1/schedule/lessons/{id}/changes` | GET | История изменений пары |
| `/api/v1/admin/schedule/upload` | POST | Загрузка файла расписания |
| `/api/v1/admin/schedule/sync` | POST | Ручной запуск синка |
| `/api/v1/admin/schedule/sync-status` | GET | Статус синхронизации |

Полный OpenAPI: [api/README.md](../api/README.md).

---

## 4. Права доступа

| Действие | Роль | Ограничение |
|----------|------|-------------|
| Просмотр расписания | student, teacher | Своё расписание |
| Просмотр расписания группы | curator, faculty_dean, department_head | Своя группа / факультет / кафедра |
| Просмотр всего расписания | university_admin | Весь вуз |
| Загрузка расписания | university_admin, department_head | — |
| Управление коннекторами | superadmin | — |

Матрица прав: [architecture/roles-and-permissions.md](../architecture/roles-and-permissions.md).

---

## 5. UX / экраны

- Экран расписания (student) — [ui/screens-student.md](../ui/screens-student.md)
- Экран расписания (teacher) — [ui/screens-teacher.md](../ui/screens-teacher.md)
- A02. Админка: загрузка расписания — [ui/screens-admin.md](../ui/screens-admin.md)

**Критичные UX-требования:**
- При недоступности источника — последнее валидное расписание с предупреждением
- Индикатор «Изменено» при наличии LessonChange
- Pull-to-refresh

---

## 6. Бизнес-правила и edge-cases

1. **Детект изменений:** сравнение при каждой загрузке → LessonChange (moved, cancelled, room_changed, teacher_changed, added)
2. **Неделя:** `week_type` — odd/even/both. Определение текущей недели по дате semester_start
3. **Каникулы:** период, когда lesson не отображаются ( start_date > today < end_date )
4. **Конфликты:** две пары в одно время для одной группы → алерт в админке
5. **Идемпотентность:** повторная загрузка не дублирует данные
6. **Откат:** возможность вернуть предыдущую версию расписания
7. **Коннекторы:** см. [architecture/connectors.md](../architecture/connectors.md)

---

## 7. События и уведомления

| Событие | Тип уведомления | Получатель |
|---------|-----------------|------------|
| Изменение расписания | Push | Студенты группы, преподаватель |
| Недоступность коннектора > 24ч | Алерт в админке | university_admin |
| Новая пара | Push (опционально) | Студенты группы |

---

## 8. Нефункциональные требования

| Требование | Значение |
|------------|----------|
| Latency | p95 ≤ 300 мс для GET /schedule/my |
| Offline | Кэш последнего расписания |
| Rate limits | Upload: 1/час на вуз |

---

## 9. Критерии приёмки

- [ ] Можно загрузить расписание СИБИТ через файл и увидеть у студентов
- [ ] При повторной загрузке система корректно определяет типы изменений
- [ ] Студент получает уведомление об изменении
- [ ] При недоступности источника показывается последнее расписание с предупреждением
- [ ] Конфликты расписания детектятся
- [ ] Чередование недель работает
- [ ] Каникулы отображаются корректно

---

## 10. Зависимости

**Зависит от:** auth (JWT, roles), admin (загрузка расписания)
**Зависимость от:** notifications (push при изменениях), pair-space (автосоздание PairSpace при новой паре)

---

## 11. Open questions / TODO

- [ ] Автоматический cron-синк расписания (параллельно ручной загрузке)
- [ ] Поддержка нескольких семестров
- [ ] Экспорт расписания в iCal
