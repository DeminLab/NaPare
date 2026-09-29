# Source card: `apps/web-student/src/app/(student)/pair-space/[lessonId]/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/pair-space/[lessonId]/page.tsx`

## Scope

Student lesson Pair Space: preparation notes, announcements, materials, messages, an account-scoped offline snapshot, account-synced personal notes with an offline local copy, role-scoped schedule change history with old/new subject, start/end date and time, location, and teacher values, a role-scoped recent subject timeline, and the lesson location when building data is available.

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
