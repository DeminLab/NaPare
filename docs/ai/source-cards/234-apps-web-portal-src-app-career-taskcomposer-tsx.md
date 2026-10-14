# Source card: `apps/web-portal/src/app/career/TaskComposer.tsx`

## Canonical source

`apps/web-portal/src/app/career/TaskComposer.tsx`

## Scope

Three-step task draft with validated current step and explicit preview; never publishes.

## Read sequence

Read AI_CONTEXT.md, project map, the canonical source and its direct imports.

## Change boundary

Keep API and role permissions; do not invent data or automatic decisions.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
