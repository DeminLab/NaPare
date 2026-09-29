# Source card: `apps/web-student/src/app/(student)/sw.js/route.ts`

## Canonical source

`apps/web-student/src/app/(student)/sw.js/route.ts`

## Scope

Serves the Student service worker and returns a generic, non-cached offline navigation response under the Student base path.

## Read sequence

1. Read the Student manifest and registration component.
2. Verify fetch handling remains limited to navigations and never caches API responses.

## Change boundary

Do not persist user-specific data or authenticated responses in the service worker.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
