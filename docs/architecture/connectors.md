# Коннекторы расписания

## Назначение

Слой коннекторов обеспечивает получение расписания из внешних источников и приведение к единой модели `NormalizedLesson`. См. [ADR-0006](../03_DECISIONS/0006-connectors-layer.md).

---

## Интерфейс коннектора

```typescript
interface ScheduleConnector {
  id: string;
  universityId: string;
  fetchSchedule(period: { from: Date; to: Date }): Promise<NormalizedLesson[]>;
  healthCheck(): Promise<{ ok: boolean; lastSuccessAt?: Date; error?: string }>;
}
```

---

## Внутренняя модель

```typescript
interface NormalizedLesson {
  externalId: string;        // ID во внешней системе
  universityId: string;
  groupId: string;
  teacherId?: string;
  subject: string;
  room?: string;
  dayOfWeek: number;         // 1=Пн, 7=Вс
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  weekType: 'odd' | 'even' | 'both';
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
}
```

---

## Приоритеты MVP

| # | Коннектор | Тип | Статус |
|---|-----------|-----|--------|
| 1 | Excel/CSV импорт | Ручной | MVP |
| 2 | Парсер СИБИТ | HTML + cron | MVP |
| 3 | iCal | Формат | После MVP |
| 4 | Moodle | LMS | Позже |
| 5 | РУЭ | Гос. система | Позже |

---

## Детект изменений

При каждом обновлении расписания backend сравнивает новые данные со старыми:

| Тип изменения | Описание | Пример |
|---------------|----------|--------|
| `moved` | Пара перенесена | Понедельник 10:00 → Вторник 14:00 |
| `cancelled` | Пара отменена | — |
| `room_changed` | Смена аудитории | ауд. 305 → ауд. 201 |
| `teacher_changed` | Смена преподавателя | Иванов → Петров |
| `added` | Новая пара | — |

Каждое изменение фиксируется в `lesson_changes` и генерирует уведомление.

---

## Админка: загрузка расписания

1. Админ загружает файл (Excel / CSV / iCal)
2. Система показывает маппинг колонок (гибкий)
3. Предпросмотр перед импортом
4. Импорт → детект изменений → push студентам

---

## Health check

Каждый коннектор имеет метод `healthCheck()`. Результаты отображаются в админке:

| Статус | Значение |
|--------|----------|
| ✅ OK | Последний успешный синк < 24 часов |
| ⚠️ Warning | Последний успешный синк 24–72 часа |
| ❌ Error | Последний синк > 72 часа или ошибка |

---

## Нефункциональные требования

- Идемпотентность обновлений (повторная загрузка не дублирует данные)
- Устойчивость к частично битым данным
- Возможность отката к предыдущей версии
- Обновление одного вуза не блокирует систему
- Мониторинг успешности синка (алерты в Sentry + Grafana)

---

## Добавление нового коннектора

1. Создать класс, реализующий `ScheduleConnector`
2. Привести данные к `NormalizedLesson`
3. Зарегистрировать в `ScheduleModule`
4. Добавить конфигурацию в `universities.connector_config`
5. Написать unit-тесты
6. Обновить этот файл

---

## См. также

- [modules/schedule.md](../modules/schedule.md) — модуль расписания
- [database/schema-overview.md](../database/schema-overview.md) — таблицы lessons, lesson_changes
