# Source card: `packages/ui/src/workspace-navigation.ts`

## Canonical source

`packages/ui/src/workspace-navigation.ts`

## Scope

Pure navigation matching, safe search destinations, exact preparation/material tabs, compatible lesson tab parsing and strict calendar dates. Lesson search descriptions include the existing response date in the browser timezone so repeated subjects are distinguishable.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
node scripts/test-workspace-navigation.cjs
```
