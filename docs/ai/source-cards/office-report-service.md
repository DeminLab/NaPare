# Source card: office-report-service

## Canonical source

`apps/backend/src/requests/office-report.service.ts`

## Scope

Scoped current-account aggregates, confirmed complete group debt snapshots, canonical replay, historical retention and SQL pagination. Excludes ambiguous group keys and moved/inactive students; never infers debts from LMS grades. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
