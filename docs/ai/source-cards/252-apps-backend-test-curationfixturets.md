# Source card: `apps/backend/test/curation.fixture.ts`

## Canonical source

`apps/backend/test/curation.fixture.ts`

## Scope

Real application, JWT and disposable local PostgreSQL fixtures. Rejects nonlocal/non-test databases and nonempty user data.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand curation.e2e-spec
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
