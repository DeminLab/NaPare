# Worklog: MAX Hackathon MVP

## Контекст

Цель — заявка «НаПаре» в треке «Образовательные решения» студенческого хакатона MAX. Целевой продукт — MAX Mini App для студента; web-панели остаются рабочими местами сотрудников и администраторов.

## Внешние требования

| Источник | Зафиксированное требование | Последствие для проекта |
| --- | --- | --- |
| `https://hackrus.ru/129201` | Решение — чат-бот или Mini App MAX в образовательном треке | Нужен реальный `apps/max-miniapp`, а не только student-web |
| `https://dev.max.ru/docs/webapps/introduction` | Mini App работает по HTTPS и запускается через бот | Нужны production static build, HTTPS deployment URL и deep link |
| `https://dev.max.ru/docs/webapps/bridge` | `initData` проверяется на сервере; `initDataUnsafe` не используется для авторизации | MAX Bridge только передаёт launch data в backend validation endpoint |
| `https://dev.max.ru/docs/legal/requirements` | Политика конфиденциальности, безопасная обработка данных, корректные ошибки | Нужны legal links, безопасные API-границы и error states |

## Подтверждённые блокеры

| Приоритет | Проблема | Статус |
| --- | --- | --- |
| P0 | `apps/max-miniapp` отсутствует, хотя упоминается в документации | Закрыто: Vite MVP добавлен; MAX deployment/auth остаются blocker |
| P0 | API отсутствий не соответствует Entity; создать запись невозможно | Закрыто в Task 1 |
| P0 | Отсутствия и mutation-маршруты доступны без достаточной авторизации | Частично закрыто в Task 1 и Task 2; ownership lesson/group требует модели полномочий |
| P0 | Файлы PairSpace не имеют download action | Закрыто в Task 3 для HTTPS-файлов |
| P1 | Shared API client расходится с `/api/v1` и `{data, meta}` | Task 3 |
| P1 | Next.js/dependency audit содержит critical/high уязвимости | Отдельная compatibility/security поставка |

## Решения

- Не выполнять массовый upgrade Next.js внутри hackathon MVP: это отдельная высокорисковая миграция.
- Все write-операции проверяют роль, вуз, группу и владельца записи; UUID не является полномочием.
- В MAX Mini App сначала реализуются Today, lesson space, download materials и absence submission.

## Статус

- 2026-09-16: план и дизайн созданы; визуальный эталон Today сгенерирован и зафиксирован в рабочем диалоге.
- 2026-09-16: Task 1 — DTO отсутствия приведён к Entity; студент создаёт только свою запись, staff подтверждает/оправдывает; 2 suites / 11 tests, backend build — passed.
- 2026-09-16: Task 2 — write-маршруты schedule и PairSpace ограничены staff roles; PairSpace также проверяет identity автора и вуз; 4 suites / 17 tests, backend build — passed. Нужна отдельная модель assignment/group ownership для ограничения сотрудника конкретной группой.
- 2026-09-16: Task 3 — web-student получил форму отсутствия и безопасную HTTPS-ссылку на материал; `tsc --noEmit` — passed.
- 2026-09-16: Task 4 — добавлен `apps/max-miniapp`: MAX Bridge wrapper с fallback, responsive Today flow и demo absence flow; 2 tests / Vite production build — passed. Публикация и MAX auth заблокированы отсутствием platform token, HTTPS URL и backend initData validation endpoint.
- 2026-09-16: финальная локальная валидация — backend 18 suites / 71 tests и Nest build passed; web-student `tsc --noEmit` passed; MAX 2 tests и Vite production build passed; `docker compose ... config --quiet` passed. После установки с `--ignore-scripts` восстановлен только нативный binding `bcrypt`; исходный код и lockfile не менялись этим восстановлением.
- 2026-09-16: MAX Mini App добавлен в `docker-compose.prod.yml` как `max-miniapp` на `http://localhost:3005`; образ и healthcheck прошли. Runtime образ намеренно отдаёт проверенный Vite `dist`, поэтому перед Docker build обязателен production build клиента.
- 2026-09-16: повторная проверка перед handoff — backend 18 suites / 71 tests, Nest build, web-student typecheck, MAX 2 tests / production build прошли; `max-miniapp` healthy и отвечает HTTP 200 на `localhost:3005`.
- 2026-09-16: для команды из трёх разработчиков добавлен `docs/DEVELOPER_GUIDE.md`: карта документов, критерии выбора файла, обязательное содержимое и формат handoff/worklog.
- 2026-09-16: quick release-audit — backend 18 suites / 71 tests, Nest build, lint, typecheck 4 Next clients, MAX 2 tests / Vite build и Docker HTTP checks прошли. Backend наружу не публикуется на `localhost:3000` по проектному compose-design; публичный health endpoint `http://localhost/api/v1/health` отвечает 200. `pnpm audit --prod` выявил 3 critical и 30 high; основные пакеты: `next`, `tar`, `multer`, `lodash`, `js-yaml`. Нужна отдельная dependency/security migration, без массового upgrade в текущей поставке.
- 2026-09-16: добавлен `docs/SHARING_BUNDLE.md`; share-archive исключает секреты, generated artifacts, `.git` и временную `.update_stage`.
