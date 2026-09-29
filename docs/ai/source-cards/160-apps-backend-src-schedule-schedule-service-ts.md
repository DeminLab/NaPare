# Source card: `apps/backend/src/schedule/schedule.service.ts`

## Canonical source

`apps/backend/src/schedule/schedule.service.ts`

## Scope

Tenant- and role-scoped schedule queries and manual lesson updates. Student date-range queries can receive an IANA timezone for date-only external schedule filtering. Updates preserve old/new lesson values, classify room/building, teacher, date/time, and other changes accurately, and publish events addressed to the affected group and teacher. Date-only reschedules are notified as schedule changes. Cancellation events include the subject and the deleted lesson's original schedule values.

## Read sequence

1. Read [the Schedule module](../../../modules/schedule.md).
2. Follow manual updates to the event bus and notification formatter.

## Change boundary

Preserve tenant/role checks and link an update to the lesson Pair Space; cancellations keep a schedule link because the lesson may no longer be available.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/backend exec jest --runInBand src/schedule/schedule.service.spec.ts
```
