# Source card: Link SIBIT teacher DTO

## Canonical source

`apps/backend/src/admin/dto/link-sibit-teacher.dto.ts`

## Scope

Validates the nullable external SIBIT teacher ID used by the university-admin account-link route.

## Change boundary

The controller remains role- and tenant-scoped. IDs must come from the current source teacher catalog before the schedule sync runs.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
