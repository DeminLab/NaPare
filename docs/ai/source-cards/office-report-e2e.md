# Source card: office-report-e2e

## Canonical source

`apps/backend/test/office-reports.e2e-spec.ts`

## Scope

Actual JWT/HTTP/PostgreSQL with NOSUPERUSER/NOBYPASSRLS: positive foreign control, negative access, replay, history, 105-row paging, ambiguous groups, revoked grants, own export and account archive. Read the [office report contract](../../modules/academic-office-reports.md).

## Verification

Run office-report HTTP/PostgreSQL E2E, affected backend/admin typechecks, reviewed route baseline, lint/docs guards and browser checks. Synthetic source attestations do not prove a real university register or production deployment.
