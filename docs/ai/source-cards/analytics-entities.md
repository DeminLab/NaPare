# Source card: apps/backend/src/analytics/analytics.entities.ts

## Canonical source

`apps/backend/src/analytics/analytics.entities.ts`

## Scope

One daily observation per university/user/UTC date and a university readiness marker without an actor identifier. Read the [analytics contract](../../modules/product-analytics.md). Observed API activity is not attention or attendance. Preserve nullable unknown values, tenant boundaries and default-off collection.

## Verification

Run affected backend/admin typechecks, focused analytics unit tests, disposable PostgreSQL analytics E2E, the reviewed role matrix and repository lint/docs/guards. Browser proof uses synthetic accounts with the real local API. Never infer deployment or actual university activity from fixtures.
