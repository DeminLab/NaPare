# Source card: office-report-controller

## Canonical source

`apps/backend/src/requests/office-report.controller.ts`

## Scope

Three additive authenticated report/import routes. Fresh office/dean/admin scope and admin-only import are checked by the service. Responses are private/no-store. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
