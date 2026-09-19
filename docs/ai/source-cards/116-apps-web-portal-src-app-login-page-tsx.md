# Source card: `apps/web-portal/src/app/login/page.tsx`

## Canonical source

`apps/web-portal/src/app/login/page.tsx`

## Scope

Shared NaPare main-site login. It stores the existing token pair only after `POST /api/v1/auth/portal-login` succeeds, then selects a same-origin workspace from the backend-provided workspace value.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the backend auth source card.
2. Read this canonical source and `apps/backend/src/auth/auth.service.ts`.
3. Trace the Nginx route and each target workspace before changing a destination.

## Change boundary

Do not pass access or refresh tokens in a URL. Developer access intentionally uses its separate login.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
pnpm --filter @napare/backend exec jest --runInBand auth.service.spec.ts
```
