# Source card: `apps/web-portal/src/app/login/page.tsx`

## Canonical source

`apps/web-portal/src/app/login/page.tsx`

## Scope

Portal login shows university email/password immediately, offers password visibility and inline validation, and keeps MAX as an alternative; MAX launch data opens the relevant section automatically. Session contracts are unchanged.

The October 16 visual revision uses one centered form with the brand; the explanatory desktop aside is removed. Mobile has no surrounding card border.

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
