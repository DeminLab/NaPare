---
name: napare-social
description: "Разрабатывать обсуждения, объявления, материалы, реакции и уведомления NaPare в существующих учебных scope с защитой доступа и модерацией."
---

# Социальные сценарии NaPare

## Назначение и применение

Разрабатывать обсуждения, объявления, материалы, реакции и уведомления NaPare в существующих учебных scope с защитой доступа и модерацией. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `apps/backend/src/pair-space/pair-space.controller.ts`
- `apps/backend/src/pair-space/pair-space.service.ts`
- `apps/backend/src/pair-space/entities/discussion-message.entity.ts`
- `apps/backend/src/pair-space/entities/announcement.entity.ts`
- `apps/backend/src/platform-discussions`
- `apps/backend/src/notifications`
- `docs/modules/pair-space.md`
- `docs/integrations/notification-delivery.md`

## Рабочий процесс

1. Уточните социальный сценарий и его аудиторию: участники занятия/группы, автор, преподаватель, куратор или platform moderation. Найдите существующий PairSpace до создания новой социальной модели.
2. Проследите lesson/subject timeline scope, organizationId и ownership для чтения, создания, редактирования и удаления. Каждая ссылка на attachment/message проверяется отдельно.
3. Для текста/файлов используйте DTO limits, безопасное отображение, upload policy и порядок pagination. Не раскрывайте личную заметку как общую дискуссию.
4. Проектируйте moderation/audit и archive/delete поведение по текущей политике; не добавляйте публичные профили/поиск студентов без требования.
5. Интегрируйте существующий notifications/outbox с idempotency; external delivery флаги и opt-in не обходятся. UI должен различать сохранено/уведомление запланировано/доставлено.
6. Проверьте несколько пользователей одного scope, чужую группу/организацию, удалённый доступ, empty/error и длинный контент; обновите документ модуля.

## Правила разработки

- Социальная функция не отменяет учебную tenant/role границу; публичная лента требует отдельного продуктового решения.
- Не отправляйте тела сообщений/файлов/имена студентов в telemetry, Sentry, Figma или MCP.
- Не обещайте delivery по HTTP успеху сохранения сообщения; отслеживайте фактический канал и статус.

## Типичные ошибки

- Проверить принадлежность PairSpace, но принять чужой attachment ID или открыть timeline всей организации.
- Выдать moderator/platform grants университетскому пользователю по совпадающему названию роли.

## Критерии качества и проверка

- [ ] pair-space controller/service specs и HTTP A/B controls на изолированной БД.
- [ ] Sanitization/rendering, pagination, duplicate submit и revoked access.
- [ ] Browser flow двух разрешённых synthetic пользователей + отказ чужой группе; notification opt-in/delivery boundary отмечены.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

Обсуждение предмета в timeline должно показывать только доступные занятия/материалы; personal-lesson-note остаётся личной и не попадает в общий ответ.

## MCP и внешние инструменты

Playwright — двухпользовательский synthetic flow; DBHub — read-only сверка synthetic scope; Sentry — обезличенная диагностика; Context7 — применяемая sanitizer/upload библиотека. Внешняя отправка сообщений требует явного пользовательского разрешения. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

