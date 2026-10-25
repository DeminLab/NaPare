# Source card: webpush-consent-migration

## Canonical source

`apps/backend/src/migrations/1700000000043-WebPushConsent.ts`

## Scope

Three additive nullable device opt-in/revocation columns. Existing registrations are not backfilled as consent. Destructive rollback is refused. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
