# Source card: apps/backend/src/migrations/1700000000035-CareerBilling.ts

## Canonical source

`apps/backend/src/migrations/1700000000035-CareerBilling.ts`

## Scope

Production company billing schema and monetary constraints.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [T-Kassa integration](../../integrations/tkassa.md) and the canonical source.

## Verification

Run billing protocol/HTTP tests, backend and portal typechecks, and repository guards.
