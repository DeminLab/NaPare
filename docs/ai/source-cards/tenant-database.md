# Source card: apps/backend/src/common/tenant/tenant-database.ts

## Canonical source

`apps/backend/src/common/tenant/tenant-database.ts`

## Scope

Same-connection transaction-local tenant configuration, TypeORM runner interception and startup RLS invariants.

`SET TRANSACTION READ ONLY` is transaction control and must execute before injected settings queries. The self-export service starts this mode before taking its first snapshot query.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests and typecheck. PostgreSQL tests require a separate local disposable cluster and TENANT_RLS_TEST_ADMIN_URL; never use production.
