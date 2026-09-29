# Source card: `apps/web-student/src/app/(student)/month/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/month/page.tsx`

## Scope

Student month schedule. It loads every page of the authenticated `/schedule/range` result and displays supplied subgroups and week parity, presents a desktop calendar and mobile day list, filters by lesson type or subject/teacher/building/room search, exports the selected month's non-cancelled lessons as `.ics`, and caches month data separately by university and account. Cached content appears immediately while the app checks for newer data; network failures leave the saved copy visible.

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
