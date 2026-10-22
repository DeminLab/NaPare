# Семестровый обзор Moodle

Дата: 22 октября 2026. Тип: справочник backend и инструкция администратору вуза. Реализован API; student UI этим блоком не меняется, разрешение владельца на student-каталог пока касается offline-кэша.

## Источник и смысл результата

Оценки читаются из настроенного Moodle своего вуза. Период задаёт вуз как явный список курсов; приложение не угадывает семестр по имени курса, ФИО студента или дате последнего входа. Ответ содержит `source.provider=moodle`, нормализованный `baseUrl`, `fetchedAt` и `gradeScope=current_course_state`: это текущее состояние оценок выбранных курсов, **не исторический снимок на конец семестра**.

Стандартный `gradereport_user_get_grade_items` не является официальным реестром академических задолженностей. Поэтому `debtSource.available=false`, `records=[]` и пояснение возвращаются явно. Нулевой балл не превращается в задолженность, отсутствие оценки не подменяется нулём. Для официальных задолженностей нужен отдельный подтверждённый источник/контракт вуза; здесь он не имитируется.

## Настройка

1. Примените миграцию `1700000000036-AcademicIdentities`. Она создаёт таблицу привязок с внешними ключами, уникальностью и restrictive FORCE RLS из migration29. Runtime-роль — без SUPERUSER/BYPASSRLS.
2. Настройте существующее подключение Moodle через `POST /api/v1/admin/connectors/moodle/configure`. Сервисный token хранится AES-GCM зашифрованным; ключ задаётся безопасным окружением. Не копируйте token/ключ в команды, Git или диагностические ответы.
3. В существующем `PATCH /api/v1/admin/connectors/moodle` задайте `config.semesterPeriods`. Это список до 30 периодов с уникальным ID и 1–200 уникальными положительными numeric course IDs каждого периода. Пример тела:

```json
{"config":{"semesterPeriods":[{"id":"2026-autumn","label":"Осень 2026","courseIds":[11,12]}]}}
```

4. В админке самого Moodle найдите **точный numeric user ID** студента и проверьте личность по реестру. Администратор НаПаре своего вуза сохраняет её через `POST /api/v1/academic/identities/moodle/:studentId`:

```json
{"externalUserId":"17","confirmed":true,"reason":"Личность проверена по реестру учебного подразделения"}
```

Привязка не назначается по ФИО/email автоматически. `confirmed` — подтверждение действия администратора, а не автоматическая проверка внешнего реестра приложением. Один externalUserId одного Moodle нельзя связать с двумя студентами вуза. Неактивный, чужой или не student-аккаунт отклоняется. Создание/изменение/удаление отражаются в audit; текст оценок и token в него не копируются.

Привязка содержит нормализованный URL источника: при смене Moodle на другой адрес прежняя связь перестаёт работать до явного переподтверждения. При переустановке Moodle **на том же URL** с новыми ID оператор должен отозвать/перепроверить связи самостоятельно; URL не является доказательством неизменности внешней БД.

Сервисному пользователю Moodle нужны разрешённые Web Services functions `core_enrol_get_users_courses` и `gradereport_user_get_grade_items` и права на учебные данные конкретных студентов. Для чтения чужого относительно сервисной учётной записи отчёта в Moodle требуются соответствующие grade/group capabilities. Не выдавайте анонимный или неограниченный публичный token.

## API

| Метод и путь относительно `/api/v1/academic` | Права и поведение |
| --- | --- |
| `GET semester/periods` | Student; собственный вуз, настроенные ID/названия периодов. `available` здесь означает наличие конфигурации, не live health probe |
| `GET semester?period=2026-autumn&page=1&limit=10` | Student; только собственная сохранённая привязка. Дополнительный studentId или чужой ID в query не принимается |
| `GET identities/moodle/:studentId` | University admin своего вуза; текущая привязка или null |
| `POST identities/moodle/:studentId` | Тот же admin; числовой externalUserId, confirmed=true и причина |
| `DELETE identities/moodle/:studentId` | Тот же admin; отзыв, повторный запрос безопасен |

Техническая роль/роль преподавателя/обычный student не может назначать связи. Администратор не получает через этот self API оценки студентов: обзор доступен только student. Сохранённые platform grants этим модулем не обходятся и не расширяются.

Обзор пересекает курсы настроенного периода с курсами, возвращёнными Moodle для конкретного numeric user ID. Запрашиваются только применимые курсы, не весь отчёт всех студентов. Пагинация — до 10 курсов в ответе, четыре параллельных запроса; для полного периода клиент читает все страницы по meta. Один отчёт ограничен 1000 grade items, upstream-ответ — 1 МиБ, HTTP timeout — 10 секунд. Ограничения существующей HTTPS/DNS pinning/SSRF защиты и запрет redirect сохраняются.

Скрытые курсы не включаются; отсутствие подтверждённого признака видимости не считается публичным доступом. Для курса, скрывающего оценки (`showgrades=false` или признак отсутствует), `available=false` и `grades=[]`. Скрытые баллы/отображение/дата не возвращаются; требующие пересчёта оценки имеют `stale=true`, raw/display=null. Возвращаемые строки — текст, их нельзя вставлять в HTML через innerHTML. Средние, рейтинги, пользовательский feedback и чужие ФИО из полного отчёта не передаются.

## Пустые данные и ошибки

| Состояние | Ответ |
| --- | --- |
| Moodle отсутствует/отключён/не настроен | HTTP 200, available=false, source=null, reason=source_unavailable, data=[] |
| Вуз не настроил указанный период | HTTP 200, available=false, reason=period_unconfigured |
| Привязка отсутствует/отозвана/не соответствует URL | HTTP 200, available=false, reason=identity_unlinked |
| Настроенный источник корректно вернул отсутствие применимых курсов | HTTP 200, available=true с source и пустой data, total=0 |
| Moodle не отвечает, доступ запрещён, отчёт другого студента/курса, warnings или некорректный ответ | HTTP 502 с общим сообщением, без token/имён из upstream. Ошибка не выдаётся за отсутствие оценок |

Клиент должен различать эти состояния, не писать «нет долгов» при debtSource.available=false и не считать одну страницу полным семестром. GET-ответы имеют Cache-Control: no-store; фоновое сохранение оценок в БД этим модулем не добавляется.

Привязки (`academic_identities`) сохраняют userId/universityId, numeric ID Moodle, URL источника, linkedBy/linkedAt в PostgreSQL. Срок автоматического удаления не установлен; DELETE привязки не удаляет audit и данные внешнего Moodle. Оценки существуют в ответе/памяти запроса, этот модуль не сохраняет их в таблицу или Redis. Основание передачи, сроки внешнего Moodle и матрицу хранения определяет оператор/юрист. Общая задача self export/удаления аккаунта остаётся открытой.


## Студенческий экран

Пользователь отдельно разрешил экран семестра и ссылку в профиле 22 октября 2026. `/student/profile` → «Мой семестр» открывает `/student/semester`. Экран запрашивает настроенные периоды, затем по десять курсов выбранного периода. Показывает источник и время ответа, нулевые оценки, отсутствие оценки, скрытие и необходимость пересчёта. Ошибки сети, отсутствие подключения, ненастроенные периоды, отсутствие привязки личности и корректный пустой отчёт имеют разные состояния. При смене периода/страницы и ошибке старые оценки убираются; устаревший запрос отменяется. Оценки не сохраняются в localStorage/CacheStorage.

Локальный Playwright с настоящим Next и синтетическими API-ответами проверил ссылку из профиля, смену периода, переход на вторую страницу, zero/hidden/stale, empty/unlinked/source/unconfigured/error/retry, порядок keyboard focus, отсутствие горизонтального переполнения на 320/768/1440 px и отсутствие page errors. Это отдельное UI-доказательство, не совместный браузерный прогон с реальным Moodle. Student TypeScript, root lint, docs lint и guards прошли.

## Backend-проверки и первичные источники

Локальная проверка использует настоящий Nest/JWT/PostgreSQL под non-superuser и применяет migration36 к пустой feature-таблице disposable `curation_test_*`. Moodle заменяется mock; транспорт отдельно проверяется с pinned HTTPS/DNS fixtures. Сценарии: два вуза, foreign IDs, запрет самопривязки, уникальность numeric ID, source replacement, отзыв на существующей JWT, пагинация, zero/missing/hidden/stale и outage. CI создаёт отдельную БД и задаёт `SEMESTER_TEST_DATABASE_URL`.

Результат 22 октября: 39 unit suites/395 passed; 8 E2E suites/4196 passed/1 skipped (native host agent). Восемь E2E сценариев относятся непосредственно к семестру; общий guard matrix остаётся синтетическим конечным handler, не доказательством выполнения каждого бизнес-маршрута.

```powershell
pnpm --filter @napare/backend exec jest --runInBand
pnpm --filter @napare/backend exec tsc --noEmit
pnpm test:e2e
node scripts/security-route-inventory.cjs --check
node scripts/verify-ai-documentation.cjs
node scripts/verify-role-workspace-boundaries.cjs
pnpm lint
pnpm lint:docs
git diff --check
```

Контракт сверялся с первичным кодом Moodle 4.5: [user grade external API](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/grade/report/user/classes/external/user.php), [регистрация функции](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/grade/report/user/db/services.php), [enrollment external API](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/enrol/externallib.php). Версия/права реального Moodle вуза, совместный UI → live Moodle прогон, официальный реестр задолженностей, production и юридические основания передачи этим блоком не проверены.
