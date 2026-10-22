# Source card: Tenant durable import payload, idempotency and attempt state

## Canonical source

`apps/backend/src/schedule/connectors/schedule-import-job.entity.ts`

## Scope

Tenant durable import payload, idempotency and attempt state. See [university import reference](../../integrations/schedule-import.md).

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and its direct imports.

## Verification

Run focused adapter tests, schedule-import HTTP tests with a disposable local database, backend typecheck and repository guards.
