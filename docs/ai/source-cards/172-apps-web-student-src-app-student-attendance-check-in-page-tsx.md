# Source card: `apps/web-student/src/app/(student)/attendance/check-in/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/attendance/check-in/page.tsx`

## Scope

Historical check-in URL offers direct links to the schedule and absence requests, with one short note that the teacher owns attendance marks. The page does not scan, submit tokens or request camera access. Attendance self-check-in is no longer exposed in the student UI.

## Change boundary

Preserve the existing API routes. This product change removes the QR workflow from active staff/student interfaces; the server API is retained for compatibility.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
