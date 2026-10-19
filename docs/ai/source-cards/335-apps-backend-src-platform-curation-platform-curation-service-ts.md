# Source card: Platform curation service

## Canonical source

`apps/backend/src/platform-curation/platform-curation.service.ts`

## Scope

Searches and reviews curator assignment history within the delegated university scope, grants eligible same-university accounts, and soft-revokes assignments while preserving audit history and the legacy group pointer.

## Change boundary

Enforce platform permissions and canonical university scope on every operation, filter searches and choices to allowed universities, lock the group for writes, revalidate the same-university active candidate, and audit actor, target, resource, reason, IP, and user-agent.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
