# Source card: Academic event moderation migration

## Canonical source

`apps/backend/src/migrations/1700000000026-AcademicEventModeration.ts`

## Scope

Adds reversible hidden-state metadata and a visibility index to academic events.

## Change boundary

Preserve existing event rows and support rolling back the added columns and index.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
