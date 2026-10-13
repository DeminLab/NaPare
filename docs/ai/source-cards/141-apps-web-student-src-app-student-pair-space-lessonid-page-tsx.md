# Source card: `apps/web-student/src/app/(student)/pair-space/[lessonId]/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/pair-space/[lessonId]/page.tsx`

## Scope

Lesson overview previews the nearest preparation topics with personal progress and exact topic anchors. Pinned announcements come first. Discussion has an explicitly labelled multiline composer; sending is deliberate and concurrent submits are blocked.

## Read sequence

1. Read [the Pair Space module](../../modules/pair-space.md) and [the schedule module](../../modules/schedule.md).
2. Read this route and `apps/web-student/src/lib/api.ts`.
3. Follow Pair Space data to `PairSpaceService`, and change history to `ScheduleController`/`ScheduleService`.

## Change boundary

Do not expose the legacy homework submission endpoint as the product's task-completion flow. Keep assignment submission and grading in Moodle.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
