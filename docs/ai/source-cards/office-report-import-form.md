# Source card: office-report-import-form

## Canonical source

`apps/web-admin/src/app/(admin)/requests/reports/DebtImportForm.tsx`

## Scope

Admin-only explicit JSON-file source confirmation. Preserves replay key for an unchanged retry, bounds file size and record count, ignores stale file reads and aborts on unmount. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
