# Source card: `apps/backend/src/migrations/1700000000019-CareerAvailability.ts`

## Canonical source

`apps/backend/src/migrations/1700000000019-CareerAvailability.ts`

## Scope

Additive availability, task level/requirements and explicit admission basis migration. Legacy basis stays unspecified.

## Read sequence

Read AI_CONTEXT.md, [career plan](../../product/career-ai-development-plan.md), canonical source and direct callers.

## Change boundary

Availability and academic schedule are private to the student. Employers only see minimal approved-skill basis relevant to their actual applicants/tasks. Never infer payment or ability from attendance/grades.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
