# Source card: apps/backend/test/tenant-database.fixture.ts

## Canonical source

`apps/backend/test/tenant-database.fixture.ts`

## Scope

Disposable-database-only explicit test setup/assertion capabilities, separate from HTTP request access.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests and typecheck. PostgreSQL tests require a separate local disposable cluster and TENANT_RLS_TEST_ADMIN_URL; never use production.
