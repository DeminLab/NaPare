---
name: impeccable
description: "Текстовая адаптация Impeccable для Codex: при явном запросе critique, audit, polish, harden, adapt существующих интерфейсов NaPare."
---

# Impeccable для NaPare

Это адаптация текстовых playbooks upstream, а не установленный engine, live mode или detector. Команды, scripts, hooks, загрузка binaries и обход sandbox из upstream здесь не поддерживаются. Исходный SKILL сохранен только для атрибуции в upstream/SKILL.original.md; не выполнять его Setup.

## Порядок работы

1. Прочитать AI_CONTEXT.md и AGENTS.md; определить приложение и реальный пользовательский сценарий.
2. Проверить packages/design-tokens и packages/ui; изучить текущую композицию. Бренд НаПаре, контракт API, роли и фактические данные имеют приоритет над эстетическими рекомендациями.
3. Выбрать один соответствующий reference: critique-rubric.md для ревью, adapt.md для адаптивности, harden.md для состояний, polish.md для качества. Читать reference по задаче, не всю библиотеку.
4. Инструкции в references про launcher, shell, live, engine, Claude commands и делегирование трактовать как описание upstream. В этой адаптации выполнять анализ/правки обычными инструментами Codex; делегировать лишь при явном разрешении.
5. Проверить целевые маршруты в Playwright; в Chrome DevTools проверить console/network, измерить до/после при performance задаче. Не открывать production с персональными данными.
6. Отчет: конкретные проблемы, путь/строка, изменение, точный viewport/маршрут и фактические проверки. Если браузер недоступен — явно указать пробел.

## Критерии качества

Loading/error/empty/success, keyboard/focus, mobile layout, достаточный контраст; нет вымышленных метрик или новых библиотек без необходимости. Нарушение собственных tokens не исправлять копированием чужого дизайн-языка. Результат визуального анализа не считается доказательством работы backend.

