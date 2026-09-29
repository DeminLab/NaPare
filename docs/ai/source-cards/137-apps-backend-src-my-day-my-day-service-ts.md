# Source card: `apps/backend/src/my-day/my-day.service.ts`

## Canonical source

`apps/backend/src/my-day/my-day.service.ts`

## Scope

Authenticated role-aware aggregation for the My Day API: today's lessons, pair spaces, absences, notifications, and student preparation deadlines in the next 30 days. The optional IANA `timeZone` parameter determines the local calendar day and its UTC query bounds across student, teacher, and other role paths; invalid zones are rejected.

## Read sequence

1. Read [the My Day module](../../modules/my-day.md).
2. Read this service and its controller/module.
3. Follow ScheduleService and PairSpaceService for role/tenant scoping and preparation data.

## Change boundary

Do not broaden the result beyond lessons returned by the authenticated user's role-scoped schedule query. Preparation entries are reminders linked to a Pair Space; Moodle remains the submission and grade system of record.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/my-day/my-day.service.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
