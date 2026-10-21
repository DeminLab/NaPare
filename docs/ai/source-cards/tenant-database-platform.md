# Source card: apps/backend/src/common/tenant/tenant-database-platform.ts

## Canonical source

`apps/backend/src/common/tenant/tenant-database-platform.ts`

## Scope

Least-scope platform permission mapping to tenant tables and read/write capabilities.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests and typecheck. PostgreSQL tests require a separate local disposable cluster and TENANT_RLS_TEST_ADMIN_URL; never use production.

