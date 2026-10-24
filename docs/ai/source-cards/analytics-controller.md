# Source card: apps/backend/src/analytics/analytics.controller.ts

## Canonical source

`apps/backend/src/analytics/analytics.controller.ts`

## Scope

JWT plus university-admin-only aggregate report and readiness observation; no client-supplied university selector. Read the [analytics contract](../../modules/product-analytics.md). Observed API activity is not attention or attendance. Preserve nullable unknown values, tenant boundaries and default-off collection.

## Verification

Run affected backend/admin typechecks, focused analytics unit tests, disposable PostgreSQL analytics E2E, the reviewed role matrix and repository lint/docs/guards. Browser proof uses synthetic accounts with the real local API. Never infer deployment or actual university activity from fixtures.
