# Source card: office-report-migration

## Canonical source

`apps/backend/src/migrations/1700000000042-OfficeReports.ts`

## Scope

Additive tables, unique current group snapshot, restrictive tenant policies, own-export selectors and active-writer triggers. Destructive rollback is refused. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
