# Source card: `apps/backend/src/schedule/schedule.service.ts`

## Canonical source

`apps/backend/src/schedule/schedule.service.ts`

## Scope

Tenant- and role-scoped schedule queries and manual lesson updates. Date-only end dates include the entire last UTC day; explicit ISO instants retain their exact bounds. External student date filtering accepts an IANA timezone and slices the filtered SIBIT lesson array to the requested page before generating response metadata. Lesson changes publish accurately classified notifications.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md).
2. Follow manual updates to the event bus and notification formatter.

## Change boundary

Preserve tenant/role checks and link an update to the lesson Pair Space; cancellations keep a schedule link because the lesson may no longer be available.

## Verification

The approved office plan adds dispatcher appointments for scoped time/room PATCH operations. The service checks fresh appointments and permits a fixed field set; it does not delegate deletion or source/group/teacher identity changes. Run `requests.e2e-spec.ts` with a disposable local PostgreSQL database and the existing schedule unit suite.

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/backend exec jest --runInBand src/schedule/schedule.service.spec.ts
```
