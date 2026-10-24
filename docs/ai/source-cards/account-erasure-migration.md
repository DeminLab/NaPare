# Erasure row capability and tombstone guards

## Canonical source

`apps/backend/src/migrations/1700000000038-AccountErasure.ts`

## Scope

Adds personalDataDeletedAt, exact-row erasure grants after server proof, immutable account tombstones and checks against recreated private records. Existing INSERT policies remain intact. Development synchronization applies the same migration. Down refuses when an erased account exists.

## Verification

Real non-superuser PostgreSQL erasure tests and affected business E2E. Check scoped platform grants as well as ordinary actor writes; neither tests nor documentation may claim that every in-flight external operation is cancelled.
