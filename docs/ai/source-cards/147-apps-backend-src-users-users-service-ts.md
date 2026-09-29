# Source card: `apps/backend/src/users/users.service.ts`

## Canonical source

`apps/backend/src/users/users.service.ts`

## Scope

Tenant-aware user persistence, including atomic MAX binding and one-time Telegram account-link challenges stored as hashes and consumed transactionally.

## Read sequence

1. Read [the Auth module](../../modules/auth.md).
2. Read this service and `apps/backend/src/auth/auth.service.ts`.
3. Follow entity constraints in `User`, `TelegramLinkChallenge` and the auth service.

## Change boundary

`bindMaxUserIdIfUnlinked` must not replace an existing MAX identity. Telegram challenge codes must be single-use, expire, and bind a unique Telegram identity without exposing its ID through the user API.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/users/users.service.spec.ts src/auth/auth.service.spec.ts --runInBand --forceExit
```
