# Source card: `apps/backend/src/auth/max-init-data.spec.ts`

## Canonical source

`apps/backend/src/auth/max-init-data.spec.ts`

## Scope

Unit tests for MAX `initData` validation: valid signatures (plain and `#WebAppData=` fragment form), tampering, wrong bot token, missing/duplicated/non-hex hash, TTL boundary, future-dated `auth_date`, malformed user JSON.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md).
2. Read this spec together with `apps/backend/src/auth/max-init-data.ts`.
3. If a validation case changes, update both files and `docs/api/contracts.md` §1.10.

## Change boundary

The spec builds expected signatures independently with `node:crypto` — do not replace it with a call into the production helper, otherwise a broken algorithm would still pass. Keep the bot token fixture fake (`1234567890:TEST-BOT-TOKEN`).

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/auth/max-init-data.spec.ts
```
