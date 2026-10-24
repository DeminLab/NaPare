# Source card: webpush-setup-client

## Canonical source

`apps/web-portal/src/app/notifications/setup/WebPushSetup.tsx`

## Scope

Explicit checkbox/click permission flow, own-account API, registration failure cleanup, withdraw, session clearing and unsupported/disabled/denied states. Browser SDK calls require separate device/provider evidence. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
