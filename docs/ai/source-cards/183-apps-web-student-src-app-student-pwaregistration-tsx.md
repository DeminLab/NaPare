# Source card: `apps/web-student/src/app/(student)/PwaRegistration.tsx`

## Canonical source

`apps/web-student/src/app/(student)/PwaRegistration.tsx`

## Scope

Registers the public service worker within the deployed Student `/student/` path.

## Read sequence

1. Read `apps/web-student/next.config.js` for the base path.
2. Read the public service worker it registers.

## Change boundary

Keep worker URL and scope aligned with the Student base path.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
