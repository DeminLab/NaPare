# Source card: `apps/backend/src/admin/dto/reset-university-user-password.dto.ts`

## Canonical source

`apps/backend/src/admin/dto/reset-university-user-password.dto.ts`

## Scope

Validation contract for a university administrator to issue a replacement temporary password.

## Change boundary

Keep password requirements aligned with the administrative service and do not expose password hashes in HTTP responses.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
