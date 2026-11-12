# ADR-0009: Мультироли — user_role и миграция с user.role

## Статус
Принято

> **Реализация на 2026-11-11:** роль хранится одним полем `users.role` (enum PostgreSQL, 11 значений: `student`, `teacher`, `curator`, `faculty_dean`, `department_head`, `university_admin`, `superadmin`, `developer`, `employer`, `career_staff`, `career_admin`); таблицы `user_role` нет. Права даёт `ROLE_PERMISSIONS` (`common/authorization/permissions.ts`), проверка — `RolesGuard` + e2e-бейзлайн `apps/backend/test/fixtures/role-policy.json`. Настоящий ADR проектирует перекодирование, реализуемое в рамках T-004/T-009.

## Контекст

ТЗ v1.1 §4 и R-6 (задача T-004): пользователь может иметь **несколько ролей в одной или нескольких организациях**, назначение всегда ограничено организацией и `scope` (факультет, кафедра, группа, список студентов, конкретные заявки); роль сама по себе не даёт доступа ко всем данным — сервер проверяет роль, область, связь и ресурс одновременно.

Ограничения текущей модели:

- одно `users.role` → невозможно «преподаватель в вузе А, студент в вузе Б»;
- у пользователя одно `universityId` → нет членства в нескольких организациях;
- `scope` нигде не хранится — области действия проверяются точечно в сервисах;
- канонические роли ТЗ `group_leader`, `registrar`, `parent`, `dorm_manager`, `practice_supervisor` отсутствуют в enum.

Процесс (§15.1): expand → migrate → contract, удаление legacy — только после подтверждения; изменение модели авторизации требует ADR (настоящий документ закрывает T-004 на этапе проектирования).

## Решение

### Схема (expand-миграция `1700000000047-UserRoles`)

```sql
CREATE TABLE user_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "organizationId" uuid NOT NULL REFERENCES universities(id),
  role varchar NOT NULL CHECK (role IN (
    'student','group_leader','teacher','curator','registrar','dorm_manager',
    'practice_supervisor','parent','faculty_dean','department_head',
    'university_admin','developer','superadmin',
    'employer','career_staff','career_admin'
  )),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_user_role_membership" UNIQUE ("userId", "organizationId", role)
);
ALTER TABLE user_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role FORCE ROW LEVEL SECURITY;
-- политики napare_tenant_* по образцу 1700000000029
```

- `scope` — jsonb с проверкой известных ключей на стороне приложения: `{ facultyId?, departmentId?, groupIds?, studentIds?, requestIds? }`; пустой объект = «вся доступная область роли».
- Состав ролей: 13 канонических ролей ТЗ §4 **плюс** фактические `employer`, `career_staff`, `career_admin` (вне ТЗ, сохраняются до отдельного решения владельца продукта — их удаление ломает карьерный контур).

### Миграция данных (migrate)

1. `INSERT INTO user_role ("userId", "organizationId", role) SELECT id, "universityId", role FROM users WHERE "universityId" IS NOT NULL AND role IS NOT NULL ON CONFLICT DO NOTHING` — каждая существующая учётка получает ровно одну роль в своей организации.
2. Пользователи без `universityId` (например, часть `developer`/`superadmin`) — строку `user_role` не получают; их доступ обслуживает глобальный контур до нарезки членств.
3. **Dual-read/dual-write период (один релиз):** приложение читает эффективную роль как «самая приоритетная строка `user_role` в активной организации, иначе legacy `users.role`»; при изменении роли запись идёт в `user_role` и зеркалируется в `users.role` (single active role в организации пользователя — отражение, не источник истины).
4. `users.role` и его enum объявляются legacy; **contract** (следующий релиз): удаление колонки, зеркалирования и fallback-чтения — только после того, как все e2e и role-policy-бейзлайн переключены и подтверждены.

### Проверка прав

- `RolesGuard`/`ROLE_PERMISSIONS` работают с набором ролей (`roles: UserRole[]`), а не одной ролью: сервер собирает активные роли пользователя в активной организации из `user_role` (fallback — `users.role`) и проверяет **роль + scope + ресурс** (`assertAccess` из `common/tenant`).
- Новые роли подключаются отдельными поставками после таблицы: `registrar` (очередь заявок, P0), `parent` (связи `guardian_link`, P1), `group_leader` (подтверждение объявлений, P1), `dorm_manager`, `practice_supervisor` (P2) — вместе с их сущностями и e2e, не в одной поставке с миграцией.
- `verify-role-workspace-boundaries.cjs` и baseline `role-policy.json` обновляются осознанно в том же PR (diff ревьюится).

### Приёмка

1. У одного `user` — две роли в двух организациях; выдача и права считаются по активной организации.
2. Backfill не теряет ни одной роли; откат миграции восстанавливает `users.role` из `user_role` (single source на момент отката).
3. `role-policy.e2e-spec.ts`, `tenant-rls.e2e-spec.ts`, `tenant-isolation.e2e-spec.ts` зелёные; cross-tenant (QA-01) остаётся отказом.
4. `pnpm lint`, `typecheck`, `test:unit` зелёные.

## Преимущества

1. Закрывает R-6/T-004: несколько ролей и организаций, scope в БД, а не в сервисах.
2. Идентичность пользователя глобальна (`user`), членства tenant-owned и покрыты RLS (согласуется с ADR-0008).
3. Обратимая миграция: legacy `users.role` жив до подтверждённого contract-шага.

## Недостатки

1. Двойное чтение/запись на переходный период требует единой точки «эффективных ролей» во всём бэкенде.
2. `scope jsonb` не защищён ограничением на уровне БД — валидация на стороне приложения + аудит.
3. Роли вне ТЗ (`career_*`, `employer`) держат реестр шире канонического.

## Связанные решения

- ADR-0008: Изоляция организаций — RLS, app.organization_id, служебные роли
- ADR-0002: Мультивузовость через university_id (частично superseded)
- TZ v1.1: §4, §11.2 (`user_role`), §15.1, R-6, T-004, T-009
