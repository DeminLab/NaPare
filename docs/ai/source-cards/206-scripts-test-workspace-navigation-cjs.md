# Source card: `scripts/test-workspace-navigation.cjs`

## Canonical source

`scripts/test-workspace-navigation.cjs`

## Scope

Node regression tests of actual TypeScript navigation helpers, including route specificity, search URLs, legacy lesson tabs and invalid dates.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
node scripts/test-workspace-navigation.cjs
```
