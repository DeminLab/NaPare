# Обзор продукта

## Что это

**НаПаре** — операционная система учебного дня студента.  
Один экран вместо десяти разрозненных источников: расписание, изменения, задания, материалы, обсуждения и отсутствия — всё вокруг конкретной пары.

**Статус:** продуктовый scope/hypotheses; таблица реализации ниже показывает текущее состояние репозитория, а не обещание доступности production.

## Клиентские поверхности

| Клиент | Платформа | Аудитория | Приоритет |
|--------|-----------|-----------|-----------|
| **Student web/PWA** | Next.js, браузер/PWA | Студенты | Реализованная web-поверхность |
| **Staff web** | Next.js, браузер | Преподаватели и сотрудники | Реализованная web-поверхность |
| **University admin web** | Next.js, браузер | Администраторы вуза | Реализованная web-поверхность |
| **Developer web** | Next.js, браузер | Операции платформы | Реализованная web-поверхность |
| **Portal / MAX entry** | `web-portal`, браузер или MAX WebView | Вход и привязка аккаунта | MAX production setup требует внешней конфигурации |
| **Native mobile app** | iOS / Android | Студенты, преподаватели | Целевое направление; Flutter-приложения нет |

Для MAX используется `web-portal`; отдельный legacy-каталог `apps/max-miniapp` не включён в обычную сборку и не является deployed client. Проверяйте Nginx route в актуальном `DEPLOY.md`. Bot configuration и реальные MAX launches требуют проверки на стороне платформы.

## Ключевые модули MVP

| Модуль | Описание | Документ |
|--------|----------|----------|
| Расписание | Получение + детект изменений | [modules/schedule.md](../modules/schedule.md) |
| Пространство пары | Объявления, ДЗ, файлы, обсуждение | [modules/pair-space.md](../modules/pair-space.md) |
| Отсутствия | Статусы + дашборд куратора | [modules/absences.md](../modules/absences.md) |
| Мой день | Персональная сводка | [modules/my-day.md](../modules/my-day.md) |
| Уведомления | Push + in-app | [modules/notifications.md](../modules/notifications.md) |
| Роли и доступ | 8 ролей | [architecture/roles-and-permissions.md](../architecture/roles-and-permissions.md) |

## Что НЕ входит в MVP

- AI-сводки
- Модуль занятости и конфликтов
- Сложная аналитика
- White-label
- Множество коннекторов (только СИБИТ + Excel/CSV)

## Пилот

- Вуз: СИБИТ (Омск)
- 1–2 реальные группы
- Цель: доказать привычку ежедневного использования

---

## См. также

- [strategy/vision.md](../strategy/vision.md) — видение
- [product/personas.md](personas.md) — персоны
- [product/success-metrics.md](success-metrics.md) — метрики
