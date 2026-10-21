# Source card: `apps/backend/test/role-policy.e2e-spec.ts`

## Canonical source

`apps/backend/test/role-policy.e2e-spec.ts`

## Scope

Signed JWTs, real JwtStrategy and guards use original controller/handler metadata through a synthetic HTTP probe for every declared protected route and role. Missing/invalid JWTs and technical roles without a university are covered. The users repository is in memory; controller bodies, PostgreSQL, ownership and platform grants are not exercised.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand role-policy.e2e-spec
```
