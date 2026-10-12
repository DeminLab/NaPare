# Source card: `apps/backend/src/my-day/my-day.service.spec.ts`

## Canonical source

`apps/backend/src/my-day/my-day.service.spec.ts`

## Scope

My Day regressions cover the student lookahead, local timezone, staff lesson-scoped absence reads, deduplication and multi-day periods.

## Read sequence

1. Read [the My Day service card](137-apps-backend-src-my-day-my-day-service-ts.md).
2. Read this spec alongside `my-day.service.ts`.

## Change boundary

Mock ScheduleService, PairSpaceService, absences, and notifications; do not use a database or external schedule source.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/my-day/my-day.service.spec.ts
```
