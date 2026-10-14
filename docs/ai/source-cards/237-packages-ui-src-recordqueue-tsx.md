# Source card: `packages/ui/src/RecordQueue.tsx`

## Canonical source

`packages/ui/src/RecordQueue.tsx`

## Scope

Accessible shared queue for staff attention and absence review; data passed by authorized caller.

## Read sequence

Read AI_CONTEXT.md, project map, the canonical source and its direct imports.

## Change boundary

Keep API and role permissions; do not invent data or automatic decisions.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
