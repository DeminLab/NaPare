# Source card: Platform discussions module

## Canonical source

`apps/backend/src/platform-discussions/platform-discussions.module.ts`

## Scope

Registers the platform message moderation controller and its repositories.

## Change boundary

Depends on the owner-managed platform permission service and never exposes a generic table editor.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
