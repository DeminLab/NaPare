# Source card: `apps/web-student/src/app/(student)/today/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/today/page.tsx`

## Scope

Student My Day UI, including the current/next lesson with building, room and subgroup and upstream odd/even week when supplied, daily timeline, overlapping lesson warnings, schedule changes, announcements, and preparation reminders returned by `/my-day`. Deadline labels reflect the actual local calendar distance instead of labeling every future item "this week". Sends the browser's IANA timezone and uses an account-scoped same-day cache that renders immediately while the API refreshes, preserving the saved view when offline.

## Read sequence

1. Read [the My Day module](../../modules/my-day.md) and [the student screen guide](../../ui/screens-student.md).
2. Read this route, `apps/web-student/src/lib/api.ts`, `apps/web-student/src/app/(student)/internal-navigation.ts`, and `schedule-location.ts` for safe notification destinations and location labels.
3. Follow the `/my-day` response to its backend service.

## Change boundary

Use only role-scoped backend data. Keep the offline cache scoped by JWT subject and university, and only reuse it for the current local date and timezone. Restrict notification destinations to internal paths. Do not imply NaPare accepts or grades submissions; those remain in Moodle.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
