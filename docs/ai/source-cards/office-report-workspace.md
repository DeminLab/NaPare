# Source card: office-report-workspace

## Canonical source

`apps/web-admin/src/app/(admin)/requests/reports/OfficeReports.tsx`

## Scope

Current-account counts and dated source coverage, separately paginated debt records, current-page CSV with formula escaping, retry and cross-tab identity clearing. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
