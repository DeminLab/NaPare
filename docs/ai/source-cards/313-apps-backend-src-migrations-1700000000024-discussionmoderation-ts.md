# Source card: Discussion moderation migration

## Canonical source

`apps/backend/src/migrations/1700000000024-DiscussionModeration.ts`

## Scope

Adds moderation state, reason, actor and timestamp to persisted Pair Space messages.

## Change boundary

Existing messages default to visible. The down migration removes the index and added columns.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
