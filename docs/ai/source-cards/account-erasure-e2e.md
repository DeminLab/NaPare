# Account erasure PostgreSQL verification

## Canonical source

`apps/backend/test/account-erasure.e2e-spec.ts`

## Scope

Real JWT/HTTP/PostgreSQL tests using a newly created loopback curation_test database. Checks private cleanup, coded academic history, blocked ownership/assignments, financial retention, atomic rollback, immutable tombstone and concurrent writes/session revocation. Client addresses are synthetic for isolated rate-limit scenarios; trust-proxy test setup is not a production proxy configuration change.

## Verification

Run the suite with ACCOUNT_ERASURE_TEST_DATABASE_URL pointing only at a disposable runtime-role database. No bank operation, external deletion or production data is involved.
