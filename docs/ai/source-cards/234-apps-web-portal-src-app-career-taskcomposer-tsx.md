# Source card: `apps/web-portal/src/app/career/TaskComposer.tsx`

## Canonical source

`apps/web-portal/src/app/career/TaskComposer.tsx`

## Scope

Three-step task draft with validated current step and explicit preview; never publishes.

## Read sequence

Read AI_CONTEXT.md, project map, the canonical source and its direct imports.

## Change boundary

Keep API and role permissions; do not invent data or automatic decisions.

The composer checks exact company/university partnership eligibility through the parent callback. The selection-change handler invalidates outstanding checks synchronously; the backend task-create guard remains authoritative. Its university selector pages and searches `/career/universities?workspace=employer`, keeps the selected university ID when options change, and displays the selected name in the draft preview.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
