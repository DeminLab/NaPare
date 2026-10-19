# Source card: Platform attachment moderation migration

## Canonical source

`apps/backend/src/migrations/1700000000025-PlatformAttachmentModeration.ts`

## Scope

Adds reversible moderation state and an index to PairSpace file attachment records.

## Change boundary

Preserve file references and use the migration rollback to remove only the moderation columns and index.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
