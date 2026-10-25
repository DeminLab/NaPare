# Local account erasure

## Canonical source

`apps/backend/src/users/account-erasure.service.ts`

## Scope

Password-confirmed self erasure, expected-account check, responsibility handoff blockers and transactional private-data cleanup with a coded learning archive. Read [contract and retained exceptions](../../privacy/account-deletion.md), User, migration 38 and the source selectors before changing it. Never claim complete anonymization or external/archive destruction.

## Verification

Backend typecheck, controller/JWT unit tests, full applicable backend E2E and disposable PostgreSQL account-erasure suite. Include rollback, in-flight writes/session revocation and company financial retention. Never test against actual user data.
