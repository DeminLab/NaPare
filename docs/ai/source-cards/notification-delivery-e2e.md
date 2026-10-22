# Source card: apps/backend/test/notification-delivery.e2e-spec.ts

## Canonical source

`apps/backend/test/notification-delivery.e2e-spec.ts`

## Scope

Actual non-superuser PostgreSQL and Redis tests: atomic outbox, JWT registration, FORCE RLS, retry and dead letters.

## Read sequence

1. Read [notification delivery](../../integrations/notification-delivery.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests, backend typecheck and repository guards. The E2E suite requires a fresh loopback curation_test_* database owned by a NOSUPERUSER NOBYPASSRLS role and a dedicated test Redis. External providers remain mocked; never use production credentials.
