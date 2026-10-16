# Source card: `apps/web-student/src/app/(student)/week/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/week/page.tsx`

## Scope

Student week/day/agenda schedule with URL state, favorites and offline cache. Week mode shows wide day panels on every screen; day mode uses the date picker and previous/next-day controls. An optional wide, horizontally scrollable table keeps a sticky time column. Lesson titles are 16px and wrap instead of truncating; teacher and location are separate 14px lines. Shared lesson-type badges distinguish lecture, practice and lab in week, day, agenda and table cards. Export and share actions are progressively disclosed.

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
