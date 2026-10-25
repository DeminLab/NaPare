# Source card: office-report-page

## Canonical source

`apps/web-admin/src/app/(admin)/requests/reports/page.tsx`

## Scope

Server route metadata and the own-university report workspace. Uses an existing content link; shared navigation/header and student files remain outside this change. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
