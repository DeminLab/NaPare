# Source card: apps/backend/src/migrations/1700000000041-ProductAnalytics.ts

## Canonical source

`apps/backend/src/migrations/1700000000041-ProductAnalytics.ts`

## Scope

Daily activity and university state with FORCE RLS, restrictive policies, self export/erasure access and non-destructive rollback refusal. Read the [analytics contract](../../modules/product-analytics.md). Observed API activity is not attention or attendance. Preserve nullable unknown values, tenant boundaries and default-off collection.

## Verification

Run affected backend/admin typechecks, focused analytics unit tests, disposable PostgreSQL analytics E2E, the reviewed role matrix and repository lint/docs/guards. Browser proof uses synthetic accounts with the real local API. Never infer deployment or actual university activity from fixtures.
