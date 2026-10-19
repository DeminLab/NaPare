# Source card: PairSpace entity

## Canonical source

`apps/backend/src/pair-space/entities/pair-space.entity.ts`

## Scope

Tenant-owned lesson workspace with schedule and academic catalog links, synchronization metadata, lifecycle state, and child announcements, homework, files, and discussion messages.

## Change boundary

Treat schedule-derived fields and relationship IDs as source-managed. Platform corrections must preserve tenant and lesson ownership and use domain-specific validation.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
