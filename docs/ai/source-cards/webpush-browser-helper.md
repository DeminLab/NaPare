# Source card: webpush-browser-helper

## Canonical source

`apps/web-portal/src/app/notifications/setup/browser-push.ts`

## Scope

Secure-context feature checks, exact own worker lookup/registration, bounded activation wait and subscription fingerprinting. Never touches the student offline worker or CacheStorage. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
