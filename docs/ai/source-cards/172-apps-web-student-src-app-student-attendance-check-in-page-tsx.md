# Source card: `apps/web-student/src/app/(student)/attendance/check-in/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/attendance/check-in/page.tsx`

## Scope

Authenticated student QR check-in result and Pair Space follow-up. When opened inside MAX without a token, the page prefers MAX's native camera QR reader. If that bridge method is absent or rejects on a particular client, it uses a secure-context browser camera and the bundled ZXing QR decoder. It only accepts a same-origin URL for this exact check-in route, removes a directly opened one-time token from the browser URL/history, then sends the token to the authenticated API.

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
