# Source card: `apps/web-portal/src/app/career/SkillInput.tsx`

## Canonical source

`apps/web-portal/src/app/career/SkillInput.tsx`

## Scope

Explicit skill tags, up to twenty skills, preserving existing profile contract.

## Read sequence

Read AI_CONTEXT.md, project map, the canonical source and its direct imports.

## Change boundary

Keep API and role permissions; do not invent data or automatic decisions.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
