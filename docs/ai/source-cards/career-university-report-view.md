# Career university report: view

## Canonical source

`apps/web-portal/src/app/career/reports/ReportView.tsx`

## Scope

Report loading, stale-data errors, current-session binary download and accessible aggregate tables. Read [report contract](../../modules/career-university-report.md), existing career-center authorization and [tenant isolation](../../security/tenant-isolation.md) before editing. Do not infer employment, formal practice completion or payouts from an accepted work.

## Verification

Backend/portal typechecks, backend unit and role-policy tests, disposable career-report E2E, root lint/docs lint and repository guards. Browser proof must distinguish actual local backend data, synthetic failure responses and production.
