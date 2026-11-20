# Проверка установки NaPare AI DevKit

Дата: 19 ноября 2026 года. Работы выполнены локально в Windows checkout `C:/Users/home/NaPare`. Это результат настройки инженерной среды, не аудит всего исходного кода и не подтверждение production-готовности NaPare.

## Итог по инструментам

| Инструмент | Финальный статус | Подтверждение / граница |
| --- | --- | --- |
| Superpowers | Установлены и проверены 15 Skills | Пины, SHA, metadata, fresh install; engines/hooks не выполнялись |
| UI/UX Pro Max | Существующая установка сохранена | Discovery/integrity наличия; текущий upstream commit прежних файлов не подтверждён; fresh fallback проверен |
| Impeccable | Установлена адаптация Skill | Текстовый review, без live engine и обхода sandbox |
| Vercel Agent Skills | 3 прежних Skills сохранены, composition добавлен | Пины новых файлов, fresh fallback всех Skills проверен |
| Matt Pocock Skills | Установлены 6 релевантных Skills | Metadata, SHA, fresh install |
| Trail of Bits Skills | Установлены 5 релевантных Skills | Metadata, SHA, fresh install; это не выполненный security audit продукта |
| Taste Skill | Установлена адаптация | Убраны конфликтующие с NaPare предписания, нет hooks/generators |
| Anthropic Frontend Design | Установлена адаптация | Отдельное имя anthropic-frontend-design; существующий frontend-design сохранён |
| PR Review Toolkit | Установлена текстовая адаптация | 6 review-направлений, источник перенесён в claude-plugins-official; Claude agent engine не установлен |
| Context7 | Установлен и проверен | Настоящий resolve-library-id для Next.js |
| Playwright MCP | Установлен и проверен | Изолированный Chrome, synthetic fixture и button interaction |
| Chrome DevTools MCP | Установлен и проверен | Изолированный Chrome, DOM, network, console |
| DBHub | Установлен и проверен | Отдельный PostgreSQL 18.3, synthetic-only, SQL ACL и readonly |
| GitHub MCP | Подготовлен, требует токен | Без токена прямой initialize endpoint вернул HTTP 401; запись выключена header |
| Figma MCP | Подготовлен, требует OAuth | Неавторизованный initialize; макеты не читались |
| Sentry MCP | Подготовлен, требует OAuth | Неавторизованный initialize; события не читались |
| Next.js DevTools MCP | Несовместим, отключён | Next.js 16+ требуется для runtime; NaPare 15.5.28; пакет не оставлен в runtime |
| 20 Skills NaPare | Созданы, обнаружены Codex | app-server skills/list, enabled=true, ошибок нет |
| 12 ролей | Настроены; runtime проверен частично | TOML valid; prompt-role code-reviewer прошёл, native selector недоступен |

Выбраны совместимые подмножества сторонних наборов, а не все Skills каждого большого репозитория. Native plugin CLI проверен, но его проектный scope отсутствует в установленной версии; выбран project vendoring. Подробности и официальные источники: [vendor-skills.md](vendor-skills.md), [mcp.md](mcp.md).

## Реальные проверки

- 20 Skills: `quick_validate.py` через `py -X utf8` — 20/20; реальные ссылки на исходный код проверены. Markdownlint собственных Skills и документации прошёл.
- `node scripts/ai-devkit/verify.mjs`: metadata 70 доступных локальных Skills, 12 agent contracts, TOML, ссылки, SHA новых vendor-файлов, поиск типовых секретов — ошибок нет. Четыре сохранённых Skills явно предупреждают об отсутствии доказательства их текущего upstream SHA. Проверка секретов эвристическая, не доказательство отсутствия любых возможных секретов.
- `install-vendor-skills.py --check` и повторная установка — passed. Полный fresh install 35 Skills из 9 GitHub-источников без cache в отдельном temp root — passed, 75,2 секунды; metadata, SHA, повторный запуск и offline check прошли. Проверены сохранение изменённых файлов при конфликте и отказ от path traversal. Детали: [vendor-verification.json](vendor-verification.json).
- Npm runtime установлен с `--ignore-scripts`; `npm audit --omit=dev --audit-level=high` после исключения несовместимого Next DevTools — **0 info/low/moderate/high/critical** по полученному npm advisory snapshot. Установщик сторонних plugins/hooks не выполнялся.
- `smoke-mcp.mjs`: четыре локальных MCP реально запускались. DBHub проверяет результат SQL, а не только наличие tools. Remote OAuth/token подключения не объявлены работающими.
- `pnpm lint`, `node scripts/verify-role-workspace-boundaries.cjs` и итоговый `pnpm typecheck` всех шести активных TypeScript-приложений — passed. Typecheck прошёл после восстановления generated cache, описанного ниже.
- Полный `./scripts/ai-devkit/install.ps1 -StartTestDatabase -Smoke` после исправлений — exit 0; повторная установка и все четыре локальных MCP прошли, три удалённых подключения честно отмечены requires_authorization. Машиночитаемый результат: [verification-results.json](verification-results.json).
- `git diff --check` проверяет tracked diff; новые файлы отдельно прошли профильные проверки. Полный перечень поставляемых файлов: [changed-files.txt](changed-files.txt).

## Исправленные проблемы установки

1. `python` не находится в PATH: Windows bootstrap использует существующий `py`, Linux — python3.
2. `.agents/` и `.codex/` целиком игнорировались: добавлены точные исключения для управляемых файлов, локальные credentials/hooks не включены.
3. `core.autocrlf=true` мог ломать vendor SHA: `.gitattributes` закрепляет LF для Skills и адаптеров.
4. DBHub 2.0 требует readonly в `[[tools]]`, а не `[[sources]]`; конфигурация исправлена и проверена на настоящем SELECT.
5. Chrome DevTools 1.13 требует pageId; smoke извлекает ID созданной fixture-страницы.
6. `pg_ctl` в Windows удерживал унаследованный PIPE: заменено на файловый вывод. Повторная инициализация кластера не сбрасывает данные.
7. Первоначально поставленный Next DevTools 0.4.0 подтягивал устаревшие SDK/Zod с high advisories. Для несовместимого Next.js 15 этот необязательный пакет удалён вместо принудительного major override; финальный npm audit чист.
8. SQL-ответ DBHub включает исходный SQL: проверка ACL разбирает возвращённую строку результата, чтобы текст запроса не влиял на итог smoke.
9. У портала обнаружены старые `.next/types/app/about` и `owner`, ссылающиеся на отсутствующие страницы. `next typegen` обновил validator, но не удалил старые файлы. Два генерируемых каталога обратимо перенесены в игнорируемую `.cache/ai-devkit/stale-portal-route-types/`; бизнес-код не менялся.

## Оставшиеся действия и границы

Владельцу аккаунтов нужно авторизовать GitHub, Figma, Sentry по [mcp.md](mcp.md), затем открыть новый чат. Клиент может запросить project trust или подтверждение OAuth; ограничения клиента не обходились. При переносе на другую машину нужны установленные Chrome и PostgreSQL binaries; bootstrap сообщает об отсутствии prerequisites, а не скачивает неподтверждённый installer.

Существующий глобальный Neon plugin имеет предупреждение о невалидном manifest; он не изменён. PowerShell snapshot не поддерживается текущим CLI. Описания Skills ограничены бюджетом контекста; 20 проектных Skills фактически доступны. Подробнее: [codex-verification.md](codex-verification.md).

Production, рабочая БД, интерфейсы и бизнес-логика не изменялись. Unit/E2E и полная production-сборка приложений в этой задаче не запускались; новые MCP проверены на изолированном fixture. Внешний CI не запускался, push/deployment не выполнялись. Нативный запуск всех 12 профилей и авторизованные действия remote MCP остаются неподтверждёнными.
