# Source card: `apps/web-portal/src/app/career/CareerAssistants.tsx`

## Canonical source

`apps/web-portal/src/app/career/CareerAssistants.tsx`

## Scope

AI availability, explicit consent, task preview/apply and case preview/editor. Saves are manual and cases are hidden when edited.

## Read sequence

Read AI_CONTEXT.md, [career AI plan](../../product/career-ai-development-plan.md), the canonical source and direct consumers.

## Change boundary

Keep original accepted results and consent unchanged. Never infer payment, publish generated content automatically or expose provider credentials.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
