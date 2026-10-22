# Source card: apps/backend/src/notifications/entities/notification-delivery.entity.ts

## Canonical source

`apps/backend/src/notifications/entities/notification-delivery.entity.ts`

## Scope

Tenant-scoped delivery state, unique target, attempts and bounded durable history.

## Read sequence

1. Read [notification delivery](../../integrations/notification-delivery.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests, backend typecheck and repository guards. The E2E suite requires a fresh loopback curation_test_* database owned by a NOSUPERUSER NOBYPASSRLS role and a dedicated test Redis. External providers remain mocked; never use production credentials.
