# ADR-0008: Изоляция организаций — RLS, app.organization_id, служебные роли

## Статус
Принято

> **Реализация на 2026-11-11:** RLS включён и форсируется миграцией `1700000000029-TenantRowSecurity.ts` (ENABLE + FORCE ROW LEVEL SECURITY на всех tenant-таблицах, restrictive-политики `napare_tenant_*`), приложение работает ролью `NOSUPERUSER NOBYPASSRLS`, миграционная роль отделена (`b157812`). Требования ТЗ §11.5 закрыты, кроме канонического имени контекста — это закрывает настоящий ADR (см. «Решение»). Ранее противоречащие утверждения в `README.md`, `docs/database/schema-overview.md` и `docs/security/threat-model.md` устарели.

## Контекст

ТЗ v1.1 (§11.1, §11.5, T-005) требует:

- канонический tenant — `organization`, канонический идентификатор в БД и API — `organization_id`; `university_id` — legacy, мигрируемый;
- RLS (ENABLE + FORCE) на каждой tenant-owned таблице, контекст `app.organization_id` transaction-local, роль без `BYPASSRLS`, отделённая миграционная роль;
- тесты на чтение/запись/удаление/фоновые jobs/SSE/экспорт.

Текущее состояние (подтверждено кодом):

- колонки во всём репозитории — `universityId`/`university_id`; GUC — `app.university_id`;
- RLS-политики строит динамический блок миграции `1700000000029` от фактических колонок `('universityId','university_id')`;
- ADR-0002 закреплял имя `university_id` и справедливо отмечал, что RLS на дату его написания не был включён;
- контекстная функция `napare_tenant_allows`, `napare_auth_allows`, `napare_relation_allows` и JSON `app.tenant_access` используют `universityId`/`university_id`.

Конфликт: ТЗ требует единственный смысловой идентификатор, но процесс ТЗ (§15.1) велит миграции делать expand → migrate → contract, а удаление legacy — только после подтверждения.

## Решение

1. **Каноническое имя — `organizationId`/`organization_id`; legacy `universityId` остаётся в БД переходного периода как технический алиас, синхронизируемый базой, а не вторая смысловая сущность.** Псевдонимы `admin`, `staff`, `dean` в контракте не используются; таблица `universities` и доменные термины «вуз» остаются до отдельного решения (в нарезке ТЗ переименования таблицы нет).
2. **Expand-миграция `1700000000046-TenantOrganizationAlias`** для каждой таблицы с tenant-колонкой, **в обе стороны**:
   - production-схема (legacy-колонка есть): `ADD COLUMN "organizationId" uuid` (`"organization_id"` для snake_case-таблиц), backfill из legacy-колонки;
   - dev/test-схема (создана `synchronize` от переименованных entity, legacy-колонки нет): `ADD COLUMN "universityId" uuid` из `organizationId` — чтобы исторические миграции 20/29/31-34/36/37/40-44, по-прежнему захардкодившие legacy-имена, выполнялись без правок;
   - синхронизирующий `BEFORE INSERT OR UPDATE` триггер `napare_tenant_org_alias_sync`: при отсутствии одного из значений заполняет его от другого; при конфликте источником истины считается `organizationId`;
   - дубликаты одиночных `FOREIGN KEY` и `UNIQUE`-индексов с `universityId` — на `organizationId` (производительность и целостность нового пути чтения);
   - отдельный алиас `platform_grants."universityIds"` (миграция 28) → `"organizationIds"` с собственным триггером: таблица вне цикла одиночных tenant-колонок, но entity `PlatformGrant` читает/пишет новое имя;
   - legacy-колонки, их индексы и ограничения **не удаляются** (contract — отдельный шаг после подтверждения, §15.1 п.3);
   - миграция **идемпотентна** (все шаги под `IF NOT EXISTS`/проверки наличия колонки), поэтому dev/test выполняет её повторно.
3. **Переключение RLS на `organizationId`:** функции `napare_tenant_allows`/`napare_auth_allows`/`napare_relation_allows` и политики пересоздаются миграцией 46 от колонки `organizationId` и GUC `app.organization_id`; JSON `app.tenant_access` использует ключ `organizationIds`. Логика исключений (users, career_*) сохраняется побайтно.
4. **Контекст устанавливает сервер транзакционно:** `set_config('app.organization_id', <проверенный id>, true)` и `set_config('app.university_id', <то же>, true)` (оба — чтобы legacy-политики и откат релиза оставались рабочими); клиент не может задать tenant напрямую. Применение: `common/tenant/tenant-database.ts`.
5. **Служебные роли:**
   - `napare_runtime` — приложение, `LOGIN NOSUPERUSER NOBYPASSRLS`;
   - `napare` — миграции (в production — отдельная роль `DB_MIGRATION_*`, уже включена `validate-environment.ts`);
   - cross-tenant — только отдельный административный контур (`PlatformTenantAccess`/`tenant-database-platform.ts`) с журналом.
6. **Приёмка:** `pnpm lint`, `typecheck`, `test:unit`, полный `test:e2e` (включая `tenant-rls.e2e-spec.ts`, `tenant-isolation.e2e-spec.ts`, `role-policy.e2e-spec.ts`) — зелёные; `security-route-inventory --check` регенерирован.

## Dev/test-пути: expand вокруг исторического хвоста

Конфликт: dev и тесты строят схему через `synchronize: true` от переименованных entity (колонки только `organizationId`), а затем выполняют **исторические** миграции (29, 37-44 в `app.module.ts`; 20/29/42 в `curation.fixture.ts`; 28 в `platform.fixture.ts`; точечно 31-36, 40-42 в e2e-спеках). Эти миграции захардкодили `universityId`/`university_id` и править их нельзя (порядок fresh-прод: 40/41/42/44 выполняются **до** 46, когда legacy-колонка ещё существует).

Решение — миграция 46 бидирекциональна, а dev/test выполняет её **до и после** исторического хвоста:

1. **До:** добавляет legacy-колонку рядом с `organizationId` (backfill + триггер), чтобы миграции 20/29/31-34/36/37/40-44 находили свои колонки и создавали индексы/FK/политики;
2. **Исторический хвост** выполняется без правок;
3. **После:** пересоздаёт функции/политики каноническим текстом (GUC `app.organization_id`, ключ capability `organizationIds`) — иначе `set_config`-контекст и гранты `runWithDatabaseAccess({ tables, organizationIds })` не совпадут с текстом функций из миграции 29 — и.alias-ит таблицы/`platform_grants`, пересозданные историческими миграциями уже без `organizationId`.

Точки вставки: `app.module.ts` (dev-ветка, вокруг 29…44), `curation.fixture.ts` (вокруг 20/29/42 — покрывает все спеки через `createCurationFixture`), `tenant-rls.e2e-spec.ts` (вокруг 29), а также после DROP+пересоздания в `requests`, `schedule-import`, `semester`, `office-reports`, `platform.fixture`. В production ничего не меняется: миграция 46 выполняется один раз последней, в направлении legacy → alias.

`down()` остается откатом production-формы (direction A): он сначала возвращает текст функций/политик на legacy, затем удаляет alias-колонки; dev/test-схему он не поддерживает и не должен применяться.

## План contract-шага (следующий релиз, после подтверждения)

- `DROP` legacy-колонок `universityId`/`university_id`, их индексов и дубликатов FK;
- удаление синхронизирующих триггеров и `set_config('app.university_id', …)`;
- сравнительный тест выдачи расписания «до/после» и прогон полного e2e.

## Преимущества

1. Одно смысловое имя в API и коде без нарушения expand→migrate→contract.
2. Rollback релиза не теряет данные: legacy-колонки целы и синхронизированы.
3. Индексный покрытие нового пути чтения не хуже старого.
4. §11.5 ТЗ выполнено буквально: `app.organization_id`, FORCE RLS, роль без BYPASSRLS.

## Недостатки

1. Период двух колонок: риск рассинхронизации снимается триггером и e2e, но требует дисциплины (не писать legacy-колонку напрямую).
2. Динамические дубликаты индексов/FK усложняют чтение схемы до contract-шага.

## Связанные решения

- ADR-0002: Мультивузовость через university_id — **частично superseded**: каноническое имя меняется на `organization_id`, доменная модель «вуз» сохраняется
- ADR-0009: Мультироли user_role
- TZ v1.1: §11.1, §11.5, §15.1, T-005, T-010
