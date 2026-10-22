# Source card: apps/backend/test/tenant-rls.e2e-spec.ts

## Canonical source

`apps/backend/test/tenant-rls.e2e-spec.ts`

## Scope

Real PostgreSQL non-superuser table-owner isolation, pooled TypeORM flows, CRUD, grants, authentication and career company relations.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests and typecheck. PostgreSQL tests require a separate local disposable cluster and TENANT_RLS_TEST_ADMIN_URL; never use production.

