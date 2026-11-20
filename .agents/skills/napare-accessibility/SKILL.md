---
name: napare-accessibility
description: "Проверять и улучшать доступность конкретных интерфейсов NaPare через семантику, клавиатуру, focus, контраст и ручные assistive technology сценарии."
---

# Доступность NaPare

## Назначение и применение

Проверять и улучшать доступность конкретных интерфейсов NaPare через семантику, клавиатуру, focus, контраст и ручные assistive technology сценарии. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `docs/ui/student-wcag-audit-2026-10-22.md`
- `docs/ui/design-system.md`
- `packages/ui/src/WorkspaceShell.tsx`
- `packages/design-tokens/styles.css`
- `apps/web-student/src/components/ui/Modal.tsx`
- `apps/web-student/src/components/ui/RequestState.tsx`

## Рабочий процесс

1. Выберите изменённые routes, действия и текущие дефекты. Dated WCAG audit — входная информация, не текущая гарантия соответствия.
2. Проверьте DOM семантику: landmark/headings, реальные button/link, label/description/error, accessible names и reading order.
3. Пройдите keyboard без мыши: focus-visible, порядок tab, drawer/menu/modal, Escape и возврат focus; background диалога не должен оставаться интерактивным.
4. Проверьте контраст токенов во всех состояниях, zoom, длинные русские строки, mobile touch, reduced motion и сообщение статуса loading/error.
5. Внесите минимальное исправление в shared component при общей причине; проверьте потребителей и отсутствие нарушения навигации.
6. Выполните browser automation и ручной сценарий screen reader, если он доступен; результаты и непроверенные assistive technologies перечислите явно.

## Правила разработки

- Автоматический audit не доказывает WCAG conformance; keyboard и смысловое чтение проверяются отдельно.
- Не добавляйте aria-role поверх корректной native семантики и не скрывайте интерактивное aria-hidden.
- Скрытый/disabled по правам элемент должен соответствовать реальным API ограничениям, доступность не расширяет доступ.

## Типичные ошибки

- Удалить outline ради дизайна или закрыть modal без возвращения focus.
- Считать цвет достаточным обозначением ошибки/статуса либо обновить текст без доступного announcement.

## Критерии качества и проверка

- [ ] Keyboard happy/error flow, focus trap/return и accessible names проверены.
- [ ] Контраст, zoom/reflow и mobile; live regions для важных динамических статусов.
- [ ] Typecheck/lint + браузер потребителей; manual screen reader gaps отделены от automated results.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

В WorkspaceShell command palette проверьте открытие клавишей, выбор результата, Escape и возврат focus в инициатор; network error должен читаться как ошибка.

## MCP и внешние инструменты

Playwright — keyboard/roles/snapshots и viewport; Chrome DevTools — accessibility tree, contrast и rendering. Figma contrast/design проверка не заменяет runtime. При нормативном утверждении используйте актуальную первичную WCAG документацию. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

