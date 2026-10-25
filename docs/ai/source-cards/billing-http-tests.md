# Source card: apps/backend/test/career-billing.e2e-spec.ts

## Canonical source

`apps/backend/test/career-billing.e2e-spec.ts`

## Scope

Real PostgreSQL and HTTP tests with strictly mocked bank transport.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [T-Kassa integration](../../integrations/tkassa.md) and the canonical source.

## Verification

Run billing protocol/HTTP tests, backend and portal typechecks, and repository guards.
