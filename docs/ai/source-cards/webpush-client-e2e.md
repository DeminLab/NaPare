# Source card: webpush-client-e2e

## Canonical source

`apps/backend/test/webpush-client.e2e-spec.ts`

## Scope

Real JWT/HTTP/PostgreSQL ownership, opt-in, export, stale job revocation, career exception, atomic logout rollback and erasure. Provider sending is mocked and outbound HTTP is forbidden. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
