# Source card: `apps/web-student/src/app/(student)/manifest.webmanifest/route.ts`

## Canonical source

`apps/web-student/src/app/(student)/manifest.webmanifest/route.ts`

## Scope

PWA manifest for the Student web client, including `/student/` scope and install launch route. Layout metadata points to `/student/manifest.webmanifest` because the application uses that basePath.

## Read sequence

1. Read the Student root layout metadata.
2. Check the deployment `basePath` in `apps/web-student/next.config.js`.

## Change boundary

Keep all URLs within the Student base path and use the existing app icon.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
