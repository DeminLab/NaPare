# Совместная работа над НаПаре

## Источники правды

- Репозиторные правила: root AGENTS.md и [AI_CONTEXT](../AI_CONTEXT.md).
- Текущая архитектура/границы: [project map](ai/project-map.md), code, manifests, Compose и актуальные docs.
- Текущие API contracts: NestJS Swagger /api/v1/docs-json; не использовать устаревший ручной endpoint catalogue.
- Схема БД: TypeORM entities и migrations.
- Операционный запуск: root docs/deployment/production.md.
- superpowers/specs, superpowers/plans и project-log относятся к датированным инициативам и хронологии; сами по себе они не определяют текущий backlog или состояние production.

## Рабочий процесс

Для изменения API, доступа или схемы обновляйте соответствующий контракт/описание и код в одной reviewable change. Добавляйте или корректируйте проверки поведения в соответствии с изменением. Для UI обновляйте актуальный экранный/клиентский документ. Для Docker, deployment или переменных окружения синхронизируйте docs/deployment/production.md, README/onboarding и workflow reference.

Перед push выполните обязательные repository checks из docs/ai/change-safety.md. В отчёте укажите команды и их реальные результаты; конфигурационная проверка не подтверждает production health.

## Безопасная работа

- Не добавляйте секреты, заполненные .env, диагностические bundles или build output.
- Не меняйте protected paths вопреки root AGENTS.md.
- Для изменения access control проверяйте позитивные и негативные cases.
- Не публикуйте legal drafts как утверждённые документы.

См. [contributing](process/contributing.md), [definition of done](process/definition-of-done.md) и [documentation guide](DEVELOPER_GUIDE.md).
