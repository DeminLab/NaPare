# Contributing

## Development Setup

```bash
# 1. Клонировать
git clone https://github.com/napare/napare.git
cd napare

# 2. Инфраструктура
docker compose up -d

# 3. Backend
cd apps/backend
cp .env.example .env
pnpm install
pnpm run start:dev

# 4. Web
cd ../web
pnpm install
pnpm run dev

# 5. Mobile
cd ../mobile
flutter pub get
flutter run
```

---

## Commit Messages (Conventional Commits)

| Префикс | Значение | Пример |
|---------|----------|--------|
| `feat:` | Новая функциональность | `feat: add user profile screen` |
| `fix:` | Исправление бага | `fix: resolve schedule conflict detection` |
| `docs:` | Обновление документации | `docs: update API documentation` |
| `refactor:` | Рефакторинг | `refactor: extract auth service` |
| `test:` | Тесты | `test: add unit tests for absences` |
| `chore:` | Поддерживающие изменения | `chore: update dependencies` |
| `ci:` | CI/CD | `ci: add staging deploy step` |

---

## Branch Naming

| Префикс | Назначение | Пример |
|---------|------------|--------|
| `feature/` | Новая функциональность | `feature/pair-space-tabs` |
| `fix/` | Исправление бага | `fix/sms-code-expiry` |
| `docs/` | Документация | `docs/add-seed-data` |
| `refactor/` | Рефакторинг | `refactor/extract-api-client` |
| `test/` | Тесты | `test/e2e-registration-flow` |

---

## PR Process

1. Создать branch от `develop`
2. Написать код
3. Написать/обновить тесты
4. Обновить документацию модуля (`modules/*.md`)
5. Обновить OpenAPI (если изменился API)
6. Submit PR в `develop`
7. Получить ≥ 1 review
8. Merge (squash)

---

## PR Checklist

- [ ] Код проходит linting
- [ ] Все тесты зелёные
- [ ] Документация модуля обновлена
- [ ] OpenAPI обновлён (если API изменился)
- [ ] Нет секретов в коде
- [ ] Нет конфликтов с `develop`

---

## Code Style

| Язык | Инструмент |
|------|------------|
| TypeScript | ESLint + Prettier |
| Flutter | dartfmt + pana |

---

## См. также

- [process/definition-of-done.md](definition-of-done.md)
- [process/branching.md](branching.md)
- [process/ownership.md](ownership.md)
