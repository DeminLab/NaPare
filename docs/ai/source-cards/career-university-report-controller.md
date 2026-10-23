# Career university report: controller

## Canonical source

`apps/backend/src/career/career-report.controller.ts`

## Scope

JWT-protected JSON and binary XLSX endpoints with service-level career-center checks, no-store and university identity. Read [report contract](../../modules/career-university-report.md), existing career-center authorization and [tenant isolation](../../security/tenant-isolation.md) before editing. Do not infer employment, formal practice completion or payouts from an accepted work.

## Verification

Backend/portal typechecks, backend unit and role-policy tests, disposable career-report E2E, root lint/docs lint and repository guards. Browser proof must distinguish actual local backend data, synthetic failure responses and production.
