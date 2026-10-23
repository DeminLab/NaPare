# Explicit self-erasure confirmation

## Canonical source

`apps/backend/src/users/dto/delete-account.dto.ts`

## Scope

Current password, expected account UUID, explicit deletion confirmation and acknowledgment of retained records. The UUID is a consistency assertion, never an authorization selector. Swagger examples must not contain real credentials.

## Verification

Real HTTP validation tests: missing/false confirmations, wrong password, foreign expected ID and unchanged account after rejection.
