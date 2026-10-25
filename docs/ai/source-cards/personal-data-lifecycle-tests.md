# Export connection lifecycle tests

## Canonical source

`apps/backend/src/users/personal-data.service.spec.ts`

## Scope

Unit evidence for interrupted SQL/download handling, concurrent self-export rejection, runner/lease release and listener cleanup. This does not replace actual JWT/PostgreSQL tests.

## Verification

Run the focused backend Jest test and backend typecheck.
