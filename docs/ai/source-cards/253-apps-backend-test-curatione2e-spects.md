# Source card: `apps/backend/test/curation.e2e-spec.ts`

## Canonical source

`apps/backend/test/curation.e2e-spec.ts`

## Scope

Real HTTP/JWT/PostgreSQL tests for assignments, tenants, self-review, concurrency, notifications, migration and revocation without login. Skipped without CURATION_TEST_DATABASE_URL.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand curation.e2e-spec
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
