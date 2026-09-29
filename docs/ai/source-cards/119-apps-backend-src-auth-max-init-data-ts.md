# Source card: `apps/backend/src/auth/max-init-data.ts`

## Canonical source

`apps/backend/src/auth/max-init-data.ts`

## Scope

Pure server-side validation of MAX Mini App `initData`: parse launch params, rebuild the data-check string, verify the HMAC-SHA256 signature (`WebAppData` + `MAX_BOT_TOKEN`) with timing-safe comparison, and enforce `auth_date` freshness (`maxAgeSeconds`, future skew). Application configuration defaults `MAX_INIT_DATA_TTL_SECONDS` to 900 seconds (15 minutes).

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the backend auth map.
2. Read this canonical source file.
3. Follow callers: `AuthService.maxAuth` and `AuthService.linkMaxToAuthenticatedUser` (`auth.service.ts`) and the contracts in `docs/api/contracts.md` §1.10.

## Change boundary

Never weaken the signature check, the timing-safe comparison or the `auth_date` window without an explicit security decision. Keep the algorithm aligned with the MAX validation spec (sort keys with `localeCompare`, URL-decode values, exclude `hash`, join with `\n`). Behavior is pinned by `max-init-data.spec.ts`.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/auth/max-init-data.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
