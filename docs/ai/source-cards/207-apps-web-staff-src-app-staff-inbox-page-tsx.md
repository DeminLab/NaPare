# Source card: `apps/web-staff/src/app/(staff)/inbox/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/inbox/page.tsx`

## Scope

Staff action queue grouped by event category. Real priority and dueAt determine ordering across loaded items. Completion is explicit, distinct from resolving the source absence or lesson operation. Older items are appended from the optional offset endpoint while preserving the existing array response and tenant scope.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve role access and base paths. The inbox API accepts an optional `offset` for backward-compatible continuation; existing callers still receive the same array response. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
