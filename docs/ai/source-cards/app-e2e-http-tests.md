# Application HTTP smoke tests

## Canonical source

`apps/backend/test/app.e2e-spec.ts`

## Scope

Actual AppModule health/auth smoke tests. Optional metadata collector records declared HTTP routes only; it does not convert smoke responses into tenant-isolation proof. No real credentials or private payloads are written into route evidence.

## Verification

Run the E2E suite with the CI database setup. Guard probes remain a separate synthetic-server suite.
