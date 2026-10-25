# Source card: webpush-client-service

## Canonical source

`apps/backend/src/notifications/webpush-client.service.ts`

## Scope

Self-only authenticated registration/status/revocation, endpoint ownership independent of JSON order, serialized confirmation and durable opt-in dates/version. Endpoint/keys and private VAPID material must not appear in status or audit output. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
