# Source card: apps/backend/src/migrations/1700000000029-TenantRowSecurity.ts

## Canonical source

`apps/backend/src/migrations/1700000000029-TenantRowSecurity.ts`

## Scope

FORCE RLS and mandatory restrictive CRUD policies for scalar university columns; explicit identity and company relations.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests and typecheck. PostgreSQL tests require a separate local disposable cluster and TENANT_RLS_TEST_ADMIN_URL; never use production.
