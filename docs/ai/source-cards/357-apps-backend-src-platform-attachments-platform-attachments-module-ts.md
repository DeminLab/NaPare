# Source card: Platform attachments module

## Canonical source

`apps/backend/src/platform-attachments/platform-attachments.module.ts`

## Scope

Registers the protected developer API for PairSpace attachment metadata and reversible moderation.

## Change boundary

Keep access behind platform permissions and use the existing PairSpace, lesson and university entities.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
