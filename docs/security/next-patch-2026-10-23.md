# Патч Next.js и повторный dependency gate

Дата: 23 октября 2026. Scope: локальная интеграционная ветка и её runtime dependencies; main/production не изменяются.

Повторный `pnpm audit --prod --json` обнаружил новые записи Next.js для 15.5.27: [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), critical image optimization, и [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), high Server Actions DoS. Обе карточки GitHub Reviewed опубликованы/обновлены в базе 22 октября; для ветки 15.5 исправленная версия — **15.5.28**. Ранее зелёный audit — исторический снимок до появления этих записей, а не доказательство постоянного отсутствия уязвимостей.

В root `package.json` добавлен единый pnpm override `next: 15.5.28`; lockfile пересчитан pnpm. Это соответствует существующей корневой политике security overrides и обеспечивает одинаковую версию всех шести Next-приложений, включая legacy web. Локальные app-манифесты могут сохранять декларацию 15.5.27; фактическая версия определяется workspace override и frozen lockfile. Для воспроизведения использовать pnpm из корня workspace.

Чистый `pnpm install --frozen-lockfile --ignore-scripts` выполнен в независимом физическом node_modules интеграционного worktree; через junction установка не запускалась. Runtime resolution подтвердил 15.5.28 у web/student/staff/admin/developer/portal; TypeORM identity backend/Nest остаётся единой. Изменения lockfile ограничены Next/env/SWC и их snapshot references.

Vendor указывает Sharp >=0.35.5 как workaround для image issue; такой override уже присутствовал до этой находки. Поэтому запись audit сама по себе не доказывает эксплуатацию проекта. Для Server Actions vendor рекомендует обновление; фактические инциденты и exploitability deployment здесь не исследовались. Вредоносные запросы или изменения внешних систем не выполнялись.

## Проверки

Общий typecheck шести workspace targets прошёл. Новый production audit: high=0, critical=0, moderate=1. Локальный student build прошёл компиляцию/типы и завершился exit 1 на Windows standalone symlink EPERM; после этого последовательный запуск остальных четырёх приложений остановлен. Это не подтверждение Linux packaging. Legacy web получает тот же patch runtime, но не входит в стандартный root build и отдельным browser-прогоном не подтверждён.

CI pull-request gate теперь допускает базы `main` и `codex/**`, сохраняя состав тестов, dependency policy и минимальные permissions. Это запускает тот же Linux build/typecheck/unit/E2E/lint/audit для вложенных feature PR. Результат конкретного Linux run фиксируется отдельно после завершения; Windows ошибка не маскируется сменой output config.

На `89f9443` [Linux CI 39829488440](https://github.com/DeminLab/NaPare/actions/runs/39829488440) завершил все шесть jobs успешно, включая production application build и обязательный Backend E2E. Это подтверждение Linux pipeline конкретного исходного commit, не deployment.

Локальный Next **15.5.28** dev runtime дополнительно прошёл 42 axe-снимка (36 светлых + 6 целевых тёмных) с API fixtures/serviceWorkers=block: violations=0, page errors=0, overflow=false. В 111 node instances axe оставил incomplete для ручной проверки; они не считаются passed. Server HTML titles 16 маршрутов и profile/appearance/preferences save status, keyboard/client/back/forward/search проверены повторно. Полное AA, native device и live backend/external providers этим прогоном не подтверждены.

CI policy сохраняется: production high/critical должны быть нулевыми. Умеренная Nest SSE находка и отдельные high/critical dev-tool findings не объявляются устранёнными этим Next-патчем. [Совместный журнал](../project-log/improvement-integration-2026-10-22.md) отделяет эти ограничения от выполненных feature-проверок.
