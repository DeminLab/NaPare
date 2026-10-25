# Source card: apps/backend/test/product-analytics.e2e-spec.ts

## Canonical source

`apps/backend/test/product-analytics.e2e-spec.ts`

## Scope

Real JWT/HTTP/PostgreSQL ten-metric calculations, tenant isolation, default-off/allowlist, readiness, retention cleanup and account lifecycle. Read the [analytics contract](../../modules/product-analytics.md). Observed API activity is not attention or attendance. Preserve nullable unknown values, tenant boundaries and default-off collection.

## Verification

Run affected backend/admin typechecks, focused analytics unit tests, disposable PostgreSQL analytics E2E, the reviewed role matrix and repository lint/docs/guards. Browser proof uses synthetic accounts with the real local API. Never infer deployment or actual university activity from fixtures.
