# Source card: `apps/web-student/src/app/(student)/groups/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/groups/page.tsx`

## Scope

Read-only SIBIT group schedule browser. Loads and caches the public academic-year and group catalogs, restores the last selected group, fetches that group's published schedule through the existing `/auth/rasp-*` endpoints, and supports server-synced per-account favorite groups with a queued local offline fallback/migration, Monday-to-Sunday week navigation, subject/teacher/room/subgroup search and source week parity, and a local cache of the selected public group schedule for offline viewing.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md) and [the product roadmap](../../product-roadmap-vcourse-comparison.md).
2. Read this route and `apps/web-student/src/lib/api.ts`.
3. Follow public source data to `AuthController.getRaspGroups`, `getRaspSchedule`, and `RaspScraperService`.

## Change boundary

Treat upstream schedule IDs as external source identifiers; do not link them to local Pair Space UUID routes. Label the view as SIBIT data, retain account scoping for favorite group IDs, identify the schedule cache as a public source snapshot, and do not infer a campus building from the room number.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
