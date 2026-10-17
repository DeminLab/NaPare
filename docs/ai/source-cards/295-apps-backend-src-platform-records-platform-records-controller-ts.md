# Source card: `apps/backend/src/platform-records/platform-records.controller.ts`

## Canonical source

`apps/backend/src/platform-records/platform-records.controller.ts`

## Scope

Search users and expose domain-specific endpoints for their personal records.

## Change boundary

Use validated DTOs and leave authorization, relationship validation, and auditing in the service.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
