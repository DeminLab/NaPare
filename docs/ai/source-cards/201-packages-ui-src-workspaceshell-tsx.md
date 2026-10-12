# Source card: `packages/ui/src/WorkspaceShell.tsx`

## Canonical source

`packages/ui/src/WorkspaceShell.tsx`

## Scope

Shared role shell groups navigation, keeps four primary mobile destinations and More, provides one scoped search with keyboard/focus management and useful role help. The dismissible welcome only appears on the role home page, avoiding repeated banners on every screen.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
pnpm typecheck
```
