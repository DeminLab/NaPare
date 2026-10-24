# Source card: apps/backend/test/tenant-isolation.e2e-spec.ts

## Canonical source

`apps/backend/test/tenant-isolation.e2e-spec.ts`

## Scope

Real JWT HTTP and PostgreSQL tenant boundary regression tests.

Each resource read and ordinary mutation has a successful B-actor control before the A-actor denial. Mutation controls use separate copies, including deletes. Snapshot every B-owned entity plus linked content before/after the negative request; drain real async notification work through a delegating spy. Empty filtered absence aggregates preserve the existing API contract. See [business probe evidence and limits](../../security/business-tenant-probes-2026-10-25.md); do not describe this subset as coverage of every route.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and direct dependencies.

## Verification

Run focused backend tests, backend typecheck, and repository guards.
