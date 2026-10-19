# Source card: Platform curation controller

## Canonical source

`apps/backend/src/platform-curation/platform-curation.controller.ts`

## Scope

Exposes authenticated global assignment, detail, group and candidate search, grant, and soft-revoke routes.

## Change boundary

Pass request IP and user-agent to the service for auditable searches, views, and writes.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
