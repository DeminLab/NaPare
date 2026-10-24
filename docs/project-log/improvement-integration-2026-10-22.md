# Совместная проверка улучшений — 22 октября 2026

Документ для ревьюера интеграционной ветки `codex/improvement-integration` (PR 13). Ветка объединяет изменения PR 1–12 и 14–33 на базе `6f28912`; это кандидат для совместного ревью, не deployment и не утверждение полного выполнения [плана](improvement-plan-2026-10-22.md).

## Добавление 25 октября: отказ вместо 500 при чужом homework

[PR 33](https://github.com/DeminLab/NaPare/pull/33), `f74dac5`, включён после [успешного CI](https://github.com/DeminLab/NaPare/actions/runs/40122303479), все шесть jobs. Недоступный parent PairSpace больше не разыменовывается при progress/legacy-submit: чужой запрос получает 404 до записи, успешные контракты своего вуза сохраняются. Исходный код воспроизводил четыре 500; исправленный локальный suite — 92 HTTP/PG passed, включая снимки обоих вузов и связанных progress/submission строк. 32 существующих unit-теста Pair Space и backend typecheck/lint/docs/guards также прошли. Матрица 12 PairSpace routes — выбранные контексты, не полный P0-1; legacy submit не вводится как новый UI workflow.

## Добавление 25 октября: academic/schedule HTTP boundaries

[PR 32](https://github.com/DeminLab/NaPare/pull/32), `4f2daf2`, включён после [успешного CI](https://github.com/DeminLab/NaPare/actions/runs/40121701767), все шесть jobs. 88 локальных HTTP/PG сценариев; предметная матрица 15 academic и 9 schedule объявлений: положительные контроли Б, отрицательные ссылки, отсутствие частичных строк обоих вузов, списки/фильтры и область создания из JWT. Date/my/range отдельно проверены студентами и преподавателями с внутренними UUID групп. Это выбранные роли/состояния, не все маршруты/legacy numeric/SIBIT/платформенные ветки.

## Добавление 25 октября: сверка всего плана и PR

[PR 31](https://github.com/DeminLab/NaPare/pull/31), `a737e15`, включён после [успешного CI](https://github.com/DeminLab/NaPare/actions/runs/40120844652), все шесть jobs. [Аудит доказательств](improvement-evidence-audit-2026-10-25.md) сверяет каждый блок, head SHA опубликованных PR, ancestry и фактический исторический CI. Актуальная сводка в начале журнала отделена от истории запусков. Открытые бизнес-, device-, операторские и юридические результаты перечислены явно; цель не объявлена достигнутой.

## Добавление 25 октября: актуализация закупочных материалов

[PR 30](https://github.com/DeminLab/NaPare/pull/30), `24520fe`, включён после [успешного CI](https://github.com/DeminLab/NaPare/actions/runs/40120344609), все шесть jobs. [Карточка продукта и ТЗ](../procurement/README.md) приведены к фактически реализованным возможностям с приёмочными сценариями и границами доказательств. Цены/реквизиты/налоговый режим ждут данных пользователя. Повторная проверка официального портала реестра не получила полный актуальный текст; соответствие и подача не заявляются.

## Добавление 25 октября: процедура внешних копий

[PR 29](https://github.com/DeminLab/NaPare/pull/29), `cd21103`, включён после [успешного CI](https://github.com/DeminLab/NaPare/actions/runs/40119974434), все шесть jobs. Подготовлена [операторская процедура](../privacy/external-copies-procedure.md) для файлов/источников/внешних сообщений/логов/очередей/финансовых записей/backup, доказательств и карантина восстановления до сверки последующих удалений. Это спецификация по коду: реальная обработка, юридическое утверждение и offsite drill не выполнены; административного replay API нет. Пользователь предоставит коммерческие реквизиты, тарифы и налоговый режим позже.

## Добавление 25 октября: предметные проверки изоляции

[PR 28](https://github.com/DeminLab/NaPare/pull/28), `382a204`, включён fast-forward после [успешного CI](https://github.com/DeminLab/NaPare/actions/runs/40119582581), все шесть jobs. 67 настоящих JWT/HTTP/PostgreSQL сценариев с успешными контролями Б, отдельными копиями для изменяющих методов и сверкой tenant-строк/связанного контента. Дополнены списки/фильтры/посещаемость/metadata файлов и личные уведомления; API-контракты сохраняются. [Область и ограничения](../security/business-tenant-probes-2026-10-25.md): это не доказательство всех 375 объявлений маршрутов, полная сверка P0-1 остаётся открытой.

## Добавление 25 октября: клиент WebPush

[PR 27](https://github.com/DeminLab/NaPare/pull/27), `a22662b`, включён fast-forward после [успешного CI 131](https://github.com/DeminLab/NaPare/actions/runs/40118625370): все шесть jobs, включая полный E2E и Linux production build. Экран портала, явный opt-in, отдельный worker, self API, миграция 43, атомарный отзыв при logout и очистка после удаления аккаунта. Две настоящие HTTP/PG гонки проверяют невозможность восстановления отозванного разрешения.

Локально: 11 HTTP/PG, 5 export regressions, 505 unit и 12 affected unit после последней правки, 4646 guard probes, backend/portal typecheck, lint/docs/guards. Browser использовал настоящий Next/Nest/PG и service worker, проверил основной сценарий, ошибки, смену аккаунта и удаление, keyboard/четыре ширины/scoped axe без находок. Permission/PushManager и provider были подменены. [Реальные устройства и внешняя доставка остаются открытыми](../clients/webpush.md); отправка default-off, main/production не менялись.

## Добавление 24 октября: контингент и подтверждённые реестры долгов

[PR 26](https://github.com/DeminLab/NaPare/pull/26), `dfcdc4c`, включён fast-forward после [успешного CI](https://github.com/DeminLab/NaPare/actions/runs/40082067624): все шесть jobs, включая полный Backend E2E и Linux production build. Предшествующий интеграционный `47ad066` также прошёл [общий CI](https://github.com/DeminLab/NaPare/actions/runs/40080034532).

Отчёты текущих активных аккаунтов, подтверждённые полные снимки задолженностей групп, атомарная история/повтор импорта, office/dean scope, source coverage и CSV текущей страницы. FORCE RLS migration42, собственный export и сохранение учебного архива под кодом. 11 новых настоящих JWT/HTTP/PG, 14 office regressions, 5 export regressions, 492 unit и 4607 guard probes; browser Next/Nest/PG прошёл импорт/ошибку/пустой снимок/45 строк/пагинацию/CSV/keyboard/network/session и четыре ширины, scoped axe 0 violations/0 incomplete. [Контракт и границы](../modules/academic-office-reports.md). Подтверждение администратора не является независимой проверкой подлинности документа; реальный реестр не предоставлен. Контингент платформы не заменяет приказы вуза. Main/production не менялись.

## Добавление 24 октября: аналитика и HTTP parser patch

[PR 24](https://github.com/DeminLab/NaPare/pull/24) вместе с отдельным [PR 25](https://github.com/DeminLab/NaPare/pull/25) включены fast-forward на `768bb11` после успешного [CI 126](https://github.com/DeminLab/NaPare/actions/runs/40079616987): все шесть jobs, включая Linux production build, полный Backend E2E и dependency security audit. CI 123 предыдущего интеграционного `07d161c` также был успешным. Main и production не изменялись.

Реализованы 10 метрик собственного вуза, default-off сбор дневной активности с allowlist, 400-дневная очистка, серверная фиксация готовности onboarding и экран `/deanery/analytics`. Локально проверены 492 unit tests, 4568 guard probes, 9 настоящих JWT/HTTP/PostgreSQL сценариев аналитики и ещё 5 self-export регрессий после явной классификации общей таблицы состояния. Browser Next/Nest/PG подтвердил известные значения метрик, readiness, error/retry/session-состояния и четыре ширины; scoped axe без violations/incomplete. Это не доказательство непрерывности реального сбора или утверждения вузом политики. [Контракт и ограничения аналитики](../modules/product-analytics.md).

Патч body-parser 1.20.9/multer 2.5.0 устранил две high-находки; production audit high=0/critical=0/moderate=1. Отдельный Node/HTTP regression подтверждает работу новых пакетов, локальный отрицательный контроль — падение старых. [Описание и границы проверки](../security/request-parser-patch-2026-10-24.md). Новые advisory могут изменить последующие результаты audit.

## Добавление 24 октября: модерация и жалобы

[PR 23](https://github.com/DeminLab/NaPare/pull/23), `0ac954b`, включён fast-forward после успешного [CI 122](https://github.com/DeminLab/NaPare/actions/runs/40011683424), все шесть jobs. Ручная очередь с признаками риска, возврат/исправление по версии, приватные обращения студентов и история решений; миграция 40 с FORCE RLS, составным tenant FK и атомарным аудитом. Жалоба сама по себе не блокирует задачу; решение сотрудника сохраняет существующие отклики/работы/оплаты. Подача отклика ждёт блокировку задачи и отказывает после фиксации ограничения.

Локально: 44 unit suites/471 tests, 4542 guard probes, 10 настоящих JWT/HTTP/PostgreSQL сценариев; typecheck backend/portal, root lint/docs/guards и inventory367. Реальный browser Next/Nest/PG прошёл цикл публикации/возврата/исправления/жалобы и чтение решения после скрытия задачи; четыре ширины без переполнения, axe 0 violations/2 incomplete в проверенном содержимом. Новые данные включены в self export и очистку текста при удалении. [Контракт](../modules/career-moderation.md); [актуальный остаток всей цели](improvement-progress-2026-10-22.md#невыполненные-требования--актуально-на-24-октября). CI 121 предшествующего интеграционного `a2cf8ec` также прошёл все шесть jobs. Эти результаты не подтверждают production, реальные компании или устройства.

## Добавление 24 октября: регистрация и ИНН компании

[PR 22](https://github.com/DeminLab/NaPare/pull/22), `184221a`, включён fast-forward после успешного [CI 120](https://github.com/DeminLab/NaPare/actions/runs/40003036750), все шесть jobs. Сохранены результаты ФНС, owner-only recheck и company cooldown; подтверждение партнёрства остаётся отдельным. 23 adapter unit, 43 unit suites/453 tests, 4451 guard probes, 12 настоящих JWT/HTTP/PG сценариев с mocked FNS, 10 erasure regressions, browser с mocked FNS и один отдельный live lookup. Новые панели прошли axe, 7 прежних contrast-находок полного экрана задокументированы. [Контракт](../integrations/company-registry.md). Модерация пока не включена в интеграционную ветку; production не менялся.

## Добавление 23 октября: отчёт карьерного центра

[PR 21](https://github.com/DeminLab/NaPare/pull/21), `63ffc62`, включён fast-forward. [CI 118](https://github.com/DeminLab/NaPare/actions/runs/39998625546) прошёл все шесть jobs. Добавлены собственные агрегаты задач/откликов/принятых работ, XLSX и страница отчёта; это не официальная статистика трудоустройства или зачёта практики. Локально 6 настоящих JWT/HTTP/PostgreSQL сценариев, 42 unit suites/430 tests, 4438 guard probes, backend/portal typecheck, lint/docs/guards и browser Next/Nest/PG. [Контракт и пределы доказательств](../modules/career-university-report.md). ИНН и модерация остаются отдельными незавершёнными пунктами. CI 116 UI и CI 117 предыдущего интеграционного снимка также завершились успешно.

## Добавление 23 октября: данные аккаунта

PR 18–20 включены fast-forward до `9c0f5e3`, без разрешения конфликтов и изменения кода этих PR. Добавлены self-only JSON-экспорт, миграции 37–38, подтверждаемое паролем удаление с учебным архивом под кодом и общий экран `/privacy/account`. Исправление worker уведомлений одновременно сохраняет отказ провайдера и отзыв токена, предоставляя проверке архивного маркера чтение пользователей только своего вуза. Сохраняемые записи и ограничения описаны в [удалении](../privacy/account-deletion.md) и [экране управления](../privacy/account-controls.md).

CI 114 серверного commit `ab72ebb` прошёл все шесть jobs, включая полный E2E и Linux build. Локально в feature-ветке: 10 account-erasure и 5 personal-export JWT/HTTP/PostgreSQL сценариев; после исправления worker — 11 PostgreSQL/Redis сценариев доставки на миграциях 34/37/38. Browser-проверка экрана — настоящий Next/Nest/PostgreSQL: JSON из 69 наборов, неверный пароль/сохранение формы, квитанция, очистка двух токенов и тестового CacheStorage namespace, refresh чтения, отсутствие автоматического повторения DELETE, смена сессии в другой вкладке и blocker последнего администратора. Неполный export проверен отдельным подменённым ответом. Это не проверка других устройств или реального student worker. Последний CI UI и общий интеграционный CI подтверждаются отдельно для соответствующих SHA.

Таблица ниже сохраняет результаты предыдущего интеграционного снимка; она не переименовывает их в проверки нового HEAD.

## Что объединено

Роли/CI, изоляция вузов и FORCE RLS, восстановление, очередь уведомлений, коннекторы расписания, подключение вуза, учебный офис, оплата услуг Т-Кассой без выплат студентам, student offline-кэш, документы ПД, semester API и разрешённый экран семестра. Содержимое страницы вуза сохраняет обе ссылки — на onboarding и заявления. Общий AppModule включает все feature-модули; зависимости очереди и импорта объединены. Lockfile разрешён самим pnpm и проверен frozen install в отдельном физическом node_modules.

## Локальные доказательства

| Проверка | Результат и предел доказательства |
| --- | --- |
| Backend unit | 41 suite, 422 tests passed |
| Полный E2E | 11 suites, 4513 tests passed, 1 skipped native host agent. Настоящие Nest/JWT/PostgreSQL/Redis; уникальные синтетические БД/роли/очереди. Внешние сервисы mocked |
| PostgreSQL | Отдельный localhost кластер 18; runtime NOSUPERUSER/NOBYPASSRLS, единая TypeORM identity; system PostgreSQL не изменялся |
| Redis | Отдельный localhost экземпляр; queue prefixes тестовые; FLUSHALL/FLUSHDB не выполнялись |
| TypeScript | Backend, portal, student, staff, admin, developer прошли общий typecheck. Student повторён после включения экрана семестра |
| Backend build | `nest build` прошёл |
| Offline worker | Все 6 Node VM сценариев прошли |
| Lint и документация | Root lint, docs lint, AI documentation и boundary guards прошли |
| Инвентаризация | 355 backend routes; обновлена сводная tenant-инвентаризация. Это не 355 выполненных негативных бизнес-сценариев |
| Production dependencies | Audit: high=0, critical=0, moderate=1. Умеренная Nest SSE находка остаётся в ранее описанном ограничении |

Browser-доказательства feature PR остаются отдельными: onboarding и учебный офис проверены через Next → Nest → PostgreSQL с синтетическими данными; semester UI — настоящий Next с API fixtures, backend отдельно через JWT/PG. Совместного browser-прогона всех ролей этой интеграционной ветки пока нет. Локальная сборка student UI компилирует `/semester`, но Windows standalone packaging выдаёт EPERM; Linux CI должен подтвердить упаковку. Production, native devices и live Moodle/СИБИТ/банк/push не проверялись.

## Открытые проверки

23 октября включён [Next security patch PR 17](https://github.com/DeminLab/NaPare/pull/17): 15.5.28 у шести приложений, frozen install/typecheck и production audit high=0/critical=0. [Linux CI на 89f9443](https://github.com/DeminLab/NaPare/actions/runs/39829488440) прошёл шесть jobs, включая production build и Backend E2E. На новом runtime повторены 42 browser fixture состояния без violations/page errors/overflow; incomplete и manual gaps сохранены. [Отчёт патча](../security/next-patch-2026-10-23.md). Main/production не обновлялись.

После исходного зелёного CI на `a2e0565` включены [документы P3, PR 14](https://github.com/DeminLab/NaPare/pull/14), [WCAG-аудит, PR 15](https://github.com/DeminLab/NaPare/pull/15) и [исправления A01–A05, PR 16](https://github.com/DeminLab/NaPare/pull/16). Backend tree идентичен `a2e0565` (`7acf221e76965aef1ae5ac0c5f7e01658db35573`); новые изменения — student UI, точные boundary exceptions и документы. Для UI выполнены 36 светлых и 6 целевых тёмных axe-снимков без violations/page errors/overflow, 16 server HTML titles, client/back/forward, keyboard и три save-status сценария с API fixtures; это не полное AA. Подробности и исправление оговорки service-worker перехвата — в [аудите](../ui/student-wcag-audit-2026-10-22.md). Новый общий CI подтверждается отдельно для нового HEAD.

Полный audit вместе с dev-инструментами показывает high/critical находки в glob/picomatch/tmp/Vite/Vitest/tinypool/Handlebars/braces/markdown-it. Production gate их не включает; это не основание утверждать чистоту всего dependency tree. Нужен отдельный совместимый upgrade инструментов с повтором проверок, а для braces — оценка upstream fix/альтернативы, поскольку audit не указывает исправленную версию.

Не закрыты перечисленные в [журнале](improvement-progress-2026-10-22.md) требования: полный негативный бизнес-охват маршрутов, полная ручная доступность, актуальная сверка реестра ПО, коммерческие/юридические сведения и операционные подтверждения. ИНН/модерация/XLSX, аналитика, офисные отчёты и WebPush реализованы с описанными границами; внешние источники/устройства отдельно. Экспорт и согласованный учебный архив не означают полного юридического уничтожения данных. Внешние отправки default-off; main и production не менялись. Feature PR сохраняются для отдельного ревью.
