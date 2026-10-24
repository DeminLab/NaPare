# Source card: office-report-entities

## Canonical source

`apps/backend/src/requests/office-report.entities.ts`

## Scope

Versioned group snapshots and student-linked academic debt records. Previous snapshots survive replacement and account pseudonymization; no names or contacts are added as columns. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
