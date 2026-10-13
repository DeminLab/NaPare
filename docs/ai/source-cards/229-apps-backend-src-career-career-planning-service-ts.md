# Source card: `apps/backend/src/career/career-planning.service.ts`

## Canonical source

`apps/backend/src/career/career-planning.service.ts`

## Scope

Deterministic seven-day own-student availability and task fit. Missing settings/schedule remain unknown; no grades, AI or automatic time-based eligibility decisions.

## Read sequence

Read AI_CONTEXT.md, [career plan](../../product/career-ai-development-plan.md), canonical source and direct callers.

## Change boundary

Availability and academic schedule are private to the student. Employers only see minimal approved-skill basis relevant to their actual applicants/tasks. Never infer payment or ability from attendance/grades.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
