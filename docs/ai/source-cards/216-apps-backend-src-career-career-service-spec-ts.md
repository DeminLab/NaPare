# Source card: `apps/backend/src/career/career.service.spec.ts`

## Canonical source

`apps/backend/src/career/career.service.spec.ts`

## Scope

Career module: student professional profiles, scoped career-center/company permissions and task lifecycle. Payment provider is intentionally empty; accepted work does not mean paid. Telegram is not used. See [career domain](../../modules/career.md).

## Read sequence

Read AI_CONTEXT.md, docs/modules/career.md, this canonical source and its direct imports before changing behavior.

## Change boundary

Preserve academic tenant isolation. Employer accounts cannot read university records. Only verified students with an exact approved skill may apply to profiled tasks; publication needs both parties' consent. Never expose correct test answers or infer a payment.

Career test list coverage verifies rolling-day attempt counts are scoped to the signed-in student, included only in paginated student responses, and omitted from career-center results; answer keys remain private.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
