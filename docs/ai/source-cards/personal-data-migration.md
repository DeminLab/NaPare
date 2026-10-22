# Personal export SELECT capability

## Canonical source

`apps/backend/src/migrations/1700000000037-PersonalDataRead.ts`

## Scope

Frozen self-only SELECT predicates supplement tenant policies only inside authenticated personalData capability. Existing write policies remain intact. Development synchronization applies the same migration after tenant base policies. Down restores migration 29 policies at this migration boundary.

## Verification

Disposable non-superuser PostgreSQL tests: no capability, wrong identity, own former-university records, foreign records, no UPDATE and no scope persistence after callback.
