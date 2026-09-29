# Source card: `apps/web-portal/src/app/login/page.tsx`

## Canonical source

`apps/web-portal/src/app/login/page.tsx`

## Scope

Shared NaPare main-site login. The user chooses MAX or university email/password. Password login stores the token pair only after `POST /api/v1/auth/portal-login` succeeds and selects a same-origin workspace from the backend-provided workspace value. MAX login starts only after its explicit button; linking is managed separately on `/connections`.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the backend auth source card.
2. Read this canonical source and `apps/backend/src/auth/auth.service.ts`.
3. Trace the Nginx route and each target workspace before changing a destination.

## Change boundary

Do not pass access or refresh tokens in a URL. All account roles, including developer, use this shared form and are redirected to their same-origin workspace.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
pnpm --filter @napare/backend exec jest --runInBand auth.service.spec.ts
```
