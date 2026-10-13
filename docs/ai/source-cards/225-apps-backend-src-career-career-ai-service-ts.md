# Source card: `apps/backend/src/career/career-ai.service.ts`

## Canonical source

`apps/backend/src/career/career-ai.service.ts`

## Scope

Backend AI adapter, scoped explicit requests, durable UTC-day quotas and validated draft JSON. No configured provider means 503 without external requests.

## Read sequence

Read AI_CONTEXT.md, [career AI plan](../../product/career-ai-development-plan.md), the canonical source and direct consumers.

## Change boundary

Keep original accepted results and consent unchanged. Never infer payment, publish generated content automatically or expose provider credentials.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
