# Source card: `apps/backend/src/career/career-ai.service.spec.ts`

## Canonical source

`apps/backend/src/career/career-ai.service.spec.ts`

## Scope

Tests AI authorization, consent, disabled configuration, quotas, minimization and invalid/upstream responses with synthetic provider mocks.

## Read sequence

Read AI_CONTEXT.md, [career AI plan](../../product/career-ai-development-plan.md), the canonical source and direct consumers.

## Change boundary

Keep original accepted results and consent unchanged. Never infer payment, publish generated content automatically or expose provider credentials.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
