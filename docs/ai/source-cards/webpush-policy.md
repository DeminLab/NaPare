# Source card: webpush-policy

## Canonical source

`apps/backend/src/notifications/webpush-policy.ts`

## Scope

Current explicit opt-in version, revocation check and matching VAPID key readiness. Only the public key is exposed; delivery flags are separate from registration readiness. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
