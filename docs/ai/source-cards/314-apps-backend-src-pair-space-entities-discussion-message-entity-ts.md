# Source card: Discussion message entity

## Canonical source

`apps/backend/src/pair-space/entities/discussion-message.entity.ts`

## Scope

Stores Pair Space discussion content and reversible moderation metadata.

## Change boundary

Hidden messages remain stored for audit and restoration but are filtered from normal Pair Space responses.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
