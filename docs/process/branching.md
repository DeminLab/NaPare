# Ветвление

Текущая конфигурация репозитория использует `main`. Pull request CI запускается для PR в `main`; push в `main` запускает staging workflow. Отдельная ветка `develop` и автоматический production deployment workflow не настроены как действующий процесс.

## Workflow

1. Создать ветку от актуального `main` (или явно указанной базовой ветки): `git switch -c codex/my-change main`.
2. Внести изменения и выполнить относящиеся к задаче проверки.
3. При необходимости обновить базу: `git fetch origin; git rebase origin/main`.
4. Push ветки и создать PR в `main`.
5. Пройти проверки CI и review requirements, настроенные в GitHub.
6. После merge push в `main` запускает staging workflow.

## Настройки, задаваемые в GitHub

Наличие workflow в репозитории не подтверждает branch protection, число обязательных approvals, restrictions на force push или deployment reviewers. Проверяйте эти настройки в GitHub repository settings.

Production deployment не автоматизирован; используйте [docs/deployment/production.md](../deployment/production.md) и серверный runbook.

## См. также

- [Contributing](contributing.md)
- [CI/CD](../ops/cicd.md)
