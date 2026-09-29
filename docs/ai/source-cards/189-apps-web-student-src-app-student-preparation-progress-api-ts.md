# Source card: `apps/web-student/src/app/(student)/preparation-progress-api.ts`

## Canonical source

`apps/web-student/src/app/(student)/preparation-progress-api.ts`

## Scope

Keeps pending personal preparation-state and checklist changes in an account-scoped browser queue and retries them when connectivity returns.

## Read sequence

1. Read `PreparationProgressControl.tsx` for the UI caller.
2. Read the backend progress endpoint and verify that account scope is only a local storage namespace; the backend remains the authorization boundary.

## Change boundary

Never queue credentials or submission data. Keep queued state isolated by tenant and account and send it only to the authenticated progress endpoint.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
