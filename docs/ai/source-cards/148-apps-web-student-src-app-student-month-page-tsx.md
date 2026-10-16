# Source card: `apps/web-student/src/app/(student)/month/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/month/page.tsx`

## Scope

Student month schedule preserves selected date, type and query in the URL and carries that context back to week view. Fetching waits for query restoration.

The October 16 follow-up keeps month navigation on one row at 320px. Search/type filters and ICS export expand separately; active filters remain indicated and can be reset. Redundant introductory copy is removed.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md) and [the product roadmap](../../product-roadmap-vcourse-comparison.md).
2. Read this route, its colocated `MonthCalendar.tsx`, the weekly route, and `schedule-location.ts`.
3. Follow `/schedule/range` in `apps/backend/src/schedule/schedule.controller.ts` for role scope and pagination.

## Change boundary

Keep month data role-scoped, fetch all pages, isolate offline cache entries by account, and only link persisted lesson UUIDs to Pair Space.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
node scripts/verify-role-workspace-boundaries.cjs
```
