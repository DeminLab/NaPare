# Source card: `apps/web-student/src/app/(student)/week/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/week/page.tsx`

## Scope

Student Monday-to-Sunday weekly schedule, including building/room/subgroup/upstream week-parity display and search, notification date deep links, API-backed date grouping, per-account cached week shown immediately while freshness is checked in the background and retained when offline, lesson type filters, server-synced favorite teachers with a queued local offline fallback/migration, a favorites-only filter, individual Google Calendar event links for non-cancelled lessons, `.ics` export for the selected week that omits cancelled lessons, and selected-week sharing through MAX Bridge, Web Share or clipboard.

## Read sequence

1. Read [the schedule module](../../modules/schedule.md).
2. Read this route, `apps/web-student/src/lib/api.ts`, and `schedule-location.ts`.
3. Follow range data to `ScheduleController.findByDateRange` and the role-scoped schedule service.

## Change boundary

Use `startDate` for the lesson's calendar day and `startTime`/`endTime` for its local clock time. Key cache entries by the authenticated subject and university so a different account cannot reuse the cached week, and mark stale data with its save time. Keep sharing and bulk export limited to the selected/filtered week; sharing opens a MAX or OS composer and does not claim that a message was sent. `.ics` is an importable snapshot, not a live calendar subscription. Google Calendar event links are user-initiated and omit cancelled lessons. This cache does not make pair details or the whole application available offline.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
