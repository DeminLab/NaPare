# Source card: `apps/backend/src/migrations/1700000000018-CareerAiDrafts.ts`

## Canonical source

`apps/backend/src/migrations/1700000000018-CareerAiDrafts.ts`

## Scope

Additive migration for author case text and content-free AI request ledger; original work/review data is preserved.

## Read sequence

Read AI_CONTEXT.md, [career AI plan](../../product/career-ai-development-plan.md), the canonical source and direct consumers.

## Change boundary

Keep original accepted results and consent unchanged. Never infer payment, publish generated content automatically or expose provider credentials.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
