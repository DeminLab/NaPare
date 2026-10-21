# Source card: `apps/backend/test/role-policy.fixture.ts`

## Canonical source

`apps/backend/test/role-policy.fixture.ts`

## Scope

Discovers real controller route metadata, class/method guards, role and permission overrides. Renders the reviewed guard-admission matrix; services and resource policies are outside its scope.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand role-policy.e2e-spec
```
