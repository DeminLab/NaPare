# Source card: `apps/web-portal/src/app/career/StudentPlanning.tsx`

## Canonical source

`apps/web-portal/src/app/career/StudentPlanning.tsx`

## Scope

Student work windows, time budget, blocked periods, private planning summary and next-step checklist. Declared values are saved only by explicit action.

## Read sequence

Read AI_CONTEXT.md, [career plan](../../product/career-ai-development-plan.md), canonical source and direct callers.

## Change boundary

Availability and academic schedule are private to the student. Employers only see minimal approved-skill basis relevant to their actual applicants/tasks. Never infer payment or ability from attendance/grades.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
