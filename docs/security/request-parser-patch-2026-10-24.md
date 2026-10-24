# Обновление обработчиков HTTP-запросов

Дата проверки: 24 октября 2026. Текущая реализация в feature-ветке; production не изменён.

CI аналитики обнаружил два high advisory в production dependency graph:

| Зависимость | Прежняя версия | Исправленная версия | Первоисточник |
| --- | --- | --- | --- |
| body-parser | 1.20.6 | 1.20.9 | [GHSA-27r3-jxmh-p828](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828) |
| multer | 2.4.0 | 2.5.0 | [GHSA-q7qp-rjg7-q26m](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m) |

Первый дефект связан с поздней ошибкой декомпрессии тела запроса; второй — с продолжением асинхронного `fileFilter` после уничтожения multipart parser. Оба могут завершить процесс необработанным событием ошибки при условиях, описанных разработчиками. Наличие advisory не доказывает эксплуатацию конкретной установленной системы.

Корневые pnpm overrides обновлены вместе с lockfile. Frozen install выполнен в физических node_modules worktree; Nest platform-express и Express получают закреплённые версии. API, лимиты загрузки, обработчики приложения и политика audit high/critical не изменены.

## Проверка совместимости и регрессий

[E2E-тест](../../apps/backend/test/request-parser.e2e-spec.ts) запускает отдельный Node-процесс с реально установленными зависимостями Nest. В нём проверяются JSON без сжатия, gzip и deflate, нормальная multipart-загрузка, завершённый сжатый frame с лишними байтами и усечённая multipart-форма с ожидающим асинхронным фильтром. После ошибочных запросов локальный HTTP health endpoint отвечает успешно. Все запросы направлены только на случайный loopback-порт синтетического fixture.

Сценарии учитывают условия из [исправления body-parser](https://github.com/expressjs/body-parser/commit/1260c3845f54502a05a87594f09a334786bb34d7) и [исправления multer](https://github.com/expressjs/multer/commit/80a2d9df1dfd63b5fab631b8b9966164ed647adf). Дополнительный локальный контроль с прежними пакетами подтвердил падение каждого варианта: `incorrect header check` у body-parser 1.20.6 и `Unexpected end of form` у multer 2.4.0. На обновлённых пакетах тест проходит. Это подтверждение воспроизводимости fixture, а не проверка уязвимости production.

Production audit после обновления: high=0, critical=0, moderate=1. Умеренная находка Nest SSE остаётся открытой в [обзоре зависимостей](dependency-review-2026-10-22.md); major upgrade Nest этим патчем не выполняется. Audit — датированный снимок базы advisory. Linux CI и интеграционный результат фиксируются отдельно в [журнале](../project-log/improvement-progress-2026-10-22.md).

Локально прошли focused E2E, backend typecheck, root lint, docs lint, AI documentation guard и boundary guard. Runtime resolution подтвердил body-parser 1.20.9 отдельно из Nest и Express, multer 2.5.0 из Nest.

Воспроизведение из корня workspace:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand request-parser.e2e-spec.ts
pnpm audit --prod --json
```

При остаточной moderate-находке последняя команда возвращает ненулевой exit code; CI отдельно проверяет отсутствие high/critical, сохраняя полный JSON-отчёт.
