# Career university report: e2e

## Canonical source

`apps/backend/test/career-report.e2e-spec.ts`

## Scope

Disposable PostgreSQL/JWT tests for tenant boundaries, delegated rights, complete aggregates, actual XLSX and retained archive. Read [report contract](../../modules/career-university-report.md), existing career-center authorization and [tenant isolation](../../security/tenant-isolation.md) before editing. Do not infer employment, formal practice completion or payouts from an accepted work.

## Verification

Backend/portal typechecks, backend unit and role-policy tests, disposable career-report E2E, root lint/docs lint and repository guards. Browser proof must distinguish actual local backend data, synthetic failure responses and production.
