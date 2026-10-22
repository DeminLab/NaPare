# Source card: `apps/backend/test/fixtures/role-policy.json`

## Canonical source

`apps/backend/test/fixtures/role-policy.json`

## Scope

Reviewed snapshot of all source controller declarations, 11 roles, ROLE_PERMISSIONS and expected admission statuses for the synthetic HTTP guard probe. This is not a complete service/resource authorization policy.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand role-policy.e2e-spec
```
