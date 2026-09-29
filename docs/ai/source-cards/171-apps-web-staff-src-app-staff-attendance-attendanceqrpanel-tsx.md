# Source card: `apps/web-staff/src/app/(staff)/attendance/AttendanceQrPanel.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/attendance/AttendanceQrPanel.tsx`

## Scope

Teacher QR generation, 90-second expiry display and QR refresh for a selected lesson. The helper text explains the student flow from MAX and the in-app scanner.

## Read sequence

1. Read [the Absences module](../../modules/absences.md).
2. Read this component and the staff attendance page.
3. Follow QR creation to the staff endpoint and `AbsencesService`.

## Change boundary

Do not put auth credentials into the QR URL. Keep the opaque token in the URL fragment and render expiry/revocation state.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
