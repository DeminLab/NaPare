# Source card: Platform notifications service

## Canonical source

`apps/backend/src/platform-notifications/platform-notifications.service.ts`

## Scope

Searches notification and inbox records, lists push devices without their tokens, loads details, applies type-specific corrections, validates user and university references, and audits searches, views, edits, and device revocations.

## Change boundary

Require `notification-data.read` or `notification-data.write` on the server. Filter delegated list and device access by allowed university IDs, reject explicit out-of-scope university or user targets, and check each record's canonical university before revealing or changing it. Corrections require a reason, are transactional, and retain old/new values in audit entries. Device revocation requires a reason and deactivates the token record by setting `isActive=false`; it does not purge it or expose the token.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
