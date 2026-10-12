# Source card: `apps/web-staff/src/app/(staff)/attendance/AttendanceQrPanel.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/attendance/AttendanceQrPanel.tsx`

## Scope

Teacher QR generation and refresh retain the 90-second expiry and lesson time window. A copy-link alternative supports students using the current browser, handles clipboard failure and never extends the QR validity.

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
