# Source card: `apps/backend/src/users/entities/telegram-link-challenge.entity.ts`

## Canonical source

`apps/backend/src/users/entities/telegram-link-challenge.entity.ts`

## Scope

Persistence shape for short-lived Telegram linking challenges. Only a SHA-256 hash of the random link code is stored.

## Read sequence

1. Read [the Auth module](../../modules/auth.md).
2. Read this entity, `apps/backend/src/users/users.service.ts` and the migration.

## Change boundary

Keep token hashes unique and challenge fields aligned with `TelegramAccountLink1700000000015`.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
