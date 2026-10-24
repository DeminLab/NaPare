# Source card: apps/web-admin/src/app/(admin)/analytics/AnalyticsDashboard.tsx

## Canonical source

`apps/web-admin/src/app/(admin)/analytics/AnalyticsDashboard.tsx`

## Scope

Own-university aggregate display, editable periods, ten metric definitions and loading/error/disabled/null-data/session-change states. Read the [analytics contract](../../modules/product-analytics.md). Observed API activity is not attention or attendance. Preserve nullable unknown values, tenant boundaries and default-off collection.

## Verification

Run affected backend/admin typechecks, focused analytics unit tests, disposable PostgreSQL analytics E2E, the reviewed role matrix and repository lint/docs/guards. Browser proof uses synthetic accounts with the real local API. Never infer deployment or actual university activity from fixtures.
