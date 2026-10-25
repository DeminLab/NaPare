# Self JSON export

## Canonical source

`apps/backend/src/users/personal-data.service.ts`

## Scope

Authenticated self-only export from a read-only PostgreSQL snapshot. Keyset batches, HTTP backpressure and disconnect cleanup; no server archive file. Read [contract and exclusions](../../privacy/personal-data-export.md), then the catalog and migration 37.

## Verification

Backend typecheck, lifecycle unit tests and disposable PostgreSQL personal-data E2E suite. A valid complete JSON footer is required; a partial download is a failure.
