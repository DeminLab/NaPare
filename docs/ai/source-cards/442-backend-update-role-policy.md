# Source card: `apps/backend/test/update-role-policy.ts`

## Canonical source

`apps/backend/test/update-role-policy.ts`

## Scope

Explicitly updates the reviewed route/permission baseline and docs/security/role-matrix.md from source metadata. Review ACL differences before accepting regenerated files. CI never updates the expected baseline automatically.

## Verification

```powershell
pnpm --filter @napare/backend exec ts-node --transpile-only test/update-role-policy.ts
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand role-policy.e2e-spec
```
