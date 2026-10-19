# Source card: Platform discussions service

## Canonical source

`apps/backend/src/platform-discussions/platform-discussions.service.ts`

## Scope

Searches and audits message access, validates connected Pair Space resources, updates text, and records reversible hide/restore actions. Delegated grants are restricted to their university scope for search, detail reads, edits, and moderation; the owner and global grants retain all-university access.

## Change boundary

Mutations use row locks and a transaction with the audit write. Search summaries omit the full message; detail reads require `discussion-data.read` and are audited. All rows are attributed through the canonical PairSpace university and a same-university lesson; out-of-scope detail and mutation requests are denied.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
