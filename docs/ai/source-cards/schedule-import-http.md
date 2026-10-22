# Source card: Real JWT HTTP and non-superuser PostgreSQL import regression tests

## Canonical source

`apps/backend/test/schedule-import.e2e-spec.ts`

## Scope

Real JWT HTTP and non-superuser PostgreSQL import regression tests. See [university import reference](../../integrations/schedule-import.md).

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and its direct imports.

## Verification

Run focused adapter tests, schedule-import HTTP tests with a disposable local database, backend typecheck and repository guards.
