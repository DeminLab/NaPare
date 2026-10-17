# Source card: Platform discussions service

## Canonical source

`apps/backend/src/platform-discussions/platform-discussions.service.ts`

## Scope

Searches and audits message access, validates connected Pair Space resources, updates text, and records reversible hide/restore actions.

## Change boundary

Mutations use row locks and a transaction with the audit write. Search summaries omit the full message; detail reads require `discussion-data.read` and are audited.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
