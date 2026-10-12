# Source card: `apps/web-staff/src/app/(staff)/AttentionNavigation.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/AttentionNavigation.tsx`

## Scope

Links between actionable inbox tasks and all staff notifications. Reading an event and completing a task remain separate operations.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
