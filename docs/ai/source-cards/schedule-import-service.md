# Source card: Atomic queued imports, source ownership and ScheduleChange deltas

## Canonical source

`apps/backend/src/schedule/connectors/schedule-import.service.ts`

## Scope

Atomic queued imports, source ownership and ScheduleChange deltas. See [university import reference](../../integrations/schedule-import.md).

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and its direct imports.

## Verification

Run focused adapter tests, schedule-import HTTP tests with a disposable local database, backend typecheck and repository guards.
