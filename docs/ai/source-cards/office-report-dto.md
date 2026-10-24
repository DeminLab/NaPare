# Source card: office-report-dto

## Canonical source

`apps/backend/src/requests/office-report.dto.ts`

## Scope

Strict own-group filters, paging, explicit official-source/full-group attestations and up to 2000 code-linked source rows. Date validation is completed by the service. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
