# Source card: SIBIT parser wrapper and explicit Moodle calendar group/time mapping

## Canonical source

`apps/backend/src/schedule/connectors/external-schedule-connectors.ts`

## Scope

SIBIT parser wrapper and explicit Moodle calendar group/time mapping. See [university import reference](../../integrations/schedule-import.md).

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and its direct imports.

## Verification

Run focused adapter tests, schedule-import HTTP tests with a disposable local database, backend typecheck and repository guards.
