# Source card: `apps/web-student/src/app/(student)/today/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/today/page.tsx`

## Scope

Student Today prioritises the current/next lesson, important events and preparation. Quick actions expose QR attendance, absence requests and schedule; preparation links open the exact lesson tab.

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
