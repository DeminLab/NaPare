# Source card: `apps/web-student/src/app/(student)/attendance/check-in/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/attendance/check-in/page.tsx`

## Scope

QR attendance check-in via MAX or browser camera with explicit confirmation states and manual teacher-link fallback. Invalid origin/path/token is rejected; one submission runs at a time. Camera denial and unavailable hardware have separate guidance.

## Read sequence

1. Read [the Absences module](../../modules/absences.md).
2. Read this page and the student API helper.
3. Follow the endpoint's session, tenant, group and duplicate checks in `AbsencesService`.

## Change boundary

Read the opaque token from the URL fragment or a QR URL accepted by the native MAX scanner or browser camera, remove directly opened fragment data immediately, submit it only to the authenticated API and keep the result limited to the current student. Never navigate to a scanned URL or submit a token from another origin/path. Stop camera scanning when scanning is cancelled, completes or the page unmounts. Browser camera access requires HTTPS outside localhost; MAX's native scanner remains the preferred path when available and supported by that client.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
