# Source card: apps/backend/src/notifications/delivery/push-providers.ts

## Canonical source

`apps/backend/src/notifications/delivery/push-providers.ts`

## Scope

Gated RuStore, WebPush, Telegram and MAX provider implementations and token validation.

## Read sequence

1. Read [notification delivery](../../integrations/notification-delivery.md).
2. Read [tenant isolation](../../security/tenant-isolation.md).
3. Read the canonical source and its direct dependencies.

## Verification

Run focused backend tests, backend typecheck and repository guards. The E2E suite requires a fresh loopback curation_test_* database owned by a NOSUPERUSER NOBYPASSRLS role and a dedicated test Redis. External providers remain mocked; never use production credentials.
