# Source card: apps/web-admin/src/app/(admin)/analytics/page.tsx

## Canonical source

`apps/web-admin/src/app/(admin)/analytics/page.tsx`

## Scope

University analytics route metadata and shared dashboard entry point. Read the [analytics contract](../../modules/product-analytics.md). Observed API activity is not attention or attendance. Preserve nullable unknown values, tenant boundaries and default-off collection.

## Verification

Run affected backend/admin typechecks, focused analytics unit tests, disposable PostgreSQL analytics E2E, the reviewed role matrix and repository lint/docs/guards. Browser proof uses synthetic accounts with the real local API. Never infer deployment or actual university activity from fixtures.
