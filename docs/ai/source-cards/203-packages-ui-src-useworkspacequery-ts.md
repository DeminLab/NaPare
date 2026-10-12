# Source card: `packages/ui/src/useWorkspaceQuery.ts`

## Canonical source

`packages/ui/src/useWorkspaceQuery.ts`

## Scope

Client hook that restores view/filter parameters on entry and browser Back, and preserves Next history metadata when updating shareable URLs.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
pnpm typecheck
```
