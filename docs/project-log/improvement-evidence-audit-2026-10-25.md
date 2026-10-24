# Сверка плана НаПаре по доказательствам — 25 октября 2026

Проверены исходный [план](improvement-plan-2026-10-22.md), [журнал](improvement-progress-2026-10-22.md), исходники/контракты и опубликованные PR. Цель целиком **не достигнута**. Ниже разделены код, локальные/CI доказательства и неподтверждённая эксплуатация. Этот аудит не является разрешением на подключение новых вузов: полный бизнес-охват P0-1 ещё открыт.

## Область снимка

Проверенный удалённый integration HEAD: `96279f20eba295b2259257d95d6bea6a373ab38d`. HEAD main: `6f28912cebd7100bcb109166360cd7fc8920b573`; main и production этим блоком не изменялись. Для каждого PR получены фактические head SHA и CI на этом SHA, затем выполнен `git merge-base --is-ancestor HEAD_PR codex/improvement-integration`. Все feature heads PR 1–12 и 14–30 входят в интеграцию; PR 13 — сама агрегированная ветка. Статус open/closed на GitHub не используется как доказательство наличия кода.

[CI PR 28](https://github.com/DeminLab/NaPare/actions/runs/40119582581) подтвердил 20 E2E suites, 4869 passed/1 skipped и все шесть jobs. Отдельный [CI PR 29](https://github.com/DeminLab/NaPare/actions/runs/40119974434) также успешен. Это Linux build/typechecks/tests/audit, а не развёртывание. Guard probes входят в общее число E2E; нельзя представлять 4869 как число предметных проверок бизнес-обработчиков. Внешние провайдеры большинства suites подменены. Пропуск host agent не является успешной runtime-проверкой.

## Каждый блок исходного плана

| Пункт | Подтверждённый результат | Что остаётся |
| --- | --- | --- |
| P0-1 | Inventory375, JWT/service scope, FORCE RLS, SQL и предметные suites; [67 учебных HTTP/PG](../security/business-tenant-probes-2026-10-25.md) с контролями Б/снимками строк | Полная связь каждого оставшегося бизнес-маршрута с положительным/отрицательным сценарием; guard probe её не заменяет |
| P0-2 | [Матрица](../security/role-matrix.md), 11 ролей, 4646 guard probes, обязательный PostgreSQL E2E в CI | Не выдавать входной контроль за разрешение доступа к конкретному ресурсу |
| P0-3 | [Runbook](../deployment/runbook.md), encrypted dump/локальный restore, timers/templates, DB/queue health и alert-код | Реальное внешнее хранилище, серверное расписание, другая машина, доставка алерта, RPO/RTO |
| P1-1 | PR 7/27: outbox/Redis/BullMQ/providers, retry/dead letter, [WebPush setup](../clients/webpush.md), opt-in/отзыв/logout/удаление, браузерные и HTTP/PG проверки | Настроенный provider и реальные устройства/закрытая PWA/OS display; Native RuStore SDK APK этой реализацией не добавлен |
| P1-2 | PR 8: [коннекторы](../integrations/schedule-import.md), форматы, очередь/журнал и тесты | Moodle/СИБИТ конкретного вуза с разрешёнными настройками/данными |
| P1-3 | PR 10: мастер вуза/структуры/первого администратора, импорт и наблюдаемая readiness; browser Next/Nest/PG | Приёмка на разрешённом реальном вузовском источнике |
| P1-4 | PR 6/26: согласованная модель заявлений, этапы/назначения/решения, [контингент/долги](../modules/academic-office-reports.md), history/pagination/CSV | Подлинность и актуальность реального реестра долгов; текущие аккаунты не являются официальным контингентом по приказам |
| P2-1 offline | PR 5: явное сохранение расписания/пары, TTL/identity/purge, реальный worker в browser со synthetic backend | Целевые мобильные устройства и production |
| P2-1 семестр | PR 11/12: API/экран/источник/страницы/empty/error, согласованная ссылка профиля | Реальный Moodle; оценки сами по себе не подтверждают официальный долг |
| P2-1 данные | PR 18–20: self JSON export, удаление профиля/приватных наборов, browser и PG, согласованный архив без имени/контактов | Псевдонимизация не является доказанным необратимым обезличиванием; [внешние копии](../privacy/external-copies-procedure.md), основания/сроки и restore replay требуют оператора |
| P2-1 доступность | PR 15/16: [аудит и A01–A05](../ui/student-wcag-audit-2026-10-22.md), scoped axe/keyboard/titles/status | Полная ручная клавиатура/фокус/экранный диктор; WCAG AA не подтверждено |
| P2-2 оплата | PR 4: согласованная Т-Касса для услуг платформы, без выплат студентам, статусы/webhook/refund-код и mock/PG | Настоящий тестовый кабинет/договор/настройки, реальные сценарии банка |
| P2-2 ИНН | PR 22: [адаптер ФНС](../integrations/company-registry.md), регистрация/сохранение/повторная проверка/UI; тесты и отдельный live lookup | Поиск не является подписанной выпиской/доказательством полномочий; доступность источника не гарантируется |
| P2-2 модерация | PR 23: очередь/правила/жалобы/версии/аудит и HTTP/PG/browser | Решения принимает уполномоченный сотрудник; жалоба не означает автоматически установленное мошенничество |
| P2-2 отчёт | PR 21: [JSON/XLSX](../modules/career-university-report.md), scoped задачи/отклики/принятые работы, PG/browser | Не подтверждает официальное трудоустройство/зачёт практики |
| P2-3 | PR 9: карта, условная оценка ПД, размещение, проекты DPA/политики/согласий | Утверждение оператором/юристом, фактические площадки, доступ и сроки; готовое соответствие не заявляется |
| P3 закупки | PR 14 и обновление PR 30: [карточка/ТЗ/форма цены](../procurement/README.md) | Реквизиты, реальные тарифы и налоговый режим пользователь предоставит позже; подписи/закупочные решения отсутствуют |
| P3 реестр ПО | [Сопоставление и пробелы](../legal/russian-software-registry-gap.md), перечень необходимых подтверждений | Полный актуальный официальный текст/форма не получены; юридическая сверка, права/контроль и подача не выполнены |
| P3 аналитика | PR 24: [десять метрик](../modules/product-analytics.md), default-off activity, scope/retention/export/delete, readiness/UI/PG/browser | Утверждение политики и настройка реального сбора вузом |
| P3 монетизация | PR 14: [три модели](../strategy/monetization.md) и модельный расчёт | Фактический утверждённый прайс и договорные условия; пример не является ценовым предложением |

## Проверка опубликованных PR

Снимок GitHub на момент проверки; CI-ссылки относятся к указанным head SHA. Отсутствие найденного PR-triggered run не утверждает, что проверки никогда не запускались: API этого инструмента фильтрует такие запуски. Общая ветка проверяет совместное состояние отдельно.

| PR | Head | В integration | Последний найденный CI на Head |
| --- | --- | --- | --- |
| [1](https://github.com/DeminLab/NaPare/pull/1) | `39835c3` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39666243584) |
| [2](https://github.com/DeminLab/NaPare/pull/2) | `907c58d` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39666232466) |
| [3](https://github.com/DeminLab/NaPare/pull/3) | `9965e9a` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39666656834) |
| [4](https://github.com/DeminLab/NaPare/pull/4) | `e8973b9` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39665232083) |
| [5](https://github.com/DeminLab/NaPare/pull/5) | `bf465c5` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39666513748) |
| [6](https://github.com/DeminLab/NaPare/pull/6) | `bc32bba` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39734405150) |
| [7](https://github.com/DeminLab/NaPare/pull/7) | `07a4401` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39735647426) |
| [8](https://github.com/DeminLab/NaPare/pull/8) | `8ad2109` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39735544713) |
| [9](https://github.com/DeminLab/NaPare/pull/9) | `b0b0dbb` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39735817716) |
| [10](https://github.com/DeminLab/NaPare/pull/10) | `6ac773f` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39770152143) |
| [11](https://github.com/DeminLab/NaPare/pull/11) | `3cf7b6a` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39770177506) |
| [12](https://github.com/DeminLab/NaPare/pull/12) | `98eb5d0` | да | не найден на HEAD |
| [13](https://github.com/DeminLab/NaPare/pull/13) | `96279f2` | сама интеграционная ветка | [in_progress на момент снимка](https://github.com/DeminLab/NaPare/actions/runs/40120698784) |
| [14](https://github.com/DeminLab/NaPare/pull/14) | `63bd890` | да | не найден на HEAD |
| [15](https://github.com/DeminLab/NaPare/pull/15) | `12eae31` | да | не найден на HEAD |
| [16](https://github.com/DeminLab/NaPare/pull/16) | `b134277` | да | не найден на HEAD |
| [17](https://github.com/DeminLab/NaPare/pull/17) | `89f9443` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39829488440) |
| [18](https://github.com/DeminLab/NaPare/pull/18) | `e2c6862` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39842138358) |
| [19](https://github.com/DeminLab/NaPare/pull/19) | `ab72ebb` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39994690240) |
| [20](https://github.com/DeminLab/NaPare/pull/20) | `9c0f5e3` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39995589407) |
| [21](https://github.com/DeminLab/NaPare/pull/21) | `63ffc62` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/39998625546) |
| [22](https://github.com/DeminLab/NaPare/pull/22) | `184221a` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40003036750) |
| [23](https://github.com/DeminLab/NaPare/pull/23) | `0ac954b` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40011683424) |
| [24](https://github.com/DeminLab/NaPare/pull/24) | `768bb11` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40079616987) |
| [25](https://github.com/DeminLab/NaPare/pull/25) | `4780bc0` | да | [failure](https://github.com/DeminLab/NaPare/actions/runs/40079492397) |
| [26](https://github.com/DeminLab/NaPare/pull/26) | `dfcdc4c` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40082067624) |
| [27](https://github.com/DeminLab/NaPare/pull/27) | `a22662b` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40118625370) |
| [28](https://github.com/DeminLab/NaPare/pull/28) | `382a204` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40119582581) |
| [29](https://github.com/DeminLab/NaPare/pull/29) | `cd21103` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40119974434) |
| [30](https://github.com/DeminLab/NaPare/pull/30) | `24520fe` | да | [success](https://github.com/DeminLab/NaPare/actions/runs/40120344609) |

PR 25: [исторический E2E failure](https://github.com/DeminLab/NaPare/actions/runs/40079492397) — отсутствовала классификация `product_analytics_state` в personal-data catalog. Исправление вошло в совместный `768bb11`, [CI PR 24](https://github.com/DeminLab/NaPare/actions/runs/40079616987) и последующие общие прогоны успешны. Исторический красный run не переименован в зелёный; отдельная старая ветка не объявляется прошедшей CI.

## Оставшиеся зависимости

Пользователь подтвердил отсутствие тестовых настроек Moodle/СИБИТ, Т-Кассы и внешнего backup; коммерческие сведения предоставит позже. Их повторно не запрашивают как будто уже подготовленные. До появления разрешённых конфигураций возможны код/синтетические проверки и документация, но не живые доказательства. Реальные отправки и production остаются выключенными/неизменёнными в рамках задачи.

Самостоятельная работа остаётся по полному бизнес-охвату P0-1, остаточной доступности и актуальной сверке правовых источников, когда они доступны. Операционные/юридические решения не заменяются вымышленными данными. Окончательное закрытие цели возможно после проверки каждого открытого результата, а не после числа PR или зелёного CI.
